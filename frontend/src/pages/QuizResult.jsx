import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getQuizHistory } from "../lib/api";

export default function QuizResult() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);

  useEffect(() => {
    getQuizHistory().then(r => {
      const session = r.data.find(s => s.id === sessionId);
      setResult(session);
    });
  }, [sessionId]);

  if (!result) return <div className="text-gray-400 py-10 text-center">Loading results...</div>;

  const score = result.score_percent;
  const color = score >= 70 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-500";
  const message = score >= 70 ? "Great job!" : score >= 50 ? "Good effort, keep going." : "Keep studying — flashcards are ready for your weak topics.";

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className={`text-6xl font-bold mb-2 ${color}`}>{score}%</div>
        <div className="text-gray-500 text-sm">{message}</div>
        <div className="mt-4 text-sm text-gray-400">
          {result.correct_answers} / {result.total_questions} correct
        </div>
      </div>

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

      <button
        onClick={() => navigate("/")}
        className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
      >
        Back to dashboard
      </button>
    </div>
  );
}
