import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AuditEvent, now
from app.routers.claims import find_claim
from app.schemas import AssessmentOut, ReviewUpdate
from app.services.damage_analyzer import AnalysisUnavailable, analyze_vehicle_damage
from app.services.estimate_service import estimate_repair_cost

router = APIRouter(prefix="/api/claims", tags=["assessments"])


def assessment_response(assessment) -> AssessmentOut:
    return AssessmentOut(
        analysis_status=assessment.analysis_status,
        findings=json.loads(assessment.findings_json) if assessment.findings_json else None,
        model_version=assessment.model_version,
        confidence=assessment.confidence,
        estimated_min=assessment.estimated_min,
        estimated_max=assessment.estimated_max,
        currency=assessment.currency,
        limitations=assessment.limitations,
        reviewer_notes=assessment.reviewer_notes,
        reviewed_at=assessment.reviewed_at,
    )


@router.get("/{claim_id}/assessment", response_model=AssessmentOut)
def get_assessment(claim_id: int, db: Session = Depends(get_db)):
    return assessment_response(find_claim(db, claim_id).assessment)


@router.post("/{claim_id}/analyze")
def analyze(claim_id: int, db: Session = Depends(get_db)):
    claim = find_claim(db, claim_id)
    if not claim.images:
        raise HTTPException(400, "Upload at least one photo before requesting analysis")
    paths = [str(Path(settings.upload_dir) / image.stored_name) for image in claim.images]
    try:
        vehicle_context = " ".join(str(value) for value in (claim.vehicle_make, claim.vehicle_model, claim.vehicle_year) if value)
        result = analyze_vehicle_damage(paths, vehicle_context)
    except AnalysisUnavailable as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    estimate = estimate_repair_cost()
    assessment = claim.assessment
    assessment.analysis_status = result["model_status"]
    assessment.findings_json = json.dumps({"analysis": result, "estimate": estimate})
    assessment.model_version = result["model_version"]
    assessment.confidence = result["confidence"]
    assessment.estimated_min = estimate["minimum"]
    assessment.estimated_max = estimate["maximum"]
    if claim.status == "submitted":
        claim.status = "under_review"
    db.add(AuditEvent(claim_id=claim_id, event="analysis_requested", detail=result["model_status"]))
    db.commit()
    return {"analysis": result, "estimate": estimate}


@router.patch("/{claim_id}/review", response_model=AssessmentOut)
def save_review(claim_id: int, payload: ReviewUpdate, db: Session = Depends(get_db)):
    claim = find_claim(db, claim_id)
    assessment = claim.assessment
    assessment.reviewer_notes = payload.reviewer_notes.strip()
    if not assessment.reviewer_notes:
        raise HTTPException(422, "Review notes cannot be empty")
    assessment.reviewed_at = now()
    claim.status = payload.decision
    db.add(AuditEvent(claim_id=claim_id, event="review_saved", detail=payload.decision))
    db.commit()
    return assessment_response(assessment)
