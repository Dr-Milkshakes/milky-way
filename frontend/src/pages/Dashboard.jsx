import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFlashcardStats, getQuizHistory, getSubjects } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    getFlashcardStats().then(r => setStats(r.data)).catch(() => {});
    getQuizHistory().then(r => setHistory(r.data.slice(0, 5))).catch(() => {});
    getSubjects().then(r => setSubjects(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">
          Good day, {user?.username} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">What do you want to study today?</p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Cards due today", value: stats.due_today, color: "text-indigo-600" },
            { label: "Total cards", value: stats.total_cards, color: "text-gray-800" },
            { label: "Decks", value: stats.decks, color: "text-gray-800" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate("/quiz")}
          className="bg-indigo-600 text-white rounded-xl p-6 text-left hover:bg-indigo-700 transition">
          <div className="text-xl font-semibold mb-1">Take a quiz</div>
          <div className="text-indigo-200 text-sm">Test yourself on any subject or topic</div>
        </button>
        <button
          onClick={() => navigate("/flashcards")}
          className="bg-white border border-gray-200 rounded-xl p-6 text-left hover:bg-gray-50 transition">
          <div className="text-xl font-semibold text-gray-800 mb-1">Review flashcards</div>
          <div className="text-gray-400 text-sm">
            {stats?.due_today > 0 ? `${stats.due_today} cards due` : "All caught up"}
          </div>
        </button>
      </div>

      {/* Subjects */}
      {subjects.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Subjects</h2>
          <div className="flex flex-wrap gap-2">
            {subjects.map(s => (
              <button
                key={s}
                onClick={() => navigate(`/quiz?subject=${encodeURIComponent(s)}`)}
                className="bg-white border border-gray-200 rounded-full px-4 py-1.5 text-sm text-gray-700 hover:border-indigo-400 hover:text-indigo-600 transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent quiz history */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Recent quizzes</h2>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-800">
                    {h.subject || h.topics?.title || "Mixed"}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(h.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className={`text-lg font-bold ${
                  h.score_percent >= 70 ? "text-green-600" :
                  h.score_percent >= 50 ? "text-amber-500" : "text-red-500"
                }`}>
                  {h.score_percent}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
