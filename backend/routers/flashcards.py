from fastapi import APIRouter, Depends, HTTPException
from models.schemas import FlashcardReview
from services.flashcards import (
    get_due_flashcards, record_flashcard_review, add_topic_to_deck
)
from database import supabase
from routers.users import get_current_user
from services.flashcards import sm2


router = APIRouter(prefix="/api/flashcards", tags=["flashcards"])


@router.get("/due")
async def due_cards(topic_id: str = None, limit: int = 20, user=Depends(get_current_user)):
    """Get flashcards due for review today."""
    return get_due_flashcards(user["id"], topic_id, limit)


@router.post("/{flashcard_id}/review")
async def review_card(
    flashcard_id: str,
    body: FlashcardReview,
    user=Depends(get_current_user)
):
    """Submit a flashcard review (quality 0-5) to update spaced repetition schedule."""
    try:
        return record_flashcard_review(user["id"], flashcard_id, body.quality)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/add-topic/{topic_id}")
async def add_topic(topic_id: str, user=Depends(get_current_user)):
    """Manually add all approved questions for a topic to your flashcard deck."""
    return add_topic_to_deck(user["id"], topic_id)


@router.get("/my-decks")
async def my_decks(user=Depends(get_current_user)):
    """List all flashcard decks for the current user."""
    result = supabase.table("flashcard_decks").select(
        "*, topics(title, subject)"
    ).eq("user_id", user["id"]).execute()
    return result.data


@router.get("/stats")
async def flashcard_stats(user=Depends(get_current_user)):
    """Get due count and overall deck stats for the user."""
    from datetime import date
    decks = supabase.table("flashcard_decks").select("id").eq(
        "user_id", user["id"]
    ).execute()
    deck_ids = [d["id"] for d in decks.data]

    if not deck_ids:
        return {"total_cards": 0, "due_today": 0, "decks": 0}

    total = supabase.table("flashcards").select(
        "id", count="exact"
    ).in_("deck_id", deck_ids).execute()

    due = supabase.table("flashcards").select(
        "id", count="exact"
    ).in_("deck_id", deck_ids).lte("due_date", str(date.today())).execute()

    return {
        "total_cards": total.count,
        "due_today": due.count,
        "decks": len(deck_ids)
    }

@router.delete("/deck/{deck_id}")
async def remove_deck(deck_id: str, user=Depends(get_current_user)):
    """Remove a flashcard deck and all its cards."""
    # Verify deck belongs to user
    deck = supabase.table("flashcard_decks").select("id").eq(
        "id", deck_id
    ).eq("user_id", user["id"]).single().execute()
    
    if not deck.data:
        raise HTTPException(404, "Deck not found")

    # Cards cascade delete automatically via FK
    supabase.table("flashcard_decks").delete().eq("id", deck_id).execute()
    return {"deleted": deck_id}

@router.get("/ai/topic/{topic_id}")
async def get_ai_flashcards(topic_id: str, user=Depends(get_current_user)):
    """Get all AI flashcards for a topic with user progress."""
    cards = supabase.table("ai_flashcards").select("*").eq(
        "topic_id", topic_id
    ).execute()

    if not cards.data:
        return []

    card_ids = [c["id"] for c in cards.data]

    # Get user progress for these cards
    progress = supabase.table("ai_flashcard_progress").select("*").eq(
        "user_id", user["id"]
    ).in_("flashcard_id", card_ids).execute()

    progress_map = {p["flashcard_id"]: p for p in progress.data}

    # Merge progress into cards
    result = []
    for card in cards.data:
        p = progress_map.get(card["id"], {})
        result.append({
            **card,
            "due_date": p.get("due_date", str(date.today())),
            "interval_days": p.get("interval_days", 1),
            "repetitions": p.get("repetitions", 0),
            "progress_id": p.get("id"),
        })

    return result


@router.get("/ai/due")
async def get_due_ai_flashcards(topic_id: str = None, user=Depends(get_current_user)):
    """Get AI flashcards due for review today."""
    from datetime import date as date_type

    # Get all cards for topics the user has started
    started = supabase.table("ai_flashcard_progress").select(
        "flashcard_id"
    ).eq("user_id", user["id"]).lte("due_date", str(date_type.today())).execute()

    due_ids = [r["flashcard_id"] for r in started.data]

    # Also include cards never reviewed (no progress entry)
    query = supabase.table("ai_flashcards").select("*, topics(title, subject)")
    if topic_id:
        query = query.eq("topic_id", topic_id)

    all_cards = query.execute()

    reviewed_ids = {r["flashcard_id"] for r in supabase.table(
        "ai_flashcard_progress"
    ).select("flashcard_id").eq("user_id", user["id"]).execute().data}

    result = []
    for card in all_cards.data:
        if card["id"] in due_ids or card["id"] not in reviewed_ids:
            result.append(card)

    return result[:30]  # max 30 at a time


@router.post("/ai/{flashcard_id}/review")
async def review_ai_flashcard(
    flashcard_id: str,
    body: FlashcardReview,
    user=Depends(get_current_user)
):
    """Review an AI flashcard and update spaced repetition schedule."""
    from datetime import date as date_type, timedelta

    existing = supabase.table("ai_flashcard_progress").select("*").eq(
        "flashcard_id", flashcard_id
    ).eq("user_id", user["id"]).execute()

    if existing.data:
        p = existing.data[0]
        new_ef, new_interval, new_reps = sm2(
            p["ease_factor"], p["interval_days"], p["repetitions"], body.quality
        )
        new_due = str(date_type.today() + timedelta(days=new_interval))
        supabase.table("ai_flashcard_progress").update({
            "ease_factor": new_ef,
            "interval_days": new_interval,
            "repetitions": new_reps,
            "due_date": new_due,
            "last_reviewed_at": "now()"
        }).eq("id", p["id"]).execute()
    else:
        # First review — create progress entry
        new_ef, new_interval, new_reps = sm2(2.5, 1, 0, body.quality)
        new_due = str(date_type.today() + timedelta(days=new_interval))
        supabase.table("ai_flashcard_progress").insert({
            "user_id": user["id"],
            "flashcard_id": flashcard_id,
            "ease_factor": new_ef,
            "interval_days": new_interval,
            "repetitions": new_reps,
            "due_date": new_due,
            "last_reviewed_at": "now()"
        }).execute()

    return {"reviewed": flashcard_id}