from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import questions, quiz, flashcards, users

app = FastAPI(
    title="MilkyWay API",
    description="Notion-powered quiz and flashcard platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten this to your Vercel URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(questions.router)
app.include_router(quiz.router)
app.include_router(flashcards.router)


@app.get("/")
def health():
    return {"status": "ok", "app": "StudyApp API"}
