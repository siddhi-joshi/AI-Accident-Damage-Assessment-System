from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Assessment, AuditEvent, Claim
from app.schemas import ClaimCreate, ClaimOut

router = APIRouter(prefix="/api/claims", tags=["claims"])


def find_claim(db: Session, claim_id: int) -> Claim:
    claim = db.scalar(select(Claim).options(selectinload(Claim.images)).where(Claim.id == claim_id))
    if claim is None:
        raise HTTPException(404, "Claim not found")
    return claim


@router.post("", response_model=ClaimOut, status_code=201)
def create_claim(payload: ClaimCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["incident_date"] = payload.incident_date.isoformat()
    claim = Claim(**data)
    db.add(claim)
    db.flush()
    db.add(Assessment(claim_id=claim.id))
    db.add(AuditEvent(claim_id=claim.id, event="claim_created", detail="Claim submitted"))
    db.commit()
    return find_claim(db, claim.id)


@router.get("", response_model=list[ClaimOut])
def list_claims(db: Session = Depends(get_db)):
    return db.scalars(select(Claim).options(selectinload(Claim.images)).order_by(Claim.created_at.desc(), Claim.id.desc())).all()


@router.get("/{claim_id}", response_model=ClaimOut)
def get_claim(claim_id: int, db: Session = Depends(get_db)):
    return find_claim(db, claim_id)
