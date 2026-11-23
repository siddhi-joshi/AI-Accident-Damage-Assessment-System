import io

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

Image.MAX_IMAGE_PIXELS = 30_000_000
ALLOWED_FORMATS = {"JPEG": (".jpg", "image/jpeg"), "PNG": (".png", "image/png"), "WEBP": (".webp", "image/webp")}


async def validate_image(upload: UploadFile) -> tuple[bytes, str, str]:
    limit = settings.max_upload_mb * 1024 * 1024
    data = await upload.read(limit + 1)
    if not data:
        raise HTTPException(400, "Empty image file")
    if len(data) > limit:
        raise HTTPException(413, "Image exceeds upload size limit")
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            if image.format not in ALLOWED_FORMATS:
                raise HTTPException(415, "Only JPEG, PNG and WEBP are accepted")
            if min(image.size) < 200:
                raise HTTPException(400, "Image resolution is too small (minimum 200 × 200)")
            image = ImageOps.exif_transpose(image).convert("RGB")
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=88, optimize=True)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise HTTPException(400, "File is not a valid image") from None
    return output.getvalue(), ".jpg", "image/jpeg"
