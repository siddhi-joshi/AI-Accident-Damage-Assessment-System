import io

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.routers import images


def sample_image(size=(320, 240)):
    output = io.BytesIO()
    Image.new("RGB", size, "#6577aa").save(output, format="PNG")
    return output.getvalue()


def payload():
    return {
        "claimant_name": "Demo Customer",
        "email": "demo@example.com",
        "vehicle_number": "MH 02 AB 1234",
        "vehicle_make": "Hyundai",
        "vehicle_model": "i20",
        "vehicle_year": 2022,
        "incident_date": "2026-01-10",
        "incident_description": "Rear bumper scraped in a parking incident.",
    }


def test_claim_to_review_workflow(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{(tmp_path / 'test.db').as_posix()}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    local_session = sessionmaker(bind=engine)

    def override_db():
        with local_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(images, "UPLOAD_DIR", tmp_path / "uploads")
    try:
        with TestClient(app) as client:
            created = client.post("/api/claims", json=payload())
            assert created.status_code == 201
            claim_id = created.json()["id"]
            assert client.get("/api/claims").json()[0]["id"] == claim_id
            assert client.get(f"/api/claims/{claim_id + 99}").status_code == 404
            assert client.post(f"/api/claims/{claim_id}/analyze").status_code == 400

            invalid = client.post(f"/api/claims/{claim_id}/images", files={"file": ("fake.png", b"not an image", "image/png")})
            assert invalid.status_code == 400
            small = client.post(f"/api/claims/{claim_id}/images", files={"file": ("small.png", sample_image((100, 100)), "image/png")})
            assert small.status_code == 400
            uploaded = client.post(f"/api/claims/{claim_id}/images", files={"file": ("car.png", sample_image(), "image/png")})
            assert uploaded.status_code == 201
            image_id = uploaded.json()["id"]
            photo = client.get(f"/api/claims/{claim_id}/images/{image_id}")
            assert photo.status_code == 200
            assert photo.headers["content-type"] == "image/jpeg"
            assert client.get(f"/api/claims/{claim_id}/images/{image_id + 1}").status_code == 404

            analysis = client.post(f"/api/claims/{claim_id}/analyze")
            assert analysis.status_code == 200
            assert analysis.json()["analysis"]["model_status"] == "not_configured"
            assert analysis.json()["analysis"]["detections"] == []
            assert analysis.json()["estimate"]["available"] is False
            assert client.get(f"/api/claims/{claim_id}/assessment").json()["findings"]["analysis"]["requires_human_review"] is True

            empty_review = client.patch(f"/api/claims/{claim_id}/review", json={"reviewer_notes": "   ", "decision": "assessed"})
            assert empty_review.status_code == 422
            review = client.patch(f"/api/claims/{claim_id}/review", json={"reviewer_notes": "Photo reviewed; request repairer inspection.", "decision": "assessed"})
            assert review.status_code == 200
            assert review.json()["reviewer_notes"] == "Photo reviewed; request repairer inspection."
            assert client.get(f"/api/claims/{claim_id}").json()["status"] == "assessed"

            for i in range(7):
                assert client.post(f"/api/claims/{claim_id}/images", files={"file": (f"car{i}.png", sample_image(), "image/png")}).status_code == 201
            ninth = client.post(f"/api/claims/{claim_id}/images", files={"file": ("extra.png", sample_image(), "image/png")})
            assert ninth.status_code == 400
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_invalid_claim():
    with TestClient(app) as client:
        bad = payload()
        bad["incident_description"] = "short"
        assert client.post("/api/claims", json=bad).status_code == 422
        bad = payload()
        bad["incident_date"] = "2099-01-01"
        assert client.post("/api/claims", json=bad).status_code == 422
