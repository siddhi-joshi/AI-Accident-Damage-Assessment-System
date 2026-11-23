from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ClaimCreate(BaseModel):
    claimant_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    vehicle_number: str = Field(min_length=4, max_length=30)
    vehicle_make: str | None = Field(default=None, max_length=80)
    vehicle_model: str | None = Field(default=None, max_length=80)
    vehicle_year: int | None = Field(default=None, ge=1950, le=2100)
    incident_date: date
    incident_description: str = Field(min_length=10, max_length=3000)

    @field_validator("incident_date")
    @classmethod
    def date_not_in_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Incident date cannot be in the future")
        return value


class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    original_name: str
    content_type: str
    created_at: datetime


class ClaimOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    claimant_name: str
    email: str
    vehicle_number: str
    vehicle_make: str | None
    vehicle_model: str | None
    vehicle_year: int | None
    incident_date: str
    incident_description: str
    status: str
    created_at: datetime
    images: list[ImageOut] = []


class ReviewUpdate(BaseModel):
    reviewer_notes: str = Field(min_length=1, max_length=5000)
    decision: Literal["needs_more_info", "under_review", "assessed"]


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    analysis_status: str
    findings: dict | None
    model_version: str | None
    confidence: float | None
    estimated_min: float | None
    estimated_max: float | None
    currency: str
    limitations: str
    reviewer_notes: str | None
    reviewed_at: datetime | None
