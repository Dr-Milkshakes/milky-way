import google.generativeai as genai
import json
import logging
from config import settings
from database import supabase

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.gemini_api_key)
model = genai.GenerativeModel("gemini-2.5-flash")

QUESTION_PROMPT = """
You are a medical education expert creating high-quality multiple choice questions.

Given the following notes on the topic "{topic_title}" (subject: {subject}):

---
{content}
---

Generate exactly {num_questions} MCQ questions based ONLY on the content above.

Rules:
- Each question must be clinically relevant and test understanding, not just recall
- Distractors (wrong options) must be plausible
- Include a brief explanation for the correct answer
- Questions should vary in difficulty

Return ONLY a valid JSON array, no preamble, no markdown fences. Format:
[
  {{
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_option": "A",
    "explanation": "..."
  }}
]
"""


def generate_questions_for_topic(topic_id: str, num_questions: int = 30) -> dict:
    """
    Generate draft MCQ questions for a topic using Gemini.
    Questions are saved with status='draft' for admin review.
    """
    # Fetch topic
    result = supabase.table("topics").select("*").eq("id", topic_id).single().execute()
    if not result.data:
        raise ValueError(f"Topic {topic_id} not found")

    topic = result.data
    content = topic.get("content", "")

    if len(content.strip()) < 100:
        raise ValueError(f"Topic '{topic['title']}' has insufficient content for question generation")

    # Truncate content to avoid token limits (keep first 8000 chars)
    content_chunk = content[:8000]

    prompt = QUESTION_PROMPT.format(
        topic_title=topic["title"],
        subject=topic["subject"],
        content=content_chunk,
        num_questions=num_questions
    )

    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        questions = json.loads(raw)

        if not isinstance(questions, list):
            raise ValueError("Gemini did not return a JSON array")

        # Save all as drafts
        saved = 0
        for q in questions:
            correct = q.get("correct_option", "").upper()
            if correct not in ("A", "B", "C", "D"):
                continue
            supabase.table("questions").insert({
                "topic_id": topic_id,
                "question_text": q["question_text"],
                "option_a": q["option_a"],
                "option_b": q["option_b"],
                "option_c": q["option_c"],
                "option_d": q["option_d"],
                "correct_option": correct,
                "explanation": q.get("explanation", ""),
                "status": "draft"
            }).execute()
            saved += 1

        logger.info(f"Generated {saved} draft questions for topic '{topic['title']}'")
        return {
            "topic": topic["title"],
            "generated": len(questions),
            "saved": saved,
            "status": "draft — pending your review"
        }

    except json.JSONDecodeError as e:
        logger.error(f"Gemini returned invalid JSON: {e}\nRaw: {raw[:500]}")
        raise ValueError("AI returned malformed response. Try again.")
    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        raise


def get_draft_questions(topic_id: str = None) -> list:
    """Fetch all draft questions, optionally filtered by topic."""
    query = supabase.table("questions").select(
        "*, topics(title, subject)"
    ).eq("status", "draft")

    if topic_id:
        query = query.eq("topic_id", topic_id)

    result = query.order("created_at", desc=True).execute()
    return result.data


def review_question(question_id: str, status: str) -> dict:
    """Approve or reject a draft question."""
    if status not in ("approved", "rejected"):
        raise ValueError("Status must be 'approved' or 'rejected'")

    result = supabase.table("questions").update(
        {"status": status}
    ).eq("id", question_id).execute()

    return result.data[0] if result.data else {}
