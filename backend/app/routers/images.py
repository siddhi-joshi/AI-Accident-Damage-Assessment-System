from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AuditEvent, ClaimImage
from app.routers.claims import find_claim
from app.schemas import ImageOut
from app.services.image_service import validate_image

router = APIRouter(prefix="/api/claims", tags=["images"])
UPLOAD_DIR = Path(settings.upload_dir)


@router.post("/{claim_id}/images", response_model=ImageOut, status_code=201)
async def upload_image(claim_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    find_claim(db, claim_id)
    count = db.scalar(select(func.count()).select_from(ClaimImage).where(ClaimImage.claim_id == claim_id))
    if count >= 8:
        raise HTTPException(400, "Maximum 8 images per claim")
    data, extension, content_type = await validate_image(file)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}{extension}"
    path = UPLOAD_DIR / stored_name
    path.write_bytes(data)
    try:
        record = ClaimImage(claim_id=claim_id, stored_name=stored_name, original_name=(file.filename or "upload")[:255], content_type=content_type)
        db.add(record)
        db.flush()
        db.add(AuditEvent(claim_id=claim_id, event="image_uploaded", detail=f"Image {record.id} uploaded"))
        db.commit()
        db.refresh(record)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return record


@router.get("/{claim_id}/images/{image_id}")
def get_image(claim_id: int, image_id: int, db: Session = Depends(get_db)):
    find_claim(db, claim_id)
    image = db.scalar(select(ClaimImage).where(ClaimImage.claim_id == claim_id, ClaimImage.id == image_id))
    if image is None:
        raise HTTPException(404, "Image not found")
    path = UPLOAD_DIR / image.stored_name
    if not path.is_file():
        raise HTTPException(404, "Image file not found")
    return FileResponse(path, media_type=image.content_type, headers={"Cache-Control": "private, no-store"})
