from pathlib import Path
from zipfile import ZipFile
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

from app.config import Settings
from app.schemas import ApiError, ExtractionResult
from app.services.ocr_service import OcrService


SUPPORTED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"}


def detect_file_type(file_name: str) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix == ".jpeg":
        return "jpg"
    if suffix.startswith("."):
        return suffix[1:]
    return ""


def validate_upload(file_name: str, file_size: int, max_upload_mb: int) -> None:
    suffix = Path(file_name).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise ApiError("UNSUPPORTED_FILE_TYPE", "仅支持 PDF、DOC、DOCX、JPG/JPEG、PNG 合同文件。")
    if file_size > max_upload_mb * 1024 * 1024:
        raise ApiError("FILE_TOO_LARGE", f"文件大小超过 {max_upload_mb}MB，请选择更小的文件。")


class ParserService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.ocr_service = OcrService(settings)

    async def parse(self, file_path: Path, file_name: str) -> ExtractionResult:
        file_type = detect_file_type(file_name)
        if file_type == "docx":
            return self._parse_docx(file_path, "docx")
        if file_type == "doc":
            return self._parse_doc(file_path)
        if file_type == "pdf":
            return await self._parse_pdf(file_path)
        if file_type in {"jpg", "png"}:
            return await self._parse_image(file_path)
        raise ApiError("UNSUPPORTED_FILE_TYPE", "仅支持 PDF、DOC、DOCX、JPG/JPEG、PNG 合同文件。")

    def _parse_docx(self, file_path: Path, source_type: str) -> ExtractionResult:
        text = ""
        warnings: list[str] = []
        try:
            import mammoth

            with file_path.open("rb") as docx_file:
                result = mammoth.extract_raw_text(docx_file)
            text = result.value.strip()
            warnings.extend(str(message) for message in result.messages)
        except Exception:
            text = self._parse_docx_xml(file_path)
            warnings.append("DOCX mammoth 解析失败，已降级为 XML 文本提取。")

        if not text:
            raise ApiError("NO_TEXT_EXTRACTED", "未能从 DOCX 中提取到可分析文本。")
        return self._build_result(source_type=source_type, text=text, warnings=warnings)

    def _parse_docx_xml(self, file_path: Path) -> str:
        with ZipFile(file_path) as docx:
            names = [name for name in docx.namelist() if name.startswith("word/") and name.endswith(".xml")]
            texts: list[str] = []
            namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            for name in names:
                if not re.search(r"(document|header|footer|footnotes|endnotes)\.xml$", name):
                    continue
                root = ET.fromstring(docx.read(name))
                for node in root.findall(".//w:t", namespace):
                    if node.text:
                        texts.append(node.text)
            return "\n".join(texts).strip()

    def _parse_doc(self, file_path: Path) -> ExtractionResult:
        if self._is_docx_container(file_path):
            return self._parse_docx(file_path, "doc")
        if not self.settings.enable_doc_convert:
            raise ApiError("DOC_CONVERT_DISABLED", "当前部署未启用 DOC 转换。")
        converter = self._resolve_doc_converter()
        if not converter:
            raise ApiError(
                "DOC_CONVERT_FAILED",
                "后端环境未安装 LibreOffice，无法转换二进制 DOC 文件；如文件实际为 DOCX，请使用正确扩展名或重新上传。",
            )

        with tempfile.TemporaryDirectory() as tmp_dir:
            command = [
                converter,
                "--headless",
                "--convert-to",
                "docx",
                "--outdir",
                tmp_dir,
                str(file_path),
            ]
            completed = subprocess.run(command, capture_output=True, text=True, timeout=120, check=False)
            if completed.returncode != 0:
                raise ApiError("DOC_CONVERT_FAILED", "DOC 转 DOCX 失败，请检查文件是否损坏。")
            converted = next(Path(tmp_dir).glob("*.docx"), None)
            if not converted:
                raise ApiError("DOC_CONVERT_FAILED", "DOC 转换完成但未生成 DOCX 文件。")
            return self._parse_docx(converted, "doc")

    def _is_docx_container(self, file_path: Path) -> bool:
        try:
            with ZipFile(file_path) as archive:
                names = set(archive.namelist())
                return "[Content_Types].xml" in names and "word/document.xml" in names
        except Exception:
            return False

    def _resolve_doc_converter(self) -> str | None:
        configured = (self.settings.libreoffice_path or "").strip()
        if configured:
            configured_path = Path(configured)
            if configured_path.exists():
                return str(configured_path)
            return configured

        for command in ("libreoffice", "soffice"):
            resolved = shutil.which(command)
            if resolved:
                return resolved

        for candidate in (
            Path(r"C:\Program Files\LibreOffice\program\soffice.exe"),
            Path(r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"),
        ):
            if candidate.exists():
                return str(candidate)
        return None

    async def _parse_pdf(self, file_path: Path) -> ExtractionResult:
        try:
            import fitz
        except Exception as exc:
            raise ApiError("PDF_PARSE_FAILED", "后端环境缺少 PyMuPDF，无法解析 PDF。") from exc

        warnings: list[str] = []
        page_texts: list[str] = []
        with fitz.open(file_path) as document:
            for page_index, page in enumerate(document, start=1):
                page_text = page.get_text("text").strip()
                if page_text:
                    page_texts.append(f"第 {page_index} 页\n{page_text}")
            page_count = document.page_count

        text = "\n\n".join(page_texts).strip()
        if self._looks_like_scanned_pdf(text, page_count):
            return await self._parse_pdf_with_ocr(file_path)
        if not text:
            raise ApiError("NO_TEXT_EXTRACTED", "未能从 PDF 文本层提取到可分析文本。")
        if len(text) < 800:
            warnings.append("PDF 文本层内容较短，建议人工复核是否存在漏页或扫描页。")
        return self._build_result(source_type="pdf_text", text=text, page_count=page_count, warnings=warnings)

    async def _parse_image(self, file_path: Path) -> ExtractionResult:
        page = await self.ocr_service.recognize_image(file_path.read_bytes())
        warnings = []
        if page.confidence is not None and page.confidence < 75:
            warnings.append("OCR 平均置信度较低，建议人工复核识别文本。")
        return self._build_result(source_type="image_ocr", text=page.text, page_count=1, warnings=warnings)

    async def _parse_pdf_with_ocr(self, file_path: Path) -> ExtractionResult:
        try:
            import fitz
        except Exception as exc:
            raise ApiError("PDF_PARSE_FAILED", "后端环境缺少 PyMuPDF，无法渲染扫描 PDF。") from exc

        page_texts: list[str] = []
        warnings: list[str] = []
        with fitz.open(file_path) as document:
            for page_index, page in enumerate(document, start=1):
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                ocr_page = await self.ocr_service.recognize_image(pixmap.tobytes("png"))
                page_texts.append(f"第 {page_index} 页\n{ocr_page.text}")
                if ocr_page.confidence is not None and ocr_page.confidence < 75:
                    warnings.append(f"第 {page_index} 页 OCR 置信度较低。")
            page_count = document.page_count

        text = "\n\n".join(page_texts).strip()
        if not text:
            raise ApiError("NO_TEXT_EXTRACTED", "OCR 未识别到可分析文本。")
        return self._build_result(source_type="pdf_ocr", text=text, page_count=page_count, warnings=warnings)

    def _looks_like_scanned_pdf(self, text: str, page_count: int) -> bool:
        if page_count <= 0:
            return False
        if len(text) < 300:
            return True
        return len(text) / page_count < 80

    def _build_result(
        self,
        *,
        source_type: str,
        text: str,
        page_count: int | None = None,
        warnings: list[str] | None = None,
    ) -> ExtractionResult:
        clean_text = re.sub(r"\n{3,}", "\n\n", text).strip()
        segments = [
            {"index": index + 1, "text": chunk}
            for index, chunk in enumerate(chunk for chunk in clean_text.split("\n\n") if chunk.strip())
        ]
        return ExtractionResult(
            sourceType=source_type,
            plainText=clean_text,
            segments=segments,
            pageCount=page_count,
            charCount=len(clean_text),
            warnings=warnings or [],
        )
