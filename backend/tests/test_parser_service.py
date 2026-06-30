from pathlib import Path
from zipfile import ZipFile

from app.services.parser_service import detect_file_type, validate_upload, ParserService
from app.config import Settings


def test_detect_file_type_normalizes_jpeg():
    assert detect_file_type("合同.PDF") == "pdf"
    assert detect_file_type("照片.JPEG") == "jpg"
    assert detect_file_type("扫描件.PNG") == "png"


def test_validate_upload_accepts_v6_formats():
    validate_upload("合同.pdf", 1024, 20)
    validate_upload("合同.doc", 1024, 20)
    validate_upload("合同.docx", 1024, 20)
    validate_upload("合同.jpg", 1024, 20)
    validate_upload("合同.png", 1024, 20)


def test_docx_xml_fallback_extracts_text(tmp_path: Path):
    docx_path = tmp_path / "sample.docx"
    xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body><w:p><w:r><w:t>合同付款计划</w:t></w:r></w:p></w:body></w:document>"
    )
    with ZipFile(docx_path, "w") as docx:
        docx.writestr("word/document.xml", xml)

    service = ParserService(Settings(upload_dir=tmp_path))
    assert service._parse_docx_xml(docx_path) == "合同付款计划"


def test_doc_extension_with_docx_container_parses_without_converter(tmp_path: Path):
    doc_path = tmp_path / "renamed.doc"
    xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body><w:p><w:r><w:t>结构性生态智能软件合同</w:t></w:r></w:p></w:body></w:document>"
    )
    with ZipFile(doc_path, "w") as docx:
        docx.writestr("[Content_Types].xml", "<Types />")
        docx.writestr("word/document.xml", xml)

    service = ParserService(Settings(upload_dir=tmp_path, enable_doc_convert=False))
    result = service._parse_doc(doc_path)

    assert result.source_type == "doc"
    assert "结构性生态智能软件合同" in result.plain_text
