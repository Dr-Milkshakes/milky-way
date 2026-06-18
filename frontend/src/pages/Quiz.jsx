import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTopics, getSubjects, startQuiz, submitQuiz } from "../lib/api";

const TIME_OPTIONS = [
  { label: "10 min", value: 10 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "No limit", value: null },
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function Quiz() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get("subject") || "");
  const [selectedTopics, setSelectedTopics] = useState([]); // array of topic ids
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimit, setTimeLimit] = useState(null);
  const [phase, setPhase] = useState("setup");
  const [session, setSession] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timeWarning, setTimeWarning] = useState(false);

  useEffect(() => {
    getSubjects().then(r => setSubjects(r.data));
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      getTopics(selectedSubject).then(r => setTopics(r.data));
    } else {
      setTopics([]);
      setSelectedTopics([]);
    }
  }, [selectedSubject]);

  // Timer countdown
  useEffect(() => {
    if (phase !== "active" || timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit(answers);
      return;
    }
    if (timeLeft <= 120) setTimeWarning(true);
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, timeLeft]);

  const toggleTopic = (topicId) => {
    setSelectedTopics(prev =>
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    );
  };

  const handleStart = async () => {
    const payload = { num_questions: numQuestions };
    if (selectedTopics.length > 0) payload.topic_ids = selectedTopics;
    else if (selectedSubject) payload.subject = selectedSubject;

    try {
      const { data } = await startQuiz(payload);
      setSession(data);
      setCurrent(0);
      setAnswers({});
      setSelected(null);
      if (timeLimit) setTimeLeft(timeLimit * 60);
      setPhase("active");
    } catch (e) {
      alert(e.response?.data?.detail || "Could not start quiz. Make sure there are approved questions.");
    }
  };

  const handleNext = () => {
    if (!selected) return;
    const q = session.questions[current];
    const newAnswers = { ...answers, [q.id]: selected };
    setAnswers(newAnswers);
    setSelected(null);
    if (current + 1 < session.questions.length) {
      setCurrent(current + 1);
    } else {
      handleSubmit(newAnswers);
    }
  };

  const handleSkip = () => {
    const newAnswers = { ...answers };
    setSelected(null);
    if (current + 1 < session.questions.length) {
      setCurrent(current + 1);
    } else {
      handleSubmit(newAnswers);
    }
  };

  const handleSubmit = async (finalAnswers) => {
    setPhase("submitting");
    const payload = Object.entries(finalAnswers).map(([question_id, selected_option]) => ({
      question_id,
      selected_option,
    }));
    try {
      await submitQuiz(session.session_id, payload);
      navigate(`/quiz/result/${session.session_id}`);
    } catch (e) {
      alert("Submission failed. Please try again.");
      setPhase("active");
    }
  };

  if (phase === "setup") {
    return (
      <div className="max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold text-gray-800">Start a quiz</h1>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <select
            value={selectedSubject}
            onChange={e => { setSelectedSubject(e.target.value); setSelectedTopics([]); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Topics — multi select */}
        {topics.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Topics
                {selectedTopics.length > 0 && (
                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                    {selectedTopics.length} selected
                  </span>
                )}
              </label>
              {selectedTopics.length > 0 && (
                <button
                  onClick={() => setSelectedTopics([])}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
              {topics.map((t, i) => (
                <div
                  key={t.id}
                  onClick={() => toggleTopic(t.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition ${
                    i !== 0 ? "border-t border-gray-100" : ""
                  } ${
                    selectedTopics.includes(t.id)
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selectedTopics.includes(t.id)
                      ? "bg-indigo-600 border-indigo-600"
                      : "border-gray-300"
                  }`}>
                    {selectedTopics.includes(t.id) && (
                      <span className="text-white text-xs">✓</span>
                    )}
                  </div>
                  {t.title}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {selectedTopics.length === 0
                ? "No topics selected — all topics in subject will be used"
                : `Questions drawn from ${selectedTopics.length} topic${selectedTopics.length > 1 ? "s" : ""}`
              }
            </p>
          </div>
        )}

        {/* Number of questions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of questions: {numQuestions}
          </label>
          <input
            type="range" min={5} max={50} value={numQuestions}
            onChange={e => setNumQuestions(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>5</span><span>50</span>
          </div>
        </div>

        {/* Time limit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Time limit</label>
          <div className="grid grid-cols-5 gap-2">
            {TIME_OPTIONS.map(t => (
              <button
                key={t.label}
                onClick={() => setTimeLimit(t.value)}
                className={`py-2 rounded-xl text-sm font-medium border transition ${
                  timeLimit === t.value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          className="w-full bg-indigo-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-indigo-700"
        >
          Start quiz
        </button>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        Calculating results...
      </div>
    );
  }

  const q = session.questions[current];
  const opts = ["A", "B", "C", "D"];
  const optLabels = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
  const progress = (current / session.questions.length) * 100;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Question {current + 1} of {session.questions.length}
        </span>
        {timeLeft !== null && (
          <span className={`text-sm font-mono font-semibold px-3 py-1 rounded-full ${
            timeWarning
              ? "bg-red-50 text-red-600 animate-pulse"
              : "bg-gray-100 text-gray-600"
          }`}>
            ⏱ {formatTime(timeLeft)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-indigo-600 h-1.5 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <p className="text-gray-800 font-medium text-base leading-relaxed">{q.question_text}</p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {opts.map(opt => (
          <button
            key={opt}
            onClick={() => setSelected(opt)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
              selected === opt
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`}
          >
            <span className="font-medium mr-2">{opt}.</span> {optLabels[opt]}
          </button>
        ))}
      </div>

      {/* Skip + Next */}
      <div className="flex gap-3">
        <button
          onClick={handleSkip}
          className="px-6 border border-gray-200 text-gray-500 rounded-lg py-3 text-sm hover:bg-gray-50"
        >
          Skip
        </button>
        <button
          onClick={handleNext}
          disabled={!selected}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          {current + 1 === session.questions.length ? "Submit quiz" : "Next question"}
        </button>
      </div>
    </div>
  );
}
