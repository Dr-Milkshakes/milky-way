import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTopics, getSubjects, startQuiz, submitQuiz } from "../lib/api";

export default function Quiz() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get("subject") || "");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [phase, setPhase] = useState("setup"); // setup | active | submitting
  const [session, setSession] = useState(null);  // { session_id, questions }
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});    // { question_id: selected_option }
  const [selected, setSelected] = useState(null);

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
      setPhase("active");
    } catch (e) {
      alert(e.response?.data?.detail || "Could not start quiz. Make sure there are approved questions.");
    }
  };

  const handleAnswer = (option) => {
    setSelected(option);
  };

  const handleNext = () => {
    if (!selected) return;
    const q = session.questions[current];
    setAnswers(prev => ({ ...prev, [q.id]: selected }));
    setSelected(null);
    if (current + 1 < session.questions.length) {
      setCurrent(current + 1);
    } else {
      handleSubmit({ ...answers, [q.id]: selected });
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
            type="range" min={5} max={30} value={numQuestions}
            onChange={e => setNumQuestions(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>5</span><span>30</span>
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

  // Active quiz
  const q = session.questions[current];
  const opts = ["A", "B", "C", "D"];
  const optLabels = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
  const progress = ((current) / session.questions.length) * 100;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Question {current + 1} of {session.questions.length}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-indigo-600 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
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
            onClick={() => handleAnswer(opt)}
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

      <button
        onClick={handleNext}
        disabled={!selected}
        className="w-full bg-indigo-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
      >
        {current + 1 === session.questions.length ? "Submit quiz" : "Next question"}
      </button>
    </div>
  );
}
