# Backend Handoff - Person 2

## What's Ready

✅ FastAPI app structure  
✅ Pydantic models (schemas.py) - **CRITICAL: Match these exactly in your endpoints**  
✅ Config management  
✅ Dependencies (requirements.txt)  

## What You Need to Build (Saturday)

### Priority 1 (Morning):
1. **Upload endpoint** - POST /api/upload (see PRD Task 2.2)
2. **Database service** - Supabase CRUD operations (see PRD Task 1.3)
3. **CSV parser** - Validate and parse uploads (see PRD Task 2.1)

### Priority 2 (Afternoon):
4. **Analysis endpoint** - GET /api/results/:id (see PRD Task 3.1)
5. **Employee endpoints** - GET /api/employee/:id (see PRD Task 3.2)
6. **Integrate Person 3's fraud_detector** - Import and call it

### Priority 3 (Evening):
7. **Squad API service** - Account Lookup + Transfer (see PRD Task 4.1)
8. **Squad endpoints** - POST /api/squad/* (see PRD Task 4.2)

## Quick Start

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Test: http://localhost:8000/

## Environment Setup

Person 4 will share:
- Supabase URL and Key
- Squad API credentials

Copy to `.env` file.

## Integration Points

- **Person 3** provides `fraud_detector.py` → Place in `app/services/`
- **Person 3** provides sample CSV → Test uploads
- **Person 1** expects these exact Pydantic models → Don't change schemas.py

## Database Schema (Supabase SQL)
This has already been created on supabase
Person 4 will set up Supabase. Here's the schema you'll need:

```sql
-- uploads table
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    status TEXT DEFAULT 'processing'
);

-- employees table  
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    ministry TEXT NOT NULL,
    salary NUMERIC NOT NULL,
    bank_account TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    biometric_id TEXT,
    attendance_rate NUMERIC,
    employment_date TEXT,
    fraud_score NUMERIC DEFAULT 0,
    classification TEXT DEFAULT 'VERIFIED',
    red_flags JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- analysis_results table
CREATE TABLE analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE,
    total_employees INTEGER NOT NULL,
    flagged_count INTEGER NOT NULL,
    estimated_loss NUMERIC NOT NULL,
    fraud_breakdown JSONB NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW(),
    analysis_duration_seconds NUMERIC
);
```
## Credentials (READY TO USE)

**Supabase:**
- URL: `https://nlpjretevnkmhokrcxjn.supabase.co`
- Anon Key: Already in `.env` file
- Database: Tables created and ready

**Squad API:**
- Sandbox URL: `https://sandbox-api-d.squadco.com`
- API Key: Will be shared separately (or use MOCK_SQUAD=true for now)

**Status:** ✅ Backend foundation complete. Database live. Ready to build endpoints.

Good luck! 🚀