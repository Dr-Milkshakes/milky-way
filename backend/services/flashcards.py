from database import supabase
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)

WEAKNESS_THRESHOLD = 60.0  # score % below this triggers flashcard creation


def sm2(ease_factor: float, interval: int, repetitions: int, quality: int):
    """
    SM-2 spaced repetition algorithm.
    quality: 0-5 (0-2 = failed, 3-5 = passed)
    Returns (new_ease_factor, new_interval, new_repetitions)
    """
    if quality < 3:
        # Failed — reset
        return max(1.3, ease_factor - 0.2), 1, 0
    else:
        # Passed
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * ease_factor)
        new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ef = max(1.3, new_ef)
        return new_ef, new_interval, repetitions + 1


def create_deck_for_weak_topics(user_id: str, weak_topic_ids: list[str]) -> dict:
    """
    After a quiz, create/update flashcard decks for topics the user scored poorly on.
    """
    created = 0
    for topic_id in weak_topic_ids:
        # Upsert deck
        deck_result = supabase.table("flashcard_decks").upsert({
            "user_id": user_id,
            "topic_id": topic_id,
            "source": "quiz_weakness"
        }, on_conflict="user_id,topic_id").execute()

        deck_id = deck_result.data[0]["id"]

        # Get approved questions for this topic not already in this deck
        existing = supabase.table("flashcards").select(
            "question_id"
        ).eq("deck_id", deck_id).execute()
        existing_ids = {r["question_id"] for r in existing.data}

        questions = supabase.table("questions").select("id").eq(
            "topic_id", topic_id
        ).eq("status", "approved").execute()

        new_questions = [q["id"] for q in questions.data if q["id"] not in existing_ids]

        for qid in new_questions:
            supabase.table("flashcards").insert({
                "deck_id": deck_id,
                "question_id": qid,
                "due_date": str(date.today())
            }).execute()
            created += 1

    return {"decks_updated": len(weak_topic_ids), "cards_added": created}


def add_topic_to_deck(user_id: str, topic_id: str) -> dict:
    """Manually add a topic's questions to a user's flashcard deck."""
    deck_result = supabase.table("flashcard_decks").upsert({
        "user_id": user_id,
        "topic_id": topic_id,
        "source": "manual"
    }, on_conflict="user_id,topic_id").execute()

    deck_id = deck_result.data[0]["id"]

    existing = supabase.table("flashcards").select(
        "question_id"
    ).eq("deck_id", deck_id).execute()
    existing_ids = {r["question_id"] for r in existing.data}

    questions = supabase.table("questions").select("id").eq(
        "topic_id", topic_id
    ).eq("status", "approved").execute()

    new_questions = [q["id"] for q in questions.data if q["id"] not in existing_ids]

    for qid in new_questions:
        supabase.table("flashcards").insert({
            "deck_id": deck_id,
            "question_id": qid,
            "due_date": str(date.today())
        }).execute()

    return {"cards_added": len(new_questions)}


def get_due_flashcards(user_id: str, topic_id: str = None, limit: int = 20) -> list:
    """Get flashcards due for review today."""
    query = supabase.table("flashcards").select(
        "*, questions(question_text, option_a, option_b, option_c, option_d, correct_option, explanation), flashcard_decks!inner(user_id, topic_id)"
    ).eq("flashcard_decks.user_id", user_id).lte("due_date", str(date.today()))

    if topic_id:
        query = query.eq("flashcard_decks.topic_id", topic_id)

    result = query.order("due_date").limit(limit).execute()
    return result.data


def record_flashcard_review(user_id: str, flashcard_id: str, quality: int) -> dict:
    """Update a flashcard's schedule after a review using SM-2."""
    if quality < 0 or quality > 5:
        raise ValueError("Quality must be 0-5")

    card = supabase.table("flashcards").select("*").eq("id", flashcard_id).single().execute()
    if not card.data:
        raise ValueError("Flashcard not found")

    c = card.data
    new_ef, new_interval, new_reps = sm2(
        c["ease_factor"], c["interval_days"], c["repetitions"], quality
    )
    new_due = str(date.today() + timedelta(days=new_interval))

    updated = supabase.table("flashcards").update({
        "ease_factor": new_ef,
        "interval_days": new_interval,
        "repetitions": new_reps,
        "due_date": new_due,
        "last_reviewed_at": "now()"
    }).eq("id", flashcard_id).execute()

    return updated.data[0]

FLASHCARD_PROMPT = """
You are a medical education expert creating study flashcards for medical students.

Given the following notes on "{topic_title}" ({subject}):

---
{content}
---

Generate exactly {num_cards} flashcards. Mix:
- 60% short answer (1-3 sentence answer)
- 40% essay (3-6 sentence detailed answer)

Return ONLY a valid JSON array. No preamble, no markdown. Format:
[
  {{"type": "short", "question": "...", "answer": "..."}},
  {{"type": "essay", "question": "...", "answer": "..."}}
]
"""

def generate_ai_flashcards(topic_id: str, num_cards: int = 20) -> dict:
    import google.generativeai as genai
    import json as json_lib
    from config import settings

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    topic = supabase.table("topics").select("*").eq("id", topic_id).single().execute()
    if not topic.data:
        raise ValueError("Topic not found")

    t = topic.data
    content = t.get("content", "").strip()
    if len(content) < 100:
        raise ValueError(f"Topic '{t['title']}' has insufficient content. Please sync Notion first.")

    prompt = FLASHCARD_PROMPT.format(
        topic_title=t["title"],
        subject=t["subject"],
        content=content[:8000],
        num_cards=num_cards
    )

    response = model.generate_content(prompt)
    raw = response.text.strip()

    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    cards = json_lib.loads(raw)

    # Delete existing flashcards for this topic before inserting new ones
    supabase.table("ai_flashcards").delete().eq("topic_id", topic_id).execute()

    saved = 0
    for card in cards:
        if not card.get("question") or not card.get("answer"):
            continue
        supabase.table("ai_flashcards").insert({
            "topic_id": topic_id,
            "type": card.get("type", "short"),
            "question": card["question"],
            "answer": card["answer"],
        }).execute()
        saved += 1

    return {"topic": t["title"], "generated": saved}
