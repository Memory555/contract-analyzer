import base64
from dataclasses import dataclass

from app.config import Settings
from app.schemas import ApiError


@dataclass
class OcrPage:
    text: str
    confidence: float | None = None


class OcrService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def is_configured(self) -> bool:
        return bool(
            self.settings.enable_ocr
            and self.settings.tencentcloud_secret_id
            and self.settings.tencentcloud_secret_key
        )

    async def recognize_image(self, image_bytes: bytes) -> OcrPage:
        if not self.is_configured():
            raise ApiError("OCR_NOT_CONFIGURED", "当前后端未配置 OCR 服务，无法识别扫描件或图片合同。")

        try:
            from tencentcloud.common.credential import Credential
            from tencentcloud.ocr.v20181119 import ocr_client, models

            credential = Credential(self.settings.tencentcloud_secret_id, self.settings.tencentcloud_secret_key)
            client = ocr_client.OcrClient(credential, self.settings.tencentcloud_ocr_region)
            request = models.GeneralBasicOCRRequest()
            request.ImageBase64 = base64.b64encode(image_bytes).decode("ascii")
            response = client.GeneralBasicOCR(request)
            detections = response.TextDetections or []
            texts = [item.DetectedText for item in detections if item.DetectedText]
            confidences = [
                float(item.Confidence)
                for item in detections
                if getattr(item, "Confidence", None) is not None
            ]
            confidence = sum(confidences) / len(confidences) if confidences else None
            text = "\n".join(texts).strip()
            if not text:
                raise ApiError("NO_TEXT_EXTRACTED", "OCR 未识别到可分析文本。")
            return OcrPage(text=text, confidence=confidence)
        except ApiError:
            raise
        except Exception as exc:
            raise ApiError("OCR_FAILED", "OCR 调用失败，请检查腾讯云 OCR 配置或稍后重试。") from exc
