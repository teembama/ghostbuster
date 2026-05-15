# GhostBuster - AI Ghost Worker Detection

> Detect payroll fraud in 30 seconds. Enforce real-time payment controls.

---

## The Problem

**₦2.2 billion is lost to ghost workers annually** in Nigerian payrolls. Fake names, duplicated bank accounts, and inflated headcounts drain government and enterprise budgets. Manual audits take months and miss most cases.

## The Solution

**GhostBuster** is an AI-powered payroll auditor that:

1. **Detects fraud in 30 seconds** — Upload a payroll CSV, our AI module flags ghost workers using duplicate-account detection, name-similarity scoring, attendance anomalies, and biometric mismatches.
2. **Enforces payment via Squad API** — Suspect entries are automatically blocked from disbursement until cleared. Clean entries pay out instantly.

One dashboard. One decision. Zero ghost workers.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), TailwindCSS |
| Backend API | FastAPI (Python) |
| AI / Detection | Python, pandas, scikit-learn |
| Database & Auth | Supabase (Postgres + Auth + Storage) |
| Payments | Squad API (disbursement + block controls) |
| Hosting | Vercel (frontend), Render/Fly (backend) |

---

## Team

| Role | Responsibilities | Owner |
|------|------------------|-------|
| Frontend | Next.js dashboard, upload flow, results UI, Supabase auth | TBD |
| Backend | FastAPI routes, Supabase integration, Squad API wiring | TBD |
| AI / Data | Ghost-detection model, synthetic data, evaluation | TBD |
| Product / Demo | Pitch deck, demo script, screenshots, video, judging | TBD |

---

## Quick Start

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_API_URL
npm run dev                   # http://localhost:3000
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in Supabase + Squad keys
uvicorn app.main:app --reload # http://localhost:8000
```

### AI Module

```bash
cd ai-module
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python generate_data.py       # creates generated_data/payroll_sample.csv
pytest tests/                 # run detection unit tests
```

---

## Architecture

```
                 +-------------------+
                 |   User (Auditor)  |
                 +---------+---------+
                           |
                  Upload payroll.csv
                           |
                           v
              +------------+------------+
              |   Next.js Frontend      |
              |   (Vercel)              |
              +------------+------------+
                           |
                  POST /api/audit
                           |
                           v
              +------------+------------+
              |   FastAPI Backend       |
              |   - Auth (Supabase)     |
              |   - Orchestration       |
              +-+----------+----------+-+
                |          |          |
       Store    |          | Detect   | Disburse / Block
       results  v          v          v
        +------+--+   +----+----+   +-+--------+
        |Supabase |   |AI Module|   |Squad API |
        |Postgres |   |(pandas) |   |          |
        +---------+   +---------+   +----------+
```

Flow: User uploads CSV → backend stores raw file in Supabase → AI module flags suspects → results written to Postgres → frontend renders verdict → auditor confirms → Squad pays clean entries, blocks ghosts.

---

## Live Links

- **Live demo**: _TBD_
- **API docs**: _TBD_ (FastAPI `/docs`)
- **Pitch deck**: `demo-assets/pitch-deck/`
- **Demo video**: `demo-assets/videos/`
- **Repo**: _TBD_

---

## Integration Checkpoints

Hackathon coordination — each checkpoint is a hard sync where all four roles must align.

- [ ] **CP1 — Contracts frozen** (Day 1, end of morning)
  CSV schema, `/audit` request/response JSON, Supabase tables agreed and documented in `docs/`.

- [ ] **CP2 — Frontend ↔ Backend wired** (Day 1, end of day)
  Mock detection returns hardcoded JSON; frontend renders the results page from real API.

- [ ] **CP3 — AI module live** (Day 2, morning)
  Real detection replaces the mock; sample CSV produces deterministic flags; tests pass.

- [ ] **CP4 — Squad API integrated** (Day 2, afternoon)
  Clean entries trigger sandbox disbursement; ghosts are blocked; receipts surfaced in UI.

- [ ] **CP5 — Demo lock** (Day 2, evening)
  Pitch deck, recorded video, screenshots, and live demo path frozen. No new features after this.

---

## Repo Layout

```
GhostBuster/
├── frontend/        Next.js app (dashboard, upload, results)
├── backend/         FastAPI service (orchestration, Supabase, Squad)
├── ai-module/       Detection logic, synthetic data, tests
├── docs/            Schemas, API contracts, decisions
└── demo-assets/     Pitch deck, screenshots, video
```
