from fastapi import APIRouter, Depends, HTTPException
from models.schemas import QuestionReview
from services.gemini import generate_questions_for_topic, get_draft_questions, review_question
from services.notion import sync_notion_database, get_subjects
from database import supabase
from routers.users import get_current_user, require_admin

router = APIRouter(tags=["questions"])


# ── Notion Sync (admin only) ────────────────────────────────
@router.post("/api/notion/sync")
async def sync_notion(user=Depends(require_admin)):
    """Pull latest pages from Notion into the topics table."""
    result = sync_notion_database()
    return result


# ── Topics ──────────────────────────────────────────────────
@router.get("/api/topics")
async def list_topics(subject: str = None, user=Depends(get_current_user)):
    query = supabase.table("topics").select("id, title, subject, last_synced_at")
    if subject:
        query = query.eq("subject", subject)
    result = query.order("subject").order("title").execute()
    return result.data


@router.get("/api/subjects")
async def list_subjects(user=Depends(get_current_user)):
    return get_subjects()


# ── Question generation (admin only) ────────────────────────
@router.post("/api/questions/generate")
async def generate_questions(
    topic_id: str,
    num_questions: int = 10,
    user=Depends(require_admin)
):
    """Trigger AI question generation for a topic. Returns drafts for review."""
    try:
        result = generate_questions_for_topic(topic_id, num_questions)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/api/questions/drafts")
async def list_drafts(topic_id: str = None, user=Depends(require_admin)):
    """List all draft questions pending review."""
    return get_draft_questions(topic_id)


@router.patch("/api/questions/{question_id}/review")
async def review(
    question_id: str,
    body: QuestionReview,
    user=Depends(require_admin)
):
    """Approve or reject a draft question."""
    try:
        return review_question(question_id, body.status.value)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/api/questions")
async def list_approved_questions(
    topic_id: str = None,
    user=Depends(get_current_user)
):
    """List all approved questions (students) or all questions (admin)."""
    query = supabase.table("questions").select("*, topics(title, subject)")

    if user["role"] != "admin":
        query = query.eq("status", "approved")

    if topic_id:
        query = query.eq("topic_id", topic_id)

    result = query.order("created_at", desc=True).execute()
    return result.data
