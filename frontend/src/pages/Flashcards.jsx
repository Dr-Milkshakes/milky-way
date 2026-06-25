import { useEffect, useState } from "react";
import api from "../lib/api";
import { getTopics, getSubjects } from "../lib/api";

export default function Flashcards() {
  const [view, setView] = useState("review");
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [cards, setCards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSubjects().then(r => setSubjects(r.data)).catch(() => {});
    loadDueCards();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      getTopics(selectedSubject).then(r => setTopics(r.data)).catch(() => {});
    } else {
      setTopics([]);
    }
  }, [selectedSubject]);

  const loadDueCards = async (topicId = null) => {
    setLoading(true);
    try {
      const url = topicId
        ? `/api/flashcards/ai/due?topic_id=${topicId}`
        : `/api/flashcards/ai/due`;
      const { data } = await api.get(url);
      setCards(data || []);
      setCurrent(0);
      setFlipped(false);
      setDone(!data || data.length === 0);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic);
    setView("review");
    loadDueCards(topic.id);
  };

  const handleRate = async (quality) => {
    const card = cards[current];
    if (!card) return;
    await api.post(`/api/flashcards/ai/${card.id}/review`, { quality });
    const next = current + 1;
    if (next < cards.length) {
      setCurrent(next);
      setFlipped(false);
    } else {
      setDone(true);
    }
  };

  const card = cards[current];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Flashcards</h1>
          {selectedTopic && (
            <p className="text-sm text-gray-400 mt-0.5">{selectedTopic.title}</p>
          )}
        </div>
        <div className="flex gap-2">
          {["review", "browse"].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-sm px-3 py-1.5 rounded-lg ${
                view === v ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              {v === "review" ? "Review" : "Browse topics"}
            </button>
          ))}
        </div>
      </div>

      {/* ── BROWSE ── */}
      {view === "browse" && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {topics.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-800">{t.title}</div>
                  <div className="text-xs text-gray-400">{t.subject}</div>
                </div>
                <button
                  onClick={() => handleTopicSelect(t)}
                  className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100"
                >
                  Study
                </button>
              </div>
            ))}
            {!selectedSubject && <p className="text-sm text-gray-400">Select a subject to see topics.</p>}
            {selectedSubject && topics.length === 0 && <p className="text-sm text-gray-400">No topics found.</p>}
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {view === "review" && (
        <div>
          {loading ? (
            <div className="text-gray-400 py-10 text-center">Loading cards...</div>
          ) : done ? (
            <div className="text-center py-16 space-y-4">
              <div className="text-4xl">🎉</div>
              <p className="text-gray-600 font-medium">All caught up!</p>
              <p className="text-gray-400 text-sm">Come back tomorrow or browse more topics.</p>
              <button
                onClick={() => setView("browse")}
                className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700"
              >
                Browse topics
              </button>
            </div>
          ) : !card ? (
            <div className="text-gray-400 py-10 text-center">No cards available.</div>
          ) : (
            <div className="space-y-4">
              {/* Progress + type badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{current + 1} / {cards.length}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  card.type === "short"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-purple-50 text-purple-600"
                }`}>
                  {card.type === "short" ? "Short answer" : "Essay"}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${(current / cards.length) * 100}%` }}
                />
              </div>

              {/* Card — click to flip */}
              <div
                onClick={() => !flipped && setFlipped(true)}
                className={`bg-white border rounded-2xl p-8 min-h-56 flex flex-col justify-center transition-all ${
                  flipped
                    ? "border-indigo-200 cursor-default"
                    : "border-gray-200 cursor-pointer hover:border-indigo-300 hover:shadow-sm"
                }`}
              >
                {!flipped ? (
                  /* Question side */
                  <div className="space-y-4">
                    <p className="text-gray-800 font-medium text-base leading-relaxed">
                      {card.question}
                    </p>
                    {card.topics && (
                      <p className="text-xs text-gray-400">{card.topics.title}</p>
                    )}
                    <p className="text-xs text-indigo-400 mt-4">Tap to reveal answer</p>
                  </div>
                ) : (
                  /* Answer side */
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Question</p>
                    <p className="text-gray-600 text-sm leading-relaxed">{card.question}</p>
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide mb-2">Answer</p>
                      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{card.answer}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Rating — only after flip */}
              {flipped ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 text-center">How well did you know this?</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Again", sub: "Didn't know", q: 1, color: "border-red-200 text-red-600 hover:bg-red-50" },
                      { label: "Hard", sub: "Struggled", q: 3, color: "border-amber-200 text-amber-600 hover:bg-amber-50" },
                      { label: "Easy", sub: "Knew it", q: 5, color: "border-green-200 text-green-600 hover:bg-green-50" },
                    ].map(b => (
                      <button
                        key={b.label}
                        onClick={() => handleRate(b.q)}
                        className={`border rounded-xl py-3 text-sm font-medium transition flex flex-col items-center gap-0.5 ${b.color}`}
                      >
                        <span>{b.label}</span>
                        <span className="text-xs opacity-60 font-normal">{b.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setFlipped(true)}
                  className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-indigo-700"
                >
                  Show answer
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
