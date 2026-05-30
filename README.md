# StudyApp — Notion-powered Quiz & Flashcard Platform

## Stack
- **Backend**: Python 3.11 + FastAPI
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 1.5 Flash
- **Notes source**: Notion API
- **Frontend**: React + Tailwind CSS

## Project structure
```
studyapp/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── config.py             # Env vars
│   ├── database.py           # Supabase client
│   ├── models/
│   │   └── schemas.py        # Pydantic models
│   ├── services/
│   │   ├── notion.py         # Notion API sync
│   │   ├── gemini.py         # Question generation
│   │   └── flashcards.py     # Flashcard logic
│   └── routers/
│       ├── questions.py      # Question endpoints
│       ├── quiz.py           # Quiz session endpoints
│       ├── flashcards.py     # Flashcard endpoints
│       └── users.py          # Auth endpoints
├── supabase_schema.sql       # Run this in Supabase SQL editor
├── requirements.txt
└── .env.example
```

## Setup

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env    # Fill in your keys
uvicorn main:app --reload
```

### 2. Database
- Open your Supabase project
- Go to **SQL Editor**
- Paste and run the contents of `supabase_schema.sql`

### 3. Sync your Notion notes
```
POST /api/notion/sync
```
This pulls all pages from your Notion database.

### 4. Generate questions
```
POST /api/questions/generate?topic_id=<id>
```
Drafts questions via Gemini. You then approve them in the `/admin/review` page.

### 5. Frontend
```bash
cd frontend
npm install
npm run dev
```
