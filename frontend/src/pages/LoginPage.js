import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { KeyRound, User, Loader2 } from "lucide-react"; // Import Loader2

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // New loading state
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true); // Disable button & show spinner

    try {
      await loginUser(username, password);
      navigate("/");
    } catch (err) {
      setError("Invalid username or password");
      setLoading(false); // Re-enable button on error
    }
    // Note: We don't set loading(false) on success because we are navigating away immediately
  };

  useEffect(() => {
    const isExpired = localStorage.getItem("session_expired");
    if (isExpired) {
      alert("Your session expired due to inactivity. Please log in again.");
      localStorage.removeItem("session_expired");
    }
  }, []);

  return (
    <div className="min-h-screen bg-red-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">NSS Auto Spares</h1>
          <p className="text-gray-500">Sign in to access the system</p>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-center text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 p-3 border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none"
                placeholder="Enter username"
                required
                disabled={loading} // Disable input while loading
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <KeyRound
                className="absolute left-3 top-3 text-gray-400"
                size={20}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 p-3 border border-gray-300 rounded focus:ring-2 focus:ring-red-600 outline-none"
                placeholder="Enter password"
                required
                disabled={loading} // Disable input while loading
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded font-bold shadow-lg flex justify-center items-center gap-2 transition
              ${
                loading
                  ? "bg-red-400 cursor-not-allowed"
                  : "bg-red-700 hover:bg-red-800 text-white"
              }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
