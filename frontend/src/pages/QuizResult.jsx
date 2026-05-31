import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getQuizHistory } from "../lib/api";
import api from "../lib/api";

export default function QuizResult() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [review, setReview] = useState(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    getQuizHistory().then(r => {
      const session = r.data.find(s => s.id === sessionId);
      setResult(session);
    });
  }, [sessionId]);

  const loadReview = async () => {
    if (review) {
      setShowReview(!showReview);
      return;
    }
    const { data } = await api.get(`/api/quiz/review/${sessionId}`);
    setReview(data);
    setShowReview(true);
  };

  if (!result) return <div className="text-gray-400 py-10 text-center">Loading results...</div>;

  const score = result.score_percent;
  const color = score >= 70 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-500";
  const message = score >= 70 ? "Great job!" : score >= 50 ? "Good effort, keep going." : "Keep studying — flashcards are ready for your weak topics.";

  const opts = ["A", "B", "C", "D"];

  return (
    <div className="max-w-lg space-y-6">
      {/* Score card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className={`text-6xl font-bold mb-2 ${color}`}>{score}%</div>
        <div className="text-gray-500 text-sm">{message}</div>
        <div className="mt-4 text-sm text-gray-400">
          {result.correct_answers} / {result.total_questions} correct
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate("/quiz")}
          className="bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-indigo-700"
        >
          Take another quiz
        </button>
        <button
          onClick={() => navigate("/flashcards")}
          className="bg-white border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Review flashcards
        </button>
      </div>

      {/* Review answers button */}
      <button
        onClick={loadReview}
        className="w-full border border-indigo-200 text-indigo-600 rounded-xl py-3 text-sm font-medium hover:bg-indigo-50"
      >
        {showReview ? "Hide answers" : "Review answers & explanations"}
      </button>

      {/* Answer review */}
      {showReview && review && (
        <div className="space-y-4">
          {review.attempts.map((attempt, index) => {
            const q = attempt.questions;
            const isCorrect = attempt.is_correct;
            return (
              <div
                key={attempt.id}
                className={`bg-white border rounded-2xl p-5 space-y-3 ${
                  isCorrect ? "border-green-200" : "border-red-200"
                }`}
              >
                {/* Question */}
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                    isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {isCorrect ? "✓" : "✗"} Q{index + 1}
                  </span>
                  <p className="text-sm font-medium text-gray-800">{q.question_text}</p>
                </div>

                {/* Options */}
                <div className="space-y-1.5">
                  {opts.map(opt => {
                    const label = q[`option_${opt.toLowerCase()}`];
                    const isCorrectOpt = q.correct_option === opt;
                    const isSelected = attempt.selected_option === opt;
                    return (
                      <div
                        key={opt}
                        className={`text-xs px-3 py-2 rounded-xl flex items-center gap-2 ${
                          isCorrectOpt
                            ? "bg-green-50 border border-green-300 text-green-800 font-medium"
                            : isSelected && !isCorrectOpt
                            ? "bg-red-50 border border-red-300 text-red-700"
                            : "bg-gray-50 text-gray-500"
                        }`}
                      >
                        <span className="font-bold">{opt}.</span>
                        <span>{label}</span>
                        {isCorrectOpt && <span className="ml-auto">✓ correct</span>}
                        {isSelected && !isCorrectOpt && <span className="ml-auto">your answer</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Explanation: </span>
                      {q.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => navigate("/")}
        className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
      >
        Back to dashboard
      </button>
    </div>
  );
}