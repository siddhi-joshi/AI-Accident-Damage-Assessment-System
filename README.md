# Accord accident assessment

A local, end-to-end accident claims workspace built with FastAPI, SQLite, React and Vite. The interface follows the palette, light typography, rounded cards and pill actions in `DESIGN-mercury.md`.

## What works

- Submit a claim with claimant, vehicle and incident details.
- Upload and preview up to eight JPEG, PNG or WEBP photos per claim. The backend validates the actual image content and dimensions, converts uploads to JPEG and strips metadata.
- Browse, search and filter saved claims. Data persists in SQLite across restarts.
- Send uploaded photos to Gemini for preliminary visual damage observations. The adapter is in `backend/app/services/damage_analyzer.py`.
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

Add your key to `backend/.env` (create the file from `.env.example` if needed):

```env
GEMINI_API_KEY=your_key_from_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
```

Restart the backend after changing `.env`. The key stays on the server and is sent to Google in the `x-goog-api-key` header; never put it in `frontend/.env` or commit it. Clicking **Run Gemini analysis** sends resized copies of the claim photos to the Gemini API. The API runs at `http://127.0.0.1:8011`; interactive docs are at `/docs`.

If analysis returns HTTP 429, Gemini has reached a quota or rate limit for the API key's project. Check the selected model's usage and limits in Google AI Studio and retry after the limit resets. The app does not automatically retry a 429.

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

For a manual smoke test: create a fictional claim, upload a photo, run analysis with a configured key, inspect the visible findings and uncertainties, save review notes, and reload the claim page to confirm persistence.

## Model integration

`analyze_vehicle_damage(image_paths)` calls Gemini's image understanding API and validates the returned JSON. Gemini gives visual observations, not calibrated damage-detection confidence, verified bounding boxes, or a repair quote. The UI shows visible findings, uncertainty, photo quality notes, and suggested next steps. Human review remains mandatory. For insurer-grade automated detection, train and evaluate a licensed model on a dataset split by vehicle or incident, then store versioned assessment history and assessor corrections.
