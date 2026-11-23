import io
import json as json_module

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.routers import assessments, images
from app.services import damage_analyzer


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
    monkeypatch.setattr(damage_analyzer.settings, "upload_dir", str(tmp_path / "uploads"))
    monkeypatch.setattr(damage_analyzer.settings, "gemini_api_key", SecretStr("test-key"))

    def fake_gemini(url, *, headers, json, timeout):
        assert "test-key" not in url
        assert headers["x-goog-api-key"] == "test-key"
        assert "Hyundai i20 2022" in json["contents"][0]["parts"][0]["text"]
        assert json["contents"][0]["parts"][2]["inlineData"]["mimeType"] == "image/jpeg"
        assert "visible_damage" in json["generationConfig"]["responseJsonSchema"]["properties"]
        result = {
            "overall_summary": "Visible damage near the front bumper.",
            "visible_damage": [{"image_index": 1, "part": "front bumper", "damage_type": "broken", "severity": "moderate", "description": "The bumper appears displaced."}],
            "image_quality_notes": ["Front view is usable."],
            "uncertainties": ["Hidden damage cannot be assessed."],
            "recommended_next_steps": ["Inspect the bumper in person."],
            "review_priority": "elevated",
        }
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json_module.dumps(result)}]}}]}, request=httpx.Request("POST", url))

    monkeypatch.setattr(damage_analyzer.httpx, "post", fake_gemini)
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
            assert analysis.json()["analysis"]["model_status"] == "completed"
            assert analysis.json()["analysis"]["detections"][0]["part"] == "front bumper"
            assert analysis.json()["estimate"]["available"] is False
            saved_assessment = client.get(f"/api/claims/{claim_id}/assessment").json()
            assert saved_assessment["findings"]["analysis"]["requires_human_review"] is True
            assert saved_assessment["model_version"] == "gemini-2.5-flash"

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

            def limit_reached(*args):
                raise damage_analyzer.AnalysisUnavailable("Gemini rate limit reached", status_code=429)

            monkeypatch.setattr(assessments, "analyze_vehicle_damage", limit_reached)
            assert client.post(f"/api/claims/{claim_id}/analyze").status_code == 429
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


def test_gemini_key_is_required(monkeypatch):
    monkeypatch.setattr(damage_analyzer.settings, "gemini_api_key", None)
    with pytest.raises(damage_analyzer.AnalysisUnavailable, match="GEMINI_API_KEY"):
        damage_analyzer.analyze_vehicle_damage(["unused.jpg"])


def test_gemini_provider_failure_is_safe(tmp_path, monkeypatch):
    path = tmp_path / "car.jpg"
    path.write_bytes(sample_image())
    monkeypatch.setattr(damage_analyzer.settings, "gemini_api_key", SecretStr("test-key"))

    def rate_limited(url, **kwargs):
        return httpx.Response(429, json={"error": "provider detail"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(damage_analyzer.httpx, "post", rate_limited)
    with pytest.raises(damage_analyzer.AnalysisUnavailable, match="rate limit") as error:
        damage_analyzer.analyze_vehicle_damage([str(path)])
    assert error.value.status_code == 429
    assert "provider detail" not in str(error.value)
