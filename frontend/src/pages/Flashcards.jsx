import api from "../lib/api";
import { useEffect, useState } from "react";
import { getDueFlashcards, reviewFlashcard, getMyDecks, addTopicToDeck, getTopics } from "../lib/api";

export default function Flashcards() {
  const [cards, setCards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [decks, setDecks] = useState([]);
  const [topics, setTopics] = useState([]);
  const [view, setView] = useState("review");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
    getMyDecks().then(r => setDecks(r.data)).catch(() => {});
    getTopics().then(r => setTopics(r.data)).catch(() => {});
  }, []);

  const loadCards = () => {
    setLoading(true);
    getDueFlashcards()
      .then(r => {
        setCards(r.data || []);
        setCurrent(0);
        setFlipped(false);
        setDone(!r.data || r.data.length === 0);
      })
      .catch(() => setDone(true))
      .finally(() => setLoading(false));
  };

  const handleRate = async (quality) => {
    const card = cards[current];
    if (!card) return;
    await reviewFlashcard(card.id, quality);
    if (current + 1 < cards.length) {
      setCurrent(current + 1);
      setFlipped(false);
    } else {
      setDone(true);
    }
  };

  const handleAddDeck = async (topicId) => {
    await addTopicToDeck(topicId);
    await loadCards();
    getMyDecks().then(r => setDecks(r.data));
  };

  const handleRemoveDeck = async (deckId) => {
  await api.delete(`/api/flashcards/deck/${deckId}`);
  getMyDecks().then(r => setDecks(r.data));
  loadCards();
  };
  const card = cards[current];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Flashcards</h1>
        <div className="flex gap-2">
          {["review", "decks"].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-sm px-3 py-1.5 rounded-lg ${
                view === v ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              {v === "review" ? "Review" : "My decks"}
            </button>
          ))}
        </div>
      </div>

      {view === "review" && (
        <div>
          {loading ? (
            <div className="text-gray-400 py-10 text-center">Loading cards...</div>
          ) : done ? (
            <div className="text-center py-16 space-y-4">
              <div className="text-4xl">🎉</div>
              <p className="text-gray-600 font-medium">All caught up for today!</p>
              <p className="text-gray-400 text-sm">
                Add a topic from the My Decks tab, or take a quiz to generate weak-topic cards.
              </p>
            </div>
          ) : !card ? (
            <div className="text-gray-400 py-10 text-center">No cards available.</div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 text-right">
                {current + 1} / {cards.length}
              </div>

              {/* Card */}
              <div
                onClick={() => setFlipped(!flipped)}
                className="cursor-pointer bg-white border border-gray-200 rounded-2xl p-8 min-h-48 flex flex-col justify-center items-center text-center select-none hover:border-indigo-300 transition"
              >
                {!flipped ? (
                  <div>
                    <p className="text-gray-800 font-medium text-base leading-relaxed">
                      {card.questions?.question_text || "Question unavailable"}
                    </p>
                    <p className="text-gray-400 text-xs mt-4">Tap to reveal answer</p>
                  </div>
                ) : (
                  <div className="space-y-4 w-full">
                    {["A","B","C","D"].map(opt => {
                      const label = card.questions?.[`option_${opt.toLowerCase()}`];
                      const isCorrect = card.questions?.correct_option === opt;
                      return (
                        <div
                          key={opt}
                          className={`text-left px-4 py-2 rounded-xl text-sm ${
                            isCorrect
                              ? "bg-green-50 border border-green-300 text-green-800 font-medium"
                              : "bg-gray-50 text-gray-500"
                          }`}
                        >
                          <span className="font-medium mr-2">{opt}.</span>{label}
                        </div>
                      );
                    })}
                    {card.questions?.explanation && (
                      <p className="text-xs text-gray-400 mt-2 text-left">
                        {card.questions.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Rating buttons */}
              {flipped && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Again", q: 1, color: "border-red-200 text-red-600 hover:bg-red-50" },
                    { label: "Hard", q: 3, color: "border-amber-200 text-amber-600 hover:bg-amber-50" },
                    { label: "Easy", q: 5, color: "border-green-200 text-green-600 hover:bg-green-50" },
                  ].map(b => (
                    <button
                      key={b.label}
                      onClick={() => handleRate(b.q)}
                      className={`border rounded-xl py-2.5 text-sm font-medium transition ${b.color}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === "decks" && (
        <div className="space-y-6">
          {decks.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Your decks</h2>
              <div className="space-y-2">
                {decks.map(d => (
                  <div key={d.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{d.topics?.title}</div>
                      <div className="text-xs text-gray-400">{d.topics?.subject}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        d.source === "quiz_weakness"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-indigo-50 text-indigo-600"
                      }`}>
                        {d.source === "quiz_weakness" ? "weak topic" : "manual"}
                      </span>
                      <button
                        onClick={() => handleRemoveDeck(d.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded-full hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Add topic to deck</h2>
            <div className="space-y-2">
              {topics
                .filter(t => !decks.find(d => d.topic_id === t.id))
                .map(t => (
                  <div key={t.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{t.title}</div>
                      <div className="text-xs text-gray-400">{t.subject}</div>
                    </div>
                    <button
                      onClick={() => handleAddDeck(t.id)}
                      className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full hover:bg-indigo-100"
                    >
                      Add
                    </button>
                  </div>
                ))}
              {topics.filter(t => !decks.find(d => d.topic_id === t.id)).length === 0 && (
                <p className="text-sm text-gray-400">All topics already in your decks.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
