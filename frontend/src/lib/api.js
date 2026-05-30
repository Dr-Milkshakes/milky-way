import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const login = (email, password) =>
  api.post("/api/auth/login", { email, password });

export const register = (data) =>
  api.post("/api/auth/register", data);

export const getMe = () => api.get("/api/auth/me");

// Topics
export const getTopics = (subject) =>
  api.get("/api/topics", { params: subject ? { subject } : {} });

export const getSubjects = () => api.get("/api/subjects");

// Quiz
export const startQuiz = (data) => api.post("/api/quiz/start", data);
export const submitQuiz = (sessionId, answers) =>
  api.post(`/api/quiz/submit/${sessionId}`, answers);
export const getQuizHistory = () => api.get("/api/quiz/history");

// Flashcards
export const getDueFlashcards = (topicId) =>
  api.get("/api/flashcards/due", { params: topicId ? { topic_id: topicId } : {} });
export const reviewFlashcard = (id, quality) =>
  api.post(`/api/flashcards/${id}/review`, { quality });
export const addTopicToDeck = (topicId) =>
  api.post(`/api/flashcards/add-topic/${topicId}`);
export const getMyDecks = () => api.get("/api/flashcards/my-decks");
export const getFlashcardStats = () => api.get("/api/flashcards/stats");

// Admin
export const syncNotion = () => api.post("/api/notion/sync");
export const getDraftQuestions = (topicId) =>
  api.get("/api/questions/drafts", { params: topicId ? { topic_id: topicId } : {} });
export const reviewQuestion = (id, status) =>
  api.patch(`/api/questions/${id}/review`, { status });
export const generateQuestions = (topicId, numQuestions = 10) =>
  api.post("/api/questions/generate", null, {
    params: { topic_id: topicId, num_questions: numQuestions },
  });

export default api;
