import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Milky Way" className="h-8 w-8 rounded-full object-cover" />
              <span className="font-semibold text-indigo-600 text-lg">Milky Way</span>
            </div>
          <div className="flex gap-6 text-sm">
            <NavLink to="/" end className={({ isActive }) =>
              isActive ? "text-indigo-600 font-medium" : "text-gray-500 hover:text-gray-800"}>
              Dashboard
            </NavLink>
            <NavLink to="/quiz" className={({ isActive }) =>
              isActive ? "text-indigo-600 font-medium" : "text-gray-500 hover:text-gray-800"}>
              Quiz
            </NavLink>
            <NavLink to="/flashcards" className={({ isActive }) =>
              isActive ? "text-indigo-600 font-medium" : "text-gray-500 hover:text-gray-800"}>
              Flashcards
            </NavLink>
            {user?.role === "admin" && (
              <NavLink to="/admin" className={({ isActive }) =>
                isActive ? "text-indigo-600 font-medium" : "text-gray-500 hover:text-gray-800"}>
                Admin
              </NavLink>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">{user?.username}</span>
          {user?.role === "admin" && (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">admin</span>
          )}
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500">
            Sign out
          </button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
