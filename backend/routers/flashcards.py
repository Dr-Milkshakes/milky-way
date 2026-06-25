from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from routers.users import get_current_user, require_admin
from services.flashcards import generate_ai_flashcards, sm2
from datetime import date, timedelta
from pydantic import BaseModel

router = APIRouter(prefix="/api/flashcards", tags=["flashcards"])


class ReviewBody(BaseModel):
    quality: int  # 0-5


@router.post("/generate")
async def generate_flashcards(
    topic_id: str,
    num_cards: int = 20,
    user=Depends(require_admin)
):
    try:
        return generate_ai_flashcards(topic_id, num_cards)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/ai/due")
async def get_due_cards(topic_id: str = None, user=Depends(get_current_user)):
    # Fetch all cards
    query = supabase.table("ai_flashcards").select("*, topics(title, subject)")
    if topic_id:
        query = query.eq("topic_id", topic_id)
    all_cards = query.execute().data or []

    if not all_cards:
        return []

    # Fetch user progress
    progress_rows = supabase.table("ai_flashcard_progress").select(
        "flashcard_id, due_date"
    ).eq("user_id", user["id"]).execute().data or []

    progress_map = {p["flashcard_id"]: p["due_date"] for p in progress_rows}
    today = str(date.today())

    result = [
        card for card in all_cards
        if progress_map.get(card["id"], today) <= today
    ]

    return result[:30]


@router.get("/ai/topic/{topic_id}")
async def get_cards_by_topic(topic_id: str, user=Depends(get_current_user)):
    cards = supabase.table("ai_flashcards").select(
        "*, topics(title, subject)"
    ).eq("topic_id", topic_id).execute().data or []
    return cards


@router.post("/ai/{flashcard_id}/review")
async def review_card(
    flashcard_id: str,
    body: ReviewBody,
    user=Depends(get_current_user)
):
    if body.quality < 0 or body.quality > 5:
        raise HTTPException(400, "Quality must be 0-5")

    existing = supabase.table("ai_flashcard_progress").select("*").eq(
        "flashcard_id", flashcard_id
    ).eq("user_id", user["id"]).execute().data

    today = date.today()

    if existing:
        p = existing[0]
        new_ef, new_interval, new_reps = sm2(
            p["ease_factor"], p["interval_days"], p["repetitions"], body.quality
        )
        supabase.table("ai_flashcard_progress").update({
            "ease_factor": new_ef,
            "interval_days": new_interval,
            "repetitions": new_reps,
            "due_date": str(today + timedelta(days=new_interval)),
            "last_reviewed_at": "now()"
        }).eq("id", p["id"]).execute()
    else:
        new_ef, new_interval, new_reps = sm2(2.5, 1, 0, body.quality)
        supabase.table("ai_flashcard_progress").insert({
            "user_id": user["id"],
            "flashcard_id": flashcard_id,
            "ease_factor": new_ef,
            "interval_days": new_interval,
            "repetitions": new_reps,
            "due_date": str(today + timedelta(days=new_interval)),
            "last_reviewed_at": "now()"
        }).execute()

    return {"reviewed": flashcard_id}


@router.get("/stats")
async def flashcard_stats(user=Depends(get_current_user)):
    total = supabase.table("ai_flashcards").select("id", count="exact").execute()
    progress = supabase.table("ai_flashcard_progress").select(
        "id", count="exact"
    ).eq("user_id", user["id"]).lte("due_date", str(date.today())).execute()

    return {
        "total_cards": total.count or 0,
        "due_today": progress.count or 0,
    }