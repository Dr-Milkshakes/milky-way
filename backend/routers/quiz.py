from fastapi import APIRouter, Depends, HTTPException
from models.schemas import StartQuizRequest, SubmitAnswer, QuizResult
from database import supabase
from services.flashcards import create_deck_for_weak_topics, WEAKNESS_THRESHOLD
from routers.users import get_current_user
import random

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


@router.post("/start")
async def start_quiz(req: StartQuizRequest, user=Depends(get_current_user)):
    """Start a new quiz session. Filter by topic or subject."""
    query = supabase.table("questions").select("*").eq("status", "approved")

    if req.topic_id:
        query = query.eq("topic_id", req.topic_id)
    elif req.subject:
        # Get topic IDs for this subject first
        topics = supabase.table("topics").select("id").eq(
            "subject", req.subject
        ).execute()
        topic_ids = [t["id"] for t in topics.data]
        if not topic_ids:
            raise HTTPException(404, "No topics found for this subject")
        query = query.in_("topic_id", topic_ids)

    all_questions = query.execute()
    if not all_questions.data:
        raise HTTPException(404, "No approved questions available for this selection")

    # Pick random subset
    selected = random.sample(
        all_questions.data,
        min(req.num_questions, len(all_questions.data))
    )

    # Create session
    session = supabase.table("quiz_sessions").insert({
        "user_id": user["id"],
        "topic_id": req.topic_id,
        "subject": req.subject,
        "total_questions": len(selected),
    }).execute()

    session_id = session.data[0]["id"]

    # Return questions without correct answers
    questions_out = []
    for q in selected:
        questions_out.append({
            "id": q["id"],
            "question_text": q["question_text"],
            "option_a": q["option_a"],
            "option_b": q["option_b"],
            "option_c": q["option_c"],
            "option_d": q["option_d"],
        })

    return {"session_id": session_id, "questions": questions_out}


@router.post("/submit/{session_id}")
async def submit_quiz(
    session_id: str,
    answers: list[SubmitAnswer],
    user=Depends(get_current_user)
):
    """Submit all answers for a quiz session and get results."""
    # Verify session belongs to user
    session = supabase.table("quiz_sessions").select("*").eq(
        "id", session_id
    ).eq("user_id", user["id"]).single().execute()

    if not session.data:
        raise HTTPException(404, "Session not found")

    if session.data.get("completed_at"):
        raise HTTPException(400, "Session already submitted")

    correct_count = 0
    topic_scores: dict[str, dict] = {}

    for answer in answers:
        question = supabase.table("questions").select(
            "*, topics(id, title)"
        ).eq("id", answer.question_id).single().execute()

        if not question.data:
            continue

        q = question.data
        is_correct = q["correct_option"] == answer.selected_option.value

        if is_correct:
            correct_count += 1

        # Track per-topic scores
        tid = q["topic_id"]
        if tid not in topic_scores:
            topic_scores[tid] = {"correct": 0, "total": 0, "title": q["topics"]["title"]}
        topic_scores[tid]["total"] += 1
        if is_correct:
            topic_scores[tid]["correct"] += 1

        # Record attempt
        supabase.table("quiz_attempts").insert({
            "session_id": session_id,
            "question_id": answer.question_id,
            "selected_option": answer.selected_option.value,
            "is_correct": is_correct
        }).execute()

    total = len(answers)
    score_pct = round((correct_count / total * 100) if total > 0 else 0, 2)

    # Identify weak topics
    weak_topic_ids = [
        tid for tid, s in topic_scores.items()
        if (s["correct"] / s["total"] * 100) < WEAKNESS_THRESHOLD
    ]

    # Update session
    supabase.table("quiz_sessions").update({
        "correct_answers": correct_count,
        "score_percent": score_pct,
        "completed_at": "now()"
    }).eq("id", session_id).execute()

    # Auto-create flashcard decks for weak topics
    flashcard_summary = {}
    if weak_topic_ids:
        flashcard_summary = create_deck_for_weak_topics(user["id"], weak_topic_ids)

    return {
        "session_id": session_id,
        "total_questions": total,
        "correct_answers": correct_count,
        "score_percent": score_pct,
        "topic_breakdown": topic_scores,
        "weak_topics": [
            {"id": tid, "title": topic_scores[tid]["title"]}
            for tid in weak_topic_ids
        ],
        "flashcards_created": flashcard_summary
    }


@router.get("/history")
async def quiz_history(user=Depends(get_current_user)):
    """Get a user's quiz history."""
    result = supabase.table("quiz_sessions").select(
        "*, topics(title)"
    ).eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return result.data

@router.get("/review/{session_id}")
async def review_session(session_id: str, user=Depends(get_current_user)):
    """Get full question review for a completed session."""
    # Verify session belongs to user
    session = supabase.table("quiz_sessions").select("*").eq(
        "id", session_id
    ).eq("user_id", user["id"]).single().execute()

    if not session.data:
        raise HTTPException(404, "Session not found")

    # Get all attempts with question details
    attempts = supabase.table("quiz_attempts").select(
        "*, questions(question_text, option_a, option_b, option_c, option_d, correct_option, explanation)"
    ).eq("session_id", session_id).execute()

    return {
        "session": session.data,
        "attempts": attempts.data
    }
