from fastapi import APIRouter, Depends, HTTPException
from models.schemas import FlashcardReview
from services.flashcards import (
    get_due_flashcards, record_flashcard_review, add_topic_to_deck
)
from database import supabase
from routers.users import get_current_user


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