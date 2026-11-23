from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def now():
    return datetime.now(timezone.utc)


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    claimant_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), index=True)
    vehicle_number: Mapped[str] = mapped_column(String(30))
    vehicle_make: Mapped[str | None] = mapped_column(String(80))
    vehicle_model: Mapped[str | None] = mapped_column(String(80))
    vehicle_year: Mapped[int | None] = mapped_column(Integer)
    incident_date: Mapped[str] = mapped_column(String(10))
    incident_description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="submitted")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    images: Mapped[list["ClaimImage"]] = relationship(back_populates="claim", cascade="all, delete-orphan")
    assessment: Mapped["Assessment"] = relationship(back_populates="claim", uselist=False, cascade="all, delete-orphan")


class ClaimImage(Base):
    __tablename__ = "claim_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"), index=True)
    stored_name: Mapped[str] = mapped_column(String(255))
    original_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    claim: Mapped[Claim] = relationship(back_populates="images")


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"), unique=True)
    analysis_status: Mapped[str] = mapped_column(String(30), default="pending")
    findings_json: Mapped[str | None] = mapped_column(Text)
    model_version: Mapped[str | None] = mapped_column(String(120))
    confidence: Mapped[float | None] = mapped_column(Float)
    estimated_min: Mapped[float | None] = mapped_column(Float)
    estimated_max: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    limitations: Mapped[str] = mapped_column(Text, default="Photo assessment is preliminary. Human review is required.")
    reviewer_notes: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claim: Mapped[Claim] = relationship(back_populates="assessment")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"), index=True)
    event: Mapped[str] = mapped_column(String(50))
    detail: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
