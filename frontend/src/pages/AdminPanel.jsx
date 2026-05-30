import { useEffect, useState } from "react";
import { syncNotion, getTopics, generateQuestions, getDraftQuestions, reviewQuestion } from "../lib/api";

export default function AdminPanel() {
  const [topics, setTopics] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(null); // topic id being generated
  const [syncResult, setSyncResult] = useState(null);
  const [tab, setTab] = useState("sync"); // sync | review

  useEffect(() => {
    getTopics().then(r => setTopics(r.data));
    getDraftQuestions().then(r => setDrafts(r.data));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await syncNotion();
      setSyncResult(data);
      getTopics().then(r => setTopics(r.data));
    } catch (e) {
      setSyncResult({ error: e.response?.data?.detail || "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerate = async (topicId) => {
    setGenerating(topicId);
    try {
      const { data } = await generateQuestions(topicId, 30);
      alert(`Generated ${data.generated} draft questions for "${data.topic}". Go to Review tab.`);
      getDraftQuestions().then(r => setDrafts(r.data));
      setTab("review");
    } catch (e) {
      alert(e.response?.data?.detail || "Generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const handleReview = async (id, status) => {
    await reviewQuestion(id, status);
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Admin panel</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-3">
        {[
          { id: "sync", label: "Notion sync & generate" },
          { id: "review", label: `Review drafts ${drafts.length > 0 ? `(${drafts.length})` : ""}` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-sm px-4 py-1.5 rounded-lg ${
              tab === t.id ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sync" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="font-medium text-gray-800">Sync Notion notes</h2>
            <p className="text-sm text-gray-500">Pull the latest pages from your Notion database into the app.</p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync now"}
            </button>
            {syncResult && (
              <div className={`text-sm p-3 rounded-lg ${syncResult.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {syncResult.error
                  ? syncResult.error
                  : `Synced ${syncResult.synced} topics (${syncResult.failed} failed)`
                }
              </div>
            )}
          </div>

          <div>
            <h2 className="font-medium text-gray-800 mb-3">Generate questions per topic</h2>
            <div className="space-y-2">
              {topics.map(t => (
                <div key={t.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{t.title}</div>
                    <div className="text-xs text-gray-400">{t.subject}</div>
                  </div>
                  <button
                    onClick={() => handleGenerate(t.id)}
                    disabled={generating === t.id}
                    className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {generating === t.id ? "Generating..." : "Generate Questions"}
                  </button>
                </div>
              ))}
              {topics.length === 0 && (
                <p className="text-sm text-gray-400">No topics yet. Sync Notion first.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "review" && (
        <div className="space-y-4">
          {drafts.length === 0 ? (
            <p className="text-gray-400 text-sm">No draft questions pending review.</p>
          ) : (
            drafts.map(q => (
              <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-indigo-600 font-medium">{q.topics?.title}</span>
                  <span className="text-xs text-gray-400">{q.topics?.subject}</span>
                </div>
                <p className="text-sm font-medium text-gray-800">{q.question_text}</p>
                <div className="space-y-1">
                  {["A","B","C","D"].map(opt => (
                    <div
                      key={opt}
                      className={`text-xs px-3 py-1.5 rounded-lg ${
                        q.correct_option === opt
                          ? "bg-green-50 text-green-700 font-medium"
                          : "text-gray-500"
                      }`}
                    >
                      <span className="font-medium mr-1">{opt}.</span>
                      {q[`option_${opt.toLowerCase()}`]}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p className="text-xs text-gray-400 italic">{q.explanation}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleReview(q.id, "approved")}
                    className="flex-1 bg-green-600 text-white text-xs py-2 rounded-lg hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReview(q.id, "rejected")}
                    className="flex-1 bg-red-50 text-red-600 text-xs py-2 rounded-lg hover:bg-red-100"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
