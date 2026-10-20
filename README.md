# HireMind AI — All-in-One AI Recruitment & Resume Intelligence Platform

HireMind AI is an enterprise-grade recruitment platform unifying an **Interactive Candidate Resume Studio** and an **AI-Powered Recruiter Command Center** into a single cohesive system.

- **Candidate Portal**: Build, edit, score, optimize, and export ATS-ready resumes with real-time feedback and offline/online AI enhancements.
- **Recruiter Command Center**: Vectorized Job Openings, Batch Resume Screening (PDF/DOCX/TXT), Semantic Vector Matching & Leaderboard Ranking, and AI Interview Question Generation.
- **Hybrid AI Engine**: Runs seamlessly online (via Groq / HuggingFace LLM APIs) or 100% offline (with built-in NLP heuristics, local vector database, and rule-based extractors).

---

## Architecture Overview

```
HireMind-AI/
├── frontend/             # React 18 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── features/     # Recruiter Hub, Candidate Dashboard, Resume Builder
│   │   ├── components/   # UI components, modals, visualizers
│   │   └── api/          # Unified API client & type definitions
│   └── package.json
├── backend/              # Python 3.10+ Flask + SQLAlchemy + LangGraph + ChromaDB
│   ├── app/              # Routes, services, models, migrations, schemas
│   ├── sample_data/      # Pre-built sample resumes and job templates
│   ├── run.py            # Entry point and Flask CLI commands
│   ├── seed_data.py      # Database seeder with professional sample data
│   └── requirements.txt
└── DEPLOYMENT.md         # Production deployment, secrets & operations guide
```

---

## 🚀 Running Offline (Local Machine)

HireMind AI is designed so that you can run it entirely on your local machine with zero external cloud API dependencies. If no API key is provided, the backend automatically uses its local NLP/heuristic parser and local ChromaDB store.

### Prerequisites
- **Node.js**: v18 or v20+ (`node -v`)
- **Python**: v3.10, 3.11, or 3.12 (`python --version`)
- **Git**

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/prasanthmpp2/HireMind-AI.git
cd HireMind-AI
```

---

### Step 2: Backend Setup (Terminal 1)

1. Open PowerShell / Bash and navigate to `backend/`:
   ```powershell
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```powershell
   # Windows PowerShell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS
   # python3 -m venv .venv
   # source .venv/bin/activate
   ```

3. Install dependencies:
   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```powershell
   Copy-Item .env.example .env
   # Linux/macOS: cp .env.example .env
   ```
   *Edit `.env` (Optional)*: Set `FLASK_SECRET_KEY=local-dev-secret-key-1234567890`.
   If you have a Groq or HuggingFace token, you can add it to `.env` (`AI_PROVIDER=groq`, `GROQ_API_KEY=gsk_...`). If left blank, offline heuristics will activate automatically!

5. Initialize & Seed Professional Demo Data (Optional but recommended):
   ```powershell
   python seed_data.py
   ```
   *This seeds 4 professional job postings and screened candidates into your local database.*

6. Create a Recruiter Admin Account (if not using seed data):
   ```powershell
   python -m flask --app run.py create-user --email recruiter@hiremind.ai --role recruiter
   # Enter password (min 12 chars), e.g.: Recruiter@2026Secure
   ```

7. Start the Backend Server:
   ```powershell
   python run.py
   ```
   Backend will start on: **`http://localhost:5001`** (Health check: `http://localhost:5001/api/v1/health`).

---

### Step 3: Frontend Setup (Terminal 2)

1. Open a new terminal and navigate to `frontend/`:
   ```powershell
   cd frontend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Configure environment:
   ```powershell
   Copy-Item .env.example .env
   # Linux/macOS: cp .env.example .env
   ```
   In local development, the Vite server proxies `/api/v1` calls directly to `http://localhost:5001`, so no extra proxy config is required!

4. Start Vite development server:
   ```powershell
   npm run dev
   ```
   Open your browser at: **`http://localhost:5173`**

---

### Step 4: Login & Access

- **Recruiter Workspace**: Login at `http://localhost:5173/auth` using your recruiter account (`recruiter@hiremind.ai`).
- **Candidate Portal**: Register a new candidate account directly at `http://localhost:5173/auth`.

---

## 🌐 Online Hosting (Cloud Production Deployment)

You can host HireMind AI online for free or low cost using standard cloud platforms:

| Component | Recommended Hosts | Free Tier Available? |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) / [Netlify](https://netlify.com) / [Render Static](https://render.com) | ✅ Yes (Unlimited / Generous) |
| **Backend** | [Render](https://render.com) (Web Service) / [Railway](https://railway.app) / [Fly.io](https://fly.io) | ✅ Yes |
| **Database** | Managed PostgreSQL (Render / Supabase / Neon) or persistent disk SQLite | ✅ Yes |

---

### Option A: Deploying Backend to Render / Railway

1. **Connect GitHub**:
   - Create an account on [Render.com](https://render.com) or [Railway.app](https://railway.app).
   - Select **New Web Service** and connect your repository: `https://github.com/prasanthmpp2/HireMind-AI`.

2. **Configure Service Settings**:
   - **Root Directory**: `backend`
   - **Environment / Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     gunicorn -w 2 -b 0.0.0.0:$PORT run:app
     ```

3. **Set Environment Variables on Cloud Dashboard**:
   - `FLASK_ENV`: `production`
   - `FLASK_SECRET_KEY`: `<Generate a random 32+ character secure string>`
   - `FRONTEND_ORIGINS`: `https://your-frontend.vercel.app` (Your actual frontend domain)
   - `AUTH_COOKIE_SECURE`: `true`
   - `AI_PROVIDER`: `groq` (or `huggingface`)
   - `GROQ_API_KEY`: `your-groq-api-key`
   - *(Optional for PostgreSQL)*: `DATABASE_URL`: `postgresql://user:pass@host/dbname`

4. Copy your backend service URL (e.g., `https://hiremind-backend.onrender.com`).

---

### Option B: Deploying Frontend to Vercel / Netlify

1. **Import Project**:
   - Go to [Vercel.com](https://vercel.com), click **Add New Project** and select `HireMind-AI`.

2. **Configure Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Set Environment Variables in Vercel**:
   - `VITE_API_BASE_URL`: `https://hiremind-backend.onrender.com/api/v1`
     *(Point this to your deployed backend URL + `/api/v1`)*

4. **Deploy**:
   - Click **Deploy**. Your React frontend will be live at `https://hiremind-ai.vercel.app`.

---

## 🧪 Testing & Verification

- **Frontend Tests**:
  ```powershell
  cd frontend
  npm test -- --run
  npm run lint
  ```
- **Backend Tests**:
  ```powershell
  cd backend
  python -m unittest discover -s tests -v
  ```

---

## 📜 License & Author

Developed by **Prasanth** ([@prasanthmpp2](https://github.com/prasanthmpp2)) — Built with React, Flask, LangGraph, and Tailwind CSS.
