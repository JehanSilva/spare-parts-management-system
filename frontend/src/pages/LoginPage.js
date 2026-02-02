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
      // Small delay to show the nice animation
      setTimeout(() => {
        navigate("/");
      }, 500); 
    } catch (err) {
      setError("Invalid username or password");
      setLoading(false); // Re-enable button on error
    }
  };

  useEffect(() => {
    const isExpired = localStorage.getItem("session_expired");
    if (isExpired) {
      setError("Session expired. Please log in again."); // Show as error message
      localStorage.removeItem("session_expired");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-black flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-600/10 rounded-full blur-3xl rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-red-800/20 rounded-full blur-3xl rounded-full"></div>

      <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-4 border-red-700 relative z-10 transition-all hover:shadow-red-900/20">
        <div className="text-center mb-8">
           <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full mb-4 shadow-inner">
             <User className="text-red-700 w-8 h-8" />
           </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Welcome Back</h1>
          <p className="text-gray-500 text-sm mt-2">Sign in to NSS Auto Spares Management</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-center text-sm font-medium flex items-center justify-center gap-2 animate-pulse">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">
              Username
            </label>
            <div className="relative group">
              <User className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-red-600 transition-colors" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-gray-700"
                placeholder="Enter your username"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">
              Password
            </label>
            <div className="relative group">
              <KeyRound
                className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-red-600 transition-colors"
                size={18}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-medium text-gray-700"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 transition-all duration-300 transform
                ${
                    loading
                    ? "bg-gray-800 text-gray-300 cursor-wait scale-[0.98]"
                    : "bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white hover:shadow-red-500/30 active:scale-[0.98]"
                }`}
            >
                {loading ? (
                <>
                    <Loader2 className="animate-spin" size={20} />
                    <span className="animate-pulse">Authenticating...</span>
                </>
                ) : (
                "Sign In to Dashboard"
                )}
            </button>
          </div>
        </form>
        
        <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">© 2024 NSS Auto Spares System</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
