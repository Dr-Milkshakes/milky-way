import { useEffect, useState, useCallback } from "react";
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
  const [selectedTopic, setSelectedTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimit, setTimeLimit] = useState(null); // minutes
  const [phase, setPhase] = useState("setup");
  const [session, setSession] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null); // seconds
  const [timeWarning, setTimeWarning] = useState(false);

  useEffect(() => {
    getSubjects().then(r => setSubjects(r.data));
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      getTopics(selectedSubject).then(r => setTopics(r.data));
    } else {
      setTopics([]);
      setSelectedTopic("");
    }
  }, [selectedSubject]);

  // Timer countdown
  useEffect(() => {
    if (phase !== "active" || timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit(answers);
      return;
    }
    if (timeLeft <= 120) setTimeWarning(true); // warn at 2 min left
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, timeLeft]);

  const handleStart = async () => {
    const payload = { num_questions: numQuestions };
    if (selectedTopic) payload.topic_id = selectedTopic;
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <select
            value={selectedSubject}
            onChange={e => { setSelectedSubject(e.target.value); setSelectedTopic(""); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {topics.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Topic (optional)</label>
            <select
              value={selectedTopic}
              onChange={e => setSelectedTopic(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All topics in subject</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

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
      {/* Header row — progress + timer */}
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
          onClick={() => {
            const q = session.questions[current];
            const newAnswers = { ...answers };
            setSelected(null);
            if (current + 1 < session.questions.length) {
              setCurrent(current + 1);
            } else {
              handleSubmit(newAnswers);
            }
          }}
          className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-3 text-sm hover:bg-gray-50"
        >
          Skip
        </button>
        <button
          onClick={handleNext}
          disabled={!selected}
          className="flex-2 w-full bg-indigo-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          {current + 1 === session.questions.length ? "Submit quiz" : "Next question"}
        </button>
      </div>
    </div>
  );
}
