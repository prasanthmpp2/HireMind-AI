# HireMind AI — Intelligent HR Recruitment Assistant

An enterprise-ready AI HR Recruitment Assistant powered by **Python LangGraph**, **Groq LLM** (LLaMA 3.3 70B / 3.1 8B), **ChromaDB** vector database, and **Flask**.

---

## 🌟 Key Features

1. **Resume Screening & Ingestion (LangGraph `ScreeningGraph`)**:
   - Single and batch upload of candidate resumes in `.pdf`, `.docx`, and `.txt` formats.
   - Intelligent extraction of personal information, contact links (GitHub, LinkedIn, portfolio), education, categorized skills (technical, frameworks, tools, soft), work history, projects, and certifications.
   - Vector indexing into **ChromaDB** for dense semantic retrieval.

2. **Resume ↔ Job Description Matching (LangGraph `MatchingGraph`)**:
   - HR enters or loads Job Descriptions with required and nice-to-have skills.
   - Multi-stage matching:
     - **Semantic Cosine Similarity**: Vector comparison using ChromaDB embeddings / Online Sentence Transformers (`sentence-transformers/all-MiniLM-L6-v2`).
     - **Structured Skill Overlap**: Exact and semantic taxonomy matching to find matched competencies and critical skill gaps.
     - **Experience Alignment**: Seniority and duration scoring against role requirements.
     - **Explainable AI Ranking**: Weighted composite score, recommendation tier (`Strongly Recommended`, `Recommended`, `Review`, `Not Recommended`), key strengths, interview probe areas, and recruiter decision rationale.

3. **AI Interview Studio (LangGraph `InterviewGraph`)**:
   - Synthesizes 4 distinct, customized categories of interview questions:
     - **Technical Questions**: Deep conceptual and architectural questions on core JD technologies with good answer indicators and red flags.
     - **Resume-Based Probes**: Questions challenging specific projects, claimed architectures, metrics, and production accomplishments.
     - **Skill Gap Probes**: Evaluates candidate learning agility and adaptability for missing/unverified skills.
     - **Behavioral Questions**: STAR-format situational scenarios (conflict, deadline pressure, technical failures).
   - Recruiter evaluation rubrics with 5-point scoring scale and weighting guidelines.
   - One-click **Copy as Markdown** and **Print / Save as PDF** interview sheets.

---

## 🏗️ Architecture

```text
                    HIREMIND AI ARCHITECTURE
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                   ▼
      Job Descriptions                        Resumes
       (CRUD & Embed)                   (PDF, DOCX, TXT)
             │                                   │
             └─────────────────┬─────────────────┘
                               ▼
                    LangGraph Workflow Engine
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   Screening Graph       Matching Graph      Interview Graph
   • Document parse     • ChromaDB vector   • Technical depth
   • Groq extraction      similarity        • Resume claims
   • ChromaDB index     • Skill overlap     • Skill gap probes
   • SQLite store       • Seniority score   • STAR behavioral
                        • Explainable AI    • Scoring rubrics
                               │
                               ▼
                     Flask REST API Core
              (SQLAlchemy ORM + ChromaDB Client)
                               │
                               ▼
                     Interactive Web UI
   • Dashboard Overview • Job Manager • Batch Screening
   • Match Leaderboard • Deep-Dive Modal • Interview Studio
```

---

## 🚀 Getting Started

### 1. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and fill in your API keys:
```env
# Hugging Face gpt-oss-120b primary chat provider (server-side only)
AI_PROVIDER=huggingface
HF_TOKEN=your_huggingface_access_token
HF_MODEL=openai/gpt-oss-120b
HF_PROVIDER=fireworks-ai
LLM_TIMEOUT_SECONDS=30

# Optional Groq provider configuration (set AI_PROVIDER=groq to use it)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=llama-3.1-8b-instant

# ChromaDB & Online Sentence Transformer Configuration
CHROMA_PERSIST_DIR=./chroma_db
SENTENCE_TRANSFORMER_MODEL=sentence-transformers/all-MiniLM-L6-v2
USE_ONLINE_EMBEDDINGS=true
# Optional: HuggingFace API key for online Sentence Transformer inference service
HUGGINGFACE_API_KEY=your_huggingface_token_here

# Database Configuration (SQLite default, MySQL optional)
DATABASE_URL=sqlite:///hiremind.db
```

> **Note**: With `AI_PROVIDER=huggingface`, missing credentials or provider errors are reported explicitly and structured workflows may use their documented deterministic/template fallback. The fallback is marked in response metadata and is never presented as a verified model response. Set `AI_PROVIDER=groq` to use Groq instead.

For the Hugging Face path, the backend uses `huggingface_hub.InferenceClient` Chat Completions. `HF_TOKEN` is passed only to the Flask process. `HF_MODEL` identifies `openai/gpt-oss-120b`; `HF_PROVIDER` selects the Inference Provider (default `fireworks-ai`). Provider/model metadata is returned by AI endpoints and missing credentials or provider errors produce explicit unavailable/fallback responses. Do not place the token in frontend `.env` files.

## Account authentication

Public registration creates candidate accounts only. Provision elevated users with `python -m flask --app run.py create-user --email recruiter@example.com --role recruiter` or `--role admin`; the command prompts for a password of at least 12 characters. Authentication uses opaque database-backed sessions in an HttpOnly cookie. The browser receives a separate CSRF token and sends it in `X-CSRF-Token`; neither session nor CSRF credentials are stored in localStorage. In production set `AUTH_COOKIE_SECURE=true`, serve over HTTPS, use a strong `FLASK_SECRET_KEY`, configure exact `FRONTEND_ORIGINS`, and keep the API and frontend on trusted origins.

Recruiters see only jobs and screened candidate records they own. Admins can access all tenants. Candidates can access only their own structured resume drafts and account deletion. Deleting a candidate removes related parsed resumes, drafts, matches, and interview kits by database cascades and removes its vector record; deleting a job removes its related match/interview records and job vector. Uploaded files are temporary and removed after each screening attempt. Parsed resume content and generated reports remain in the database until account/candidate deletion. Run `python -m flask --app run.py prune-auth-data` periodically to remove expired sessions and old login-throttle entries.

### 2. Activate Virtual Environment

```bash
source venv/bin/activate
```

### 3. Seed Sample Data (Optional)

Pre-load sample job descriptions, candidate resumes, evaluations, and an interview kit:
```bash
python seed_data.py
```

### 4. Run the Application

```bash
python run.py
```

Open your browser and navigate to:
```
http://localhost:5001
```

---

## 🧪 Running Tests

Run the complete test suite (Unit tests, LangGraph workflows, and Flask API integration tests):

```bash
python -m unittest discover tests
```

---

## 📁 Project Structure

```text
Ai HR Recritment Assistant/
├── .env.example                 # Environment configuration template
├── config.py                    # Application settings & environment loader
├── run.py                       # Server entry point (http://localhost:5001)
├── seed_data.py                 # Initial data seeder script
├── requirements.txt             # Python dependencies
├── app/
│   ├── __init__.py              # Flask app factory and route registration
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── __init__.py          # DB wrapper and session handling
│   │   ├── job.py               # JobDescription model
│   │   ├── candidate.py         # Candidate & ResumeData models
│   │   ├── match.py             # MatchResult model
│   │   └── interview.py         # InterviewKit model
│   ├── services/                # Core business services
│   │   ├── parser_service.py    # PDF and DOCX extraction utilities
│   │   ├── vector_service.py    # ChromaDB & Online Sentence Transformer integration
│   │   └── groq_client.py       # Groq API client with structured JSON parsing
│   ├── graphs/                  # LangGraph Workflow Pipelines
│   │   ├── state.py             # TypedDict state definitions
│   │   ├── screening_graph.py   # Resume parsing & extraction state graph
│   │   ├── matching_graph.py    # Candidate-JD matching & explainable AI graph
│   │   └── interview_graph.py   # AI interview question generation graph
│   ├── routes/                  # API and Web Blueprints
│   │   ├── web_routes.py        # Web page routes (/, /jobs, /screening, etc.)
│   │   ├── job_routes.py        # Job CRUD API endpoints
│   │   ├── resume_routes.py     # Batch upload & screening API endpoints
│   │   ├── match_routes.py      # Matching & leaderboard API endpoints
│   │   └── interview_routes.py  # Interview kit generation API endpoints
│   ├── static/                  # Static assets
│   │   ├── css/style.css        # Modern SaaS styling & badges
│   │   └── js/                  # Modular client scripts
│   │       ├── main.js          # Toast alerts & loading overlays
│   │       ├── jobs.js          # Job creation & template loader
│   │       ├── screening.js     # Drag-and-drop resume upload & screening
│   │       ├── matching.js      # Leaderboard table & deep-dive modal
│   │       └── interview.js     # Interview question tabs, copy & print
│   └── templates/               # Jinja2 HTML templates
│       ├── base.html            # Base layout with sidebar
│       ├── index.html           # Recruiter dashboard overview
│       ├── jobs.html            # Job openings manager
│       ├── screening.html       # Resume batch ingestion view
│       ├── matching.html        # Candidate matching leaderboard
│       └── interview.html       # Interview question studio
├── sample_data/                 # Sample JDs, PDF and DOCX test resumes
└── tests/                       # Test suite
    ├── test_parser.py           # Parser unit tests
    ├── test_graphs.py           # LangGraph pipeline tests
    └── test_api.py              # Flask API integration tests
```

# Ai_HR_Recruiter
