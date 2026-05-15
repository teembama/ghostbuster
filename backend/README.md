# GhostBuster Backend

FastAPI service powering the GhostBuster ghost-employee detection platform.

## Stack

- **FastAPI** – HTTP API framework
- **Supabase** – Postgres database + auth
- **pandas / scikit-learn** – CSV ingestion and ML-based analysis
- **Squad** – payout / account verification (sandbox)

## Quick start

### 1. Prerequisites

- Python 3.11+
- A Supabase project (URL + anon key)
- A Squad sandbox API key (or set `MOCK_SQUAD=true` to skip)

### 2. Install dependencies

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable          | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `SUPABASE_URL`    | Your Supabase project URL                              |
| `SUPABASE_KEY`    | Supabase anon (or service) key                         |
| `SQUAD_API_KEY`   | Squad sandbox API key                                  |
| `SQUAD_BASE_URL`  | Squad API base URL (sandbox by default)                |
| `ENVIRONMENT`     | `development` / `production`                           |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins                           |
| `MOCK_SQUAD`      | `true` to short-circuit Squad calls with mocked data   |

### 4. Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at <http://localhost:8000> and interactive docs at
<http://localhost:8000/docs>.

## Project layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app entrypoint
│   ├── config.py            # Settings (pydantic-settings)
│   ├── routers/             # HTTP routes
│   │   ├── upload.py
│   │   ├── analysis.py
│   │   ├── employees.py
│   │   └── squad.py
│   ├── models/
│   │   └── schemas.py       # Pydantic request/response models
│   ├── services/
│   │   ├── database_service.py
│   │   ├── analysis_service.py
│   │   └── squad_service.py
│   └── utils/
│       └── csv_parser.py
├── requirements.txt
├── .env.example
└── README.md
```

# GhostBuster Backend

FastAPI backend for ghost worker detection.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

Visit: http://localhost:8000/
API Docs: http://localhost:8000/docs

## Environment

Copy `.env.example` to `.env` and fill in values.

## TODO for Person 2

1. Implement routers (upload, analysis, employees, squad)
2. Create database_service.py (Supabase integration)
3. Create analysis_service.py (integrate Person 3's fraud detector)
4. Create csv_parser.py
5. Create squad_service.py

See PRD_Person2_Backend_API_Lead.md for details.