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

## 🌐 All-in-One Free Cloud Hosting (Recommended)

You can host **both Frontend and Backend together in ONE place** on [Render.com](https://render.com) for 100% free!

### Why All-in-One Hosting is Best:
- **0 CORS Errors:** Both React UI and Python API run on the exact same domain.
- **0 Cookie Issues:** Secure HttpOnly session cookies are accepted by 100% of browsers (no cross-site cookie blocking).
- **Single Free Service:** No need to configure Vercel or manage two separate cloud services.

### Simple Render Setup:
1. Connect your repository `https://github.com/prasanthmpp2/HireMind-AI` to Render as a **Web Service**.
2. **Root Directory**: `backend`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `gunicorn -w 2 -b 0.0.0.0:$PORT run:app`
5. **Environment Variables**:
   - `FLASK_ENV`: `production`
   - `FLASK_SECRET_KEY`: `<Any 32-character secure secret>`
   - `AI_PROVIDER`: `groq` (or `huggingface`)
   - `GROQ_API_KEY`: `<Your Groq Key>`
6. **Deploy**:
   Open your Render URL (e.g. `https://hiremind-backend-5qg0.onrender.com/`). The complete React UI, Candidate Portal, Recruiter Studio, and APIs are live immediately!

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
