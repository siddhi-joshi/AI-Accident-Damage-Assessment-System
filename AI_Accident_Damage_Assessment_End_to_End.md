# AI Accident Damage Assessment System
## End-to-End Build Guide — Python + React.js

**Backend:** Python + FastAPI  
**Frontend:** React + Vite  
**Database:** SQLite for local development; PostgreSQL for deployment  
**Computer vision:** OpenCV + a trained vehicle-damage detection model  
**Storage:** Private local storage for development; private object storage in production

---

## 1. What you are building

A web application that helps motor-insurance teams review accident claims. A customer enters incident and vehicle details, uploads vehicle photographs, and receives a preliminary image assessment. A claims officer reviews the evidence, edits observations, and records the assessment.

### Core workflow

1. Customer submits vehicle and incident details.
2. Customer uploads up to eight clear photographs.
3. Backend validates and stores the images.
4. Computer-vision service checks image quality and detects visible damage.
5. System records detected part, damage type, confidence and image region.
6. Optional repair-cost range is calculated only when verified regional pricing data is available.
7. Claims officer reviews the result and records notes.
8. Customer/authorized staff can track claim status.

### Important safety and product boundary

This is a **decision-support system**, not an automatic claim approval/rejection engine. Images cannot establish hidden structural damage, liability, policy coverage or a definitive repair cost. All AI findings must be labelled preliminary. Low-confidence, severe, unclear or inconsistent cases must be sent to a qualified human assessor. Never reject a claim solely because of an AI output.

---

## 2. MVP scope

### Build first

- Claim submission form.
- Multiple image upload with validation.
- Claim list and detail pages.
- FastAPI REST API.
- Database persistence.
- Pluggable damage-analysis service.
- Human review and notes.
- Preliminary assessment report.
- Tests and setup instructions.

### Add later

- Authentication and role-based access.
- Trained damage detection/segmentation model.
- Annotated images with bounding boxes.
- Image-quality checks (blur, darkness, angle).
- Duplicate-image detection.
- Regional repair parts/labour catalogue.
- Notifications, audit logs and insurer integrations.
- Deployment, monitoring and model performance dashboards.

---

## 3. Architecture

```text
React frontend
  ├── Claim form
  ├── Photo upload and preview
  ├── Claim list/detail
  └── Assessor review
          |
          | HTTPS / JSON / multipart
          v
FastAPI backend
  ├── Claims API
  ├── Image upload API
  ├── Assessment API
  ├── Review API
  └── Services
       ├── Image validation
       ├── Private image storage
       ├── Damage model adapter
       ├── Estimate rules
       └── Audit logging
          |
          +---- SQLite / PostgreSQL
          +---- Private image storage
          +---- Optional model inference service
```

### Folder structure

```text
ai-accident-assessment/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── routers/
│   │   │   ├── claims.py
│   │   │   ├── images.py
│   │   │   └── assessments.py
│   │   └── services/
│   │       ├── image_service.py
│   │       ├── damage_analyzer.py
│   │       └── estimate_service.py
│   ├── tests/
│   ├── uploads/              # local development only; do not commit
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/client.js
│   │   ├── pages/
│   │   │   ├── ClaimForm.jsx
│   │   │   ├── Claims.jsx
│   │   │   └── ClaimDetail.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   └── .env.example
├── .gitignore
└── README.md
```

---

## 4. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Routing | React Router |
| API client | Axios |
| Backend | FastAPI |
| Validation | Pydantic |
| ORM | SQLAlchemy |
| Local database | SQLite |
| Production database | PostgreSQL |
| Image processing | Pillow + OpenCV |
| AI model | A licensed, trained vehicle-damage detection model |
| Testing | Pytest + HTTPX; React Testing Library |
| API docs | FastAPI Swagger UI |

**Model reality check:** A generic object-detection model does not automatically recognize dents, scratches or broken vehicle parts. You need a model trained and evaluated for your damage classes. Do not advertise model accuracy until it has been measured on a representative held-out dataset.

---

# Part A — Python backend

## 5. Create the backend

From a terminal:

```bash
mkdir ai-accident-assessment
cd ai-accident-assessment
mkdir backend
cd backend

python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
```

Create `requirements.txt`:

```text
fastapi
uvicorn[standard]
sqlalchemy
pydantic-settings
python-multipart
pillow
opencv-python-headless
pytest
httpx
```

Install:

```bash
pip install -r requirements.txt
```

## 6. Configuration

Create `backend/.env.example`:

```env
APP_NAME=AI Accident Damage Assessment
DATABASE_URL=sqlite:///./accidents.db
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=10
ALLOWED_ORIGINS=http://localhost:5173
```

Copy it to `.env`. Do not commit `.env`, uploaded images, credentials or customer information.

Create `app/config.py`:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "AI Accident Damage Assessment"
    database_url: str = "sqlite:///./accidents.db"
    upload_dir: str = "uploads"
    max_upload_mb: int = 10
    allowed_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
```

## 7. Database connection

Create `app/database.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## 8. Database models

Create `app/models.py`:

```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    claimant_name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    vehicle_number = Column(String(30), nullable=False)
    vehicle_make = Column(String(80))
    vehicle_model = Column(String(80))
    vehicle_year = Column(Integer)
    incident_date = Column(String(30), nullable=False)
    incident_description = Column(Text, nullable=False)
    status = Column(String(30), default="submitted", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    images = relationship("ClaimImage", back_populates="claim",
                          cascade="all, delete-orphan")
    assessment = relationship("Assessment", back_populates="claim",
                              uselist=False, cascade="all, delete-orphan")

class ClaimImage(Base):
    __tablename__ = "claim_images"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    stored_name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    content_type = Column(String(80), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    claim = relationship("Claim", back_populates="images")

class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), unique=True, nullable=False)
    analysis_status = Column(String(30), default="pending", nullable=False)
    findings_json = Column(Text)
    estimated_min = Column(Float)
    estimated_max = Column(Float)
    currency = Column(String(3), default="INR", nullable=False)
    confidence = Column(Float)
    limitations = Column(Text)
    reviewer_notes = Column(Text)
    reviewed_at = Column(DateTime)

    claim = relationship("Claim", back_populates="assessment")
```

## 9. Request and response schemas

Create `app/schemas.py`:

```python
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr

class ClaimCreate(BaseModel):
    claimant_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    vehicle_number: str = Field(min_length=4, max_length=30)
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = Field(default=None, ge=1950, le=2100)
    incident_date: str
    incident_description: str = Field(min_length=10, max_length=3000)

class ClaimOut(BaseModel):
    id: int
    claimant_name: str
    email: str
    vehicle_number: str
    vehicle_make: Optional[str]
    vehicle_model: Optional[str]
    vehicle_year: Optional[int]
    incident_date: str
    incident_description: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ReviewUpdate(BaseModel):
    reviewer_notes: str = Field(min_length=1, max_length=5000)
    decision: str = Field(pattern="^(needs_more_info|under_review|assessed)$")
```

Add `email-validator` to `requirements.txt` and install it because `EmailStr` uses it:

```bash
pip install email-validator
```

## 10. Image validation

Create `app/services/image_service.py`:

```python
import io
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException, UploadFile
from app.config import settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

async def validate_image(upload: UploadFile) -> tuple[bytes, str]:
    data = await upload.read()
    if not data:
        raise HTTPException(400, "Empty image file")

    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, "Image exceeds upload size limit")

    try:
        image = Image.open(io.BytesIO(data))
        image.verify()
        image = Image.open(io.BytesIO(data))
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "File is not a valid image")

    if image.format not in ALLOWED_FORMATS:
        raise HTTPException(415, "Only JPEG, PNG and WEBP are accepted")
    if image.width < 200 or image.height < 200:
        raise HTTPException(400, "Image resolution is too small")

    return data, image.format
```

## 11. Damage-analysis adapter

Create `app/services/damage_analyzer.py`:

```python
def analyze_vehicle_damage(image_paths: list[str]) -> dict:
    """
    Placeholder only. Replace with a trained and evaluated damage model.
    This response is not an AI prediction and must be shown as such.
    """
    return {
        "model_status": "not_configured",
        "message": "A trained vehicle-damage model has not been configured.",
        "model_version": None,
        "detections": [],
        "confidence": None,
        "requires_human_review": True,
    }
```

### How to connect a real model

1. Select a dataset and model with a licence suitable for your project.
2. Define classes such as `scratch`, `dent`, `crack`, `broken_part`, and vehicle-part classes such as `bumper`, `door`, `bonnet`, `windshield`, `headlamp`.
3. Label bounding boxes or segmentation masks consistently.
4. Split data by accident/vehicle into train, validation and test sets to avoid leakage.
5. Train or fine-tune a detection or segmentation model.
6. Evaluate precision, recall, mAP and false negatives per class.
7. Test on different lighting, angles, vehicle types and image quality.
8. Set thresholds from validation results and escalate uncertain cases to a human.
9. Save model version and inference metadata with each assessment.

A future model adapter could return:

```json
{
  "model_status": "completed",
  "model_version": "vehicle-damage-v1",
  "detections": [
    {
      "part": "front_bumper",
      "damage_type": "scratch",
      "confidence": 0.87,
      "box": [0.12, 0.20, 0.66, 0.71]
    }
  ],
  "requires_human_review": true
}
```

The values above are illustrative, not real results.

## 12. Repair estimate service

Create `app/services/estimate_service.py`:

```python
def estimate_repair_cost(detections: list[dict]) -> dict:
    # Do not infer a price from image confidence alone.
    # Integrate verified local parts, labour and tax data before enabling this.
    return {
        "available": False,
        "currency": "INR",
        "minimum": None,
        "maximum": None,
        "message": (
            "A verified regional repair-price catalogue is not configured. "
            "A qualified assessor or repairer must provide the estimate."
        ),
    }
```

For a future estimate, use a maintained catalogue of part prices, labour rates, vehicle variant, repair/replacement rules, location and applicable taxes. Clearly label the result as indicative.

## 13. Claims API

Create `app/routers/claims.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Claim, Assessment
from app.schemas import ClaimCreate, ClaimOut

router = APIRouter(prefix="/api/claims", tags=["claims"])

@router.post("", response_model=ClaimOut, status_code=201)
def create_claim(payload: ClaimCreate, db: Session = Depends(get_db)):
    claim = Claim(**payload.model_dump())
    db.add(claim)
    db.flush()
    db.add(Assessment(
        claim_id=claim.id,
        analysis_status="pending",
        limitations="Photo assessment is preliminary. Human review is required."
    ))
    db.commit()
    db.refresh(claim)
    return claim

@router.get("", response_model=list[ClaimOut])
def list_claims(db: Session = Depends(get_db)):
    return db.query(Claim).order_by(Claim.created_at.desc()).all()

@router.get("/{claim_id}", response_model=ClaimOut)
def get_claim(claim_id: int, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(404, "Claim not found")
    return claim
```

## 14. Image upload API

Create `app/routers/images.py`:

```python
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import Claim, ClaimImage
from app.services.image_service import validate_image

router = APIRouter(prefix="/api/claims", tags=["images"])
UPLOAD_DIR = Path(settings.upload_dir)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/{claim_id}/images", status_code=201)
async def upload_claim_image(
    claim_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(404, "Claim not found")

    count = db.query(ClaimImage).filter(
        ClaimImage.claim_id == claim_id
    ).count()
    if count >= 8:
        raise HTTPException(400, "Maximum 8 images per claim")

    data, image_format = await validate_image(file)
    extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}[image_format]
    stored_name = f"{uuid4().hex}{extension}"
    (UPLOAD_DIR / stored_name).write_bytes(data)

    record = ClaimImage(
        claim_id=claim_id,
        stored_name=stored_name,
        original_name=(file.filename or "upload")[:255],
        content_type=file.content_type or "application/octet-stream",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "claim_id": claim_id, "message": "Image uploaded"}
```

**Production requirement:** Do not expose the uploads directory publicly. Add authentication, claim ownership checks, quotas, private object storage, encryption, retention/deletion controls and audit logging.

## 15. Assessment and human-review API

Create `app/routers/assessments.py`:

```python
import json
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import Claim, ClaimImage, Assessment
from app.schemas import ReviewUpdate
from app.services.damage_analyzer import analyze_vehicle_damage
from app.services.estimate_service import estimate_repair_cost

router = APIRouter(prefix="/api/claims", tags=["assessments"])

@router.post("/{claim_id}/analyze")
def analyze_claim(claim_id: int, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(404, "Claim not found")

    images = db.query(ClaimImage).filter(
        ClaimImage.claim_id == claim_id
    ).all()
    if not images:
        raise HTTPException(400, "Upload at least one image first")

    paths = [str(Path(settings.upload_dir) / item.stored_name) for item in images]
    result = analyze_vehicle_damage(paths)
    estimate = estimate_repair_cost(result.get("detections", []))

    assessment = db.query(Assessment).filter(
        Assessment.claim_id == claim_id
    ).first()
    assessment.analysis_status = (
        "completed" if result["model_status"] == "completed" else "not_configured"
    )
    assessment.findings_json = json.dumps({
        "analysis": result,
        "estimate": estimate,
    })
    assessment.confidence = result.get("confidence")
    db.commit()

    return {
        "claim_id": claim_id,
        "analysis": result,
        "estimate": estimate,
        "human_review_required": True,
    }

@router.get("/{claim_id}/assessment")
def get_assessment(claim_id: int, db: Session = Depends(get_db)):
    assessment = db.query(Assessment).filter(
        Assessment.claim_id == claim_id
    ).first()
    if not assessment:
        raise HTTPException(404, "Assessment not found")
    return assessment

@router.patch("/{claim_id}/review")
def save_review(
    claim_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(404, "Claim not found")

    assessment = db.query(Assessment).filter(
        Assessment.claim_id == claim_id
    ).first()
    if not assessment:
        raise HTTPException(404, "Assessment not found")

    assessment.reviewer_notes = payload.reviewer_notes
    assessment.reviewed_at = datetime.utcnow()
    claim.status = payload.decision
    db.commit()
    return {"claim_id": claim_id, "status": claim.status, "message": "Review saved"}
```

In production, obtain reviewer identity from the authenticated session, not from a user-editable request field.

## 16. FastAPI application entry point

Create `app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, engine
from app.routers import claims, images, assessments

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(claims.router)
app.include_router(images.router)
app.include_router(assessments.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

Create empty files `app/routers/__init__.py` and `app/services/__init__.py`.

Run from `backend/`:

```bash
uvicorn app.main:app --reload
```

API docs: `http://localhost:8000/docs`.

---

# Part B — React frontend

## 17. Create React app

From the project root (not inside `backend/`):

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install axios react-router-dom
```

Create `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:8000
```

Copy to `.env`. Never put API secrets in Vite environment variables; browser variables are public.

## 18. API client

Create `src/api/client.js`:

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

export default api;
```

## 19. Main app and routes

Create `src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ClaimForm from "./pages/ClaimForm";
import Claims from "./pages/Claims";
import ClaimDetail from "./pages/ClaimDetail";
import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <header className="topbar">
        <Link to="/" className="brand">Accident Assessment</Link>
        <nav><Link to="/">Claims</Link><Link to="/new">New claim</Link></nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Claims />} />
          <Route path="/new" element={<ClaimForm />} />
          <Route path="/claims/:id" element={<ClaimDetail />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
```

## 20. Claim submission page

Create `src/pages/ClaimForm.jsx`:

```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function ClaimForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    claimant_name: "", email: "", vehicle_number: "",
    vehicle_make: "", vehicle_model: "", vehicle_year: "",
    incident_date: "", incident_description: "",
  });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(e) {
    setForm(current => ({ ...current, [e.target.name]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
      };
      const { data: claim } = await api.post("/api/claims", payload);

      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        await api.post(`/api/claims/${claim.id}/images`, body);
      }
      navigate(`/claims/${claim.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not submit claim.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Submit an accident claim</h1>
      <p className="muted">Enter incident details and upload clear vehicle photos.</p>
      <form className="panel form" onSubmit={submit}>
        {[
          ["claimant_name", "Your name", "text"],
          ["email", "Email", "email"],
          ["vehicle_number", "Vehicle registration", "text"],
          ["vehicle_make", "Vehicle make", "text"],
          ["vehicle_model", "Vehicle model", "text"],
          ["vehicle_year", "Vehicle year", "number"],
          ["incident_date", "Incident date", "date"],
        ].map(([name, label, type]) => (
          <label key={name}>
            {label}
            <input name={name} type={type} value={form[name]}
              onChange={update}
              required={!["vehicle_make", "vehicle_model", "vehicle_year"].includes(name)} />
          </label>
        ))}

        <label>
          Describe what happened
          <textarea name="incident_description" value={form.incident_description}
            onChange={update} minLength={10} required />
        </label>

        <label>
          Vehicle photographs (up to 8, JPEG/PNG/WEBP)
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple
            onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 8))} />
        </label>
        <p className="muted">{files.length} image(s) selected.</p>

        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? "Submitting…" : "Submit claim"}</button>
      </form>
    </section>
  );
}
```

## 21. Claims list page

Create `src/pages/Claims.jsx`:

```jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/claims")
      .then(({ data }) => setClaims(data))
      .catch(() => setError("Could not load claims."));
  }, []);

  return (
    <section>
      <div className="page-heading">
        <div><h1>Claims</h1><p className="muted">Accident assessment workspace</p></div>
        <Link className="button-link" to="/new">Create claim</Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        {claims.length === 0 ? <p>No claims submitted yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Claim</th><th>Vehicle</th><th>Date</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {claims.map(claim => (
                  <tr key={claim.id}>
                    <td>#{claim.id} · {claim.claimant_name}</td>
                    <td>{claim.vehicle_number}</td>
                    <td>{claim.incident_date}</td>
                    <td><span className="status">{claim.status}</span></td>
                    <td><Link to={`/claims/${claim.id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
```

## 22. Claim detail and assessor review

Create `src/pages/ClaimDetail.jsx`:

```jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";

export default function ClaimDetail() {
  const { id } = useParams();
  const [claim, setClaim] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [c, a] = await Promise.all([
      api.get(`/api/claims/${id}`),
      api.get(`/api/claims/${id}/assessment`),
    ]);
    setClaim(c.data);
    setAssessment(a.data);
  }

  useEffect(() => {
    refresh().catch(() => setMessage("Could not load claim."));
  }, [id]);

  async function analyze() {
    setMessage("Running analysis…");
    try {
      const { data } = await api.post(`/api/claims/${id}/analyze`);
      setMessage(data.analysis.message || "Analysis request completed.");
      await refresh();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Analysis failed.");
    }
  }

  async function saveReview() {
    try {
      await api.patch(`/api/claims/${id}/review`, {
        reviewer_notes: notes,
        decision: "assessed",
      });
      setMessage("Review saved.");
      await refresh();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Could not save review.");
    }
  }

  if (!claim) return <p>{message || "Loading claim…"}</p>;

  let report = null;
  try {
    report = assessment?.findings_json
      ? JSON.parse(assessment.findings_json) : null;
  } catch {
    report = null;
  }

  return (
    <section>
      <h1>Claim #{claim.id}</h1>
      <div className="panel">
        <h2>Incident details</h2>
        <p><b>Customer:</b> {claim.claimant_name}</p>
        <p><b>Vehicle:</b> {claim.vehicle_make} {claim.vehicle_model} ({claim.vehicle_number})</p>
        <p><b>Incident date:</b> {claim.incident_date}</p>
        <p>{claim.incident_description}</p>
        <p><b>Status:</b> {claim.status}</p>
      </div>

      <div className="panel">
        <h2>AI assessment</h2>
        <p className="muted">Preliminary observations only. Human verification is required.</p>
        <button onClick={analyze}>Run image analysis</button>
        {report && <pre className="report">{JSON.stringify(report, null, 2)}</pre>}
        {assessment?.limitations && <p className="muted">{assessment.limitations}</p>}
      </div>

      <div className="panel">
        <h2>Assessor review</h2>
        <label>Review notes
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Record verified observations, missing evidence and next steps." />
        </label>
        <button onClick={saveReview} disabled={!notes.trim()}>Save review</button>
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
```

## 23. Styling

Create `src/styles.css`:

```css
:root {
  font-family: Inter, system-ui, Arial, sans-serif;
  color: #172033;
  background: #f4f6fa;
}
* { box-sizing: border-box; }
body { margin: 0; }
a { color: #2457c5; text-decoration: none; }
a:hover { text-decoration: underline; }
.topbar {
  min-height: 64px; padding: 0 5%; background: #fff;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #e4e8f0;
}
.brand { color: #172033; font-weight: 750; }
nav { display: flex; gap: 22px; }
.container { max-width: 1080px; margin: 36px auto; padding: 0 20px; }
h1 { margin: 0 0 8px; font-size: 30px; }
h2 { font-size: 19px; margin-top: 0; }
.muted { color: #667085; }
.panel {
  background: white; border: 1px solid #e5e9f1; border-radius: 14px;
  padding: 22px; margin: 20px 0; box-shadow: 0 3px 14px #15213a08;
}
.form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
label { display: grid; gap: 7px; font-size: 14px; font-weight: 600; }
input, textarea {
  width: 100%; border: 1px solid #cfd6e2; border-radius: 8px;
  padding: 11px 12px; font: inherit; background: white;
}
textarea { min-height: 110px; resize: vertical; }
.form label:has(textarea), .form label:has(input[type="file"]),
.form button, .form .error { grid-column: 1 / -1; }
button, .button-link {
  border: 0; border-radius: 8px; padding: 11px 16px;
  background: #2457c5; color: white; font-weight: 650; cursor: pointer;
  display: inline-block; width: fit-content;
}
button:disabled { opacity: .55; cursor: not-allowed; }
.page-heading { display: flex; justify-content: space-between; align-items: center; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; text-align: left; }
th, td { padding: 13px 10px; border-bottom: 1px solid #edf0f5; }
.status { background: #eef3ff; padding: 5px 9px; border-radius: 20px; }
.error { color: #b42318; }
.report {
  white-space: pre-wrap; overflow-wrap: anywhere;
  background: #f6f7fa; padding: 14px; border-radius: 8px;
}
@media (max-width: 680px) {
  .form { grid-template-columns: 1fr; }
  .form label, .form button, .form .error { grid-column: 1; }
  .page-heading { align-items: flex-start; gap: 14px; flex-direction: column; }
  .topbar { padding: 0 18px; }
}
```

Ensure `src/main.jsx` renders the app:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

---

# Part C — Run and verify

## 24. Start both applications

Terminal 1:

```bash
cd ai-accident-assessment/backend
# Activate .venv first
uvicorn app.main:app --reload
```

Terminal 2:

```bash
cd ai-accident-assessment/frontend
npm run dev
```

Open the frontend URL printed by Vite (usually `http://localhost:5173`). API documentation is at `http://localhost:8000/docs`.

## 25. End-to-end smoke test

1. Submit a fictional demo claim.
2. Upload one or more test images (JPEG, PNG or WEBP).
3. Confirm the claim appears in the claims list.
4. Open the claim detail page.
5. Click **Run image analysis**.
6. Confirm the app clearly states that the real model is not configured.
7. Add assessor notes and save the review.
8. Confirm the claim status updates.
9. Restart the backend and verify claim data persists.

This verifies the web workflow, not the accuracy of an AI model.

---

# Part D — AI model development

## 26. Dataset and labels

Use only datasets you are permitted to use. Check licences and consent conditions, especially if the project may be commercial.

Suggested labels:

**Vehicle parts:** bumper, bonnet, door, fender, windshield, headlamp, tail lamp, mirror, wheel.

**Damage classes:** scratch, dent, crack, broken, missing.

**Optional metadata:** severity under a written annotation guide, image angle, lighting, blur, occlusion and vehicle type.

Split by accident or vehicle, not randomly by individual image, so near-duplicate views from one accident do not leak across training and test sets.

## 27. Model pipeline

```text
Uploaded image
   |
   v
Image quality checks
   |---- unusable ----> Ask for another photo
   v
Vehicle part / damage detector
   |
   v
Confidence and threshold checks
   |---- uncertain ----> Human review
   v
Visible findings + annotated image
   |
   v
Assessor verifies or corrects findings
```

A practical first model can use object detection; segmentation can be added when you need more precise damage boundaries. Select a model framework and checkpoint only after checking its licence and dataset compatibility.

## 28. Model integration contract

Keep model output independent of the specific framework:

```json
{
  "model_status": "completed",
  "model_version": "your-model-version",
  "detections": [
    {
      "part": "left_front_door",
      "damage_type": "dent",
      "confidence": 0.82,
      "box": [0.1, 0.2, 0.5, 0.7]
    }
  ],
  "image_quality": {
    "usable": true,
    "warnings": []
  },
  "requires_human_review": true
}
```

Document whether box coordinates are normalized (0–1) or pixels. Store model version, inference time, image IDs, output and assessor corrections. Preserve assessment history rather than silently overwriting earlier results.

---

# Part E — Testing, security and deployment

## 29. Testing checklist

### Backend

- [ ] Valid claim creation succeeds.
- [ ] Invalid or missing fields are rejected.
- [ ] Unknown claim returns 404.
- [ ] Empty, corrupt, oversized and unsupported files are rejected.
- [ ] More than eight images are rejected.
- [ ] Images are not publicly accessible.
- [ ] Analysis without images returns a useful error.
- [ ] Placeholder is never presented as a real prediction.
- [ ] Review notes persist.
- [ ] Users cannot access other users' claims after authentication is implemented.

### Frontend

- [ ] Form validation works.
- [ ] File count and file types are clear.
- [ ] Loading and error states are visible.
- [ ] Claims list and detail pages work.
- [ ] Assessment is labelled preliminary.
- [ ] Empty review notes cannot be saved.
- [ ] Layout works on mobile and desktop.
- [ ] Keyboard navigation and focus states are usable.

### AI

- [ ] Evaluate on a held-out dataset.
- [ ] Measure precision and recall for each damage class.
- [ ] Inspect false positives and false negatives.
- [ ] Evaluate lighting, camera angles, vehicle types and severity groups.
- [ ] Test blurry, dark, obstructed and out-of-scope photos.
- [ ] Route uncertain cases to human review.
- [ ] Do not claim unmeasured accuracy.

## 30. Security and privacy before real use

The sample is a learning MVP, not production-secure. Before processing real customer data:

1. Add authentication and role-based access (customer, assessor, administrator).
2. Enforce claim ownership on every claim/image endpoint.
3. Use HTTPS.
4. Store images privately; use short-lived signed URLs when appropriate.
5. Validate file contents, size, dimensions and format on the server.
6. Generate storage names; never use a user filename as a filesystem path.
7. Add upload quotas, rate limits and request-size limits.
8. Encrypt data in transit and at rest.
9. Define consent, retention and deletion policies.
10. Add audit trails for access, model results and human edits.
11. Avoid logging personal information, policy numbers or image contents.
12. Obtain legal/privacy review for the jurisdictions where the product will operate.
13. Monitor model performance and investigate errors or bias.

## 31. Deployment direction

**Development:** Vite frontend, Uvicorn backend, SQLite database and local uploads folder.

**Production direction:**

- Frontend: static hosting.
- Backend: containerized FastAPI service.
- Database: managed PostgreSQL.
- Images: private S3-compatible object storage.
- Long-running inference: background queue/worker rather than a long synchronous HTTP request.
- Secrets: deployment secret manager.
- Monitoring: structured logs, error tracking, health checks and model monitoring.

Use Alembic migrations for production schema changes instead of relying on `Base.metadata.create_all()`. Configure CORS to the exact deployed frontend origin and back up the database.

Create `.gitignore`:

```gitignore
.venv/
__pycache__/
*.py[cod]
.env
*.db
uploads/
node_modules/
dist/
.DS_Store
```

---

## 32. Suggested project demonstration

1. Explain the problem: manual vehicle damage review takes time.
2. Submit a fictional claim and accident photos.
3. Show server-side image validation.
4. Run the damage model and show detections only after a real model is integrated.
5. Explain each finding with part, damage class, confidence and highlighted region.
6. Demonstrate the assessor correcting or confirming observations.
7. Show a report with evidence, limitations and review status.
8. Explain that final claim decisions remain with qualified insurance staff.

Dashboard metrics should be calculated from actual test or operational data: claims submitted, claims awaiting review, average time to first review, re-upload rate, model precision/recall and manual-review rate. Do not invent accuracy, time savings or financial impact.

## 33. MVP acceptance criteria

The first version is ready for a project demo when:

- A user can submit a claim and upload photographs.
- Backend validates images and associates them with the correct claim.
- Claims persist after backend restart.
- Analysis endpoint clearly reports placeholder status until a real model is configured.
- Integrated model returns versioned findings and confidence values.
- Assessor can save review notes.
- UI communicates uncertainty and human-review requirements.
- Main success and failure paths are tested.
- Another developer can run the app using the setup guide.

## 34. Recommended implementation order

1. Build the FastAPI claim, image and review APIs.
2. Build React claim form, list and detail pages.
3. Complete an end-to-end workflow using the placeholder adapter.
4. Select a licensed dataset and define damage labels.
5. Train and evaluate a real computer-vision model.
6. Integrate inference and annotated-image output.
7. Add authentication, authorization and private cloud storage.
8. Deploy, monitor and improve using assessor feedback.

**Key principle:** Build a reliable claims workflow first. Add computer vision as an assistive component only after it has been properly trained and evaluated. Good evidence handling, human review and honest communication of uncertainty are as important as the model.
