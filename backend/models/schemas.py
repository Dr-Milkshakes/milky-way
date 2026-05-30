from pydantic import BaseModel, UUID4
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class QuestionStatus(str, Enum):
    draft = "draft"
    approved = "approved"
    rejected = "rejected"


class CorrectOption(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


# ── Topics ──────────────────────────────────────────
class TopicOut(BaseModel):
    id: str
    notion_page_id: str
    title: str
    subject: str
    last_synced_at: Optional[datetime]


# ── Questions ────────────────────────────────────────
class QuestionOut(BaseModel):
    id: str
    topic_id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: Optional[str]
    status: str


class QuestionReview(BaseModel):
    status: QuestionStatus  # approved or rejected


# ── Quiz ─────────────────────────────────────────────
class StartQuizRequest(BaseModel):
    topic_id: Optional[str] = None
    subject: Optional[str] = None
    num_questions: int = 10


class SubmitAnswer(BaseModel):
    question_id: str
    selected_option: CorrectOption


class QuizResult(BaseModel):
    session_id: str
    total_questions: int
    correct_answers: int
    score_percent: float
    weak_topics: List[str]   # topic IDs scoring below threshold


class QuizSessionOut(BaseModel):
    id: str
    topic_id: Optional[str]
    subject: Optional[str]
    total_questions: int
    correct_answers: int
    score_percent: float
    completed_at: Optional[datetime]
    created_at: datetime


# ── Flashcards ───────────────────────────────────────
class FlashcardOut(BaseModel):
    id: str
    deck_id: str
    question_id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: Optional[str]
    due_date: date
    interval_days: int
    repetitions: int


class FlashcardReview(BaseModel):
    quality: int  # 0-5 (SM-2 algorithm: 0-2 = fail, 3-5 = pass)


# ── Auth ─────────────────────────────────────────────
class UserLogin(BaseModel):
    email: str
    password: str


class UserRegister(BaseModel):
    email: str
    password: str
    username: str
    full_name: Optional[str] = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    role: str
