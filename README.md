# MIRROR — Emergency Response Decision Twin

> **"What will happen if we take this action?"**

MIRROR is an emergency digital twin designed to simulate and compare the consequences of response actions before execution.

## Free-Tier Cloud Deployment
The repository is completely configured for **100% Free-Tier Deployment** ($0, no credit card required):
- **Backend (Python / FastAPI)**: [Render Free Web Service](https://render.com) using [`render.yaml`](./render.yaml).
- **Frontend (Next.js 14 / TypeScript)**: [Vercel Hobby Tier](https://vercel.com) using [`frontend/vercel.json`](./frontend/vercel.json).

Full deployment instructions are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Local Development

### 1. Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
pytest tests/ -v
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Tactical Emergency Mission Command.
