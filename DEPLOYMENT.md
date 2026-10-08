# MIRROR Zero-Cost Deployment Guide (Render + Vercel)

This repository is pre-configured for **100% Free-Tier Deployment** ($0, no credit card required):
- **Backend**: Render Free Web Service (FastAPI / Python 3.11)
- **Frontend**: Vercel Hobby Tier (Next.js 14)

---

## Part 1: Deploy Backend on Render (Free Web Service)

### Method A: Blueprint Deployment (Recommended)
1. Push this repository to your GitHub account.
2. Sign in to [Render.com](https://render.com).
3. Click **New +** > **Blueprint**.
4. Connect your GitHub repository.
5. Render detects [`render.yaml`](./render.yaml) automatically:
   - **Service Name**: `mirror-backend`
   - **Environment**: `Python`
   - **Root Directory**: `backend`
   - **Plan**: `free`
   - **Health Check Path**: `/health`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. (Optional) In the Environment variables prompt, add `GEMINI_API_KEY` if you wish to use live Gemini model inference (fallback heuristic is used automatically if omitted).
7. Click **Apply**.
8. Once deployed, copy your Render service URL:  
   `https://<your-service-name>.onrender.com`

### Method B: Manual Web Service Setup
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/health`

---

## Part 2: Deploy Frontend on Vercel (Hobby Free Tier)

1. Sign in to [Vercel](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import your GitHub repository.
4. Configure Project Settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
5. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Set to your Render backend API URL (e.g. `https://<your-service-name>.onrender.com/api`)
   - `NEXT_PUBLIC_MAPBOX_TOKEN`: *(Optional)* Your Mapbox public token. If omitted, MIRROR automatically switches to the built-in Tactical 2D Vector SVG Twin engine.
6. Click **Deploy**.

---

## Verification & Cold-Start Behavior

- **Fast Free Health Check**: `https://<your-render-url>.onrender.com/health` returns:
  ```json
  {"status": "ok", "service": "MIRROR-Simulation-Engine", "tier": "free"}
  ```
- **Cold-Start Resilience**:
  Render free web services spin down after 15 minutes of inactivity. When a request is triggered from Vercel:
  - If Render is warming up (~30-50s), the MIRROR frontend client automatically uses its calibrated offline consequence simulator, ensuring uninterrupted interactive demonstration.
  - As soon as the Render container is awake, all dynamic requests seamlessly route to the live FastAPI backend.
