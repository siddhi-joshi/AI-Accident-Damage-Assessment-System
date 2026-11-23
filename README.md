# Accord accident assessment

A local, end-to-end accident claims workspace built with FastAPI, SQLite, React and Vite. The interface follows the palette, light typography, rounded cards and pill actions in `DESIGN-mercury.md`.

## What works

- Submit a claim with claimant, vehicle and incident details.
- Upload and preview up to eight JPEG, PNG or WEBP photos per claim. The backend validates the actual image content and dimensions, converts uploads to JPEG and strips metadata.
- Browse, search and filter saved claims. Data persists in SQLite across restarts.
- Request image analysis and view an honest `not_configured` result until a trained and evaluated damage model is connected. The adapter is in `backend/app/services/damage_analyzer.py`.
- Record assessor notes and a review status. A simple audit table records claim creation, uploads, analysis requests and review saves.
- See the repair estimate unavailable state until a verified regional price catalogue is connected.

**Use fictional data only.** This is a local demo and has no authentication or ownership checks. Do not deploy it or process real customer claims as-is. The image endpoint is available to anyone who can reach the local API. Add authentication, authorization, private object storage, HTTPS, retention controls, migrations and operational monitoring before real use. An image result must never be used alone to approve or reject a claim.

## Run locally

Requires Python 3.11+ and Node.js 20+.

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8011
```

Copy `.env.example` to `.env` if you need to change the default database URL, upload folder, size limit, or CORS origin. The API runs at `http://127.0.0.1:8011`; interactive docs are at `/docs`.

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the backend. To connect a separately hosted API, set `VITE_API_URL` in `frontend/.env` before building.

## Verify

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q
cd ..\frontend
npm run build
```

For a manual smoke test: create a fictional claim, upload a photo, run analysis, confirm the model is reported as unconfigured, save review notes, and reload the claim page to confirm persistence.

## Model integration

`analyze_vehicle_damage(image_paths)` is the model boundary. A real adapter should return a version, normalized boxes, damage/part labels, confidence, image references and quality warnings. Train and evaluate on a licensed dataset split by vehicle or incident. Keep human review mandatory and store model/version history before enabling real detections. The current adapter never fabricates damage findings or confidence values.
