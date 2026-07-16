import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { KeyRound, User, Loader2, Eye, EyeOff } from "lucide-react"; // Import Loader2, Eye, EyeOff
import logo from "../assets/logo.png";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // New loading state
  const [showPassword, setShowPassword] = useState(false); // Toggle visibility state
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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Texture/Gradient - Industrial Vibe */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-80"></div>
      
      {/* Subtle Grid Pattern for Technical Feel */}
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      <div className="bg-gray-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-800 relative z-10">
        
        {/* Aesthetic "Bolts" or Industrial Accents */}
        <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-red-600/50 rounded-tl-lg"></div>
        <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-red-600/50 rounded-br-lg"></div>

        <div className="text-center mb-10">
           <div className="inline-flex items-center justify-center w-24 h-24 bg-black/40 rounded-full mb-6 shadow-lg border border-gray-700 p-2 ring-1 ring-gray-700/50">
             <img src={logo} alt="NSS Logo" className="w-full h-full object-contain opacity-90 hover:opacity-100 transition-opacity" />
           </div>
          <h1 className="text-3xl font-bold text-white tracking-wide uppercase">Inventory Access</h1>
          <p className="text-gray-400 text-xs mt-2 font-medium tracking-wider">NSS Auto Spares Management System</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-900/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-center text-sm font-medium flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">
              Operator ID
            </label>
            <div className="relative group">
              <User className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-red-500 transition-colors" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 p-3 bg-black/40 border border-gray-700/50 rounded-lg focus:bg-black/60 focus:border-red-600/50 focus:ring-1 focus:ring-red-600/50 outline-none transition-all font-mono text-gray-300 placeholder-gray-600"
                placeholder="ENTER USERNAME"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">
              Passcode
            </label>
            <div className="relative group">
              <KeyRound
                className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-red-500 transition-colors"
                size={18}
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 p-3 bg-black/40 border border-gray-700/50 rounded-lg focus:bg-black/60 focus:border-red-600/50 focus:ring-1 focus:ring-red-600/50 outline-none transition-all font-mono text-gray-300 placeholder-gray-600"
                placeholder="••••••••"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 focus:outline-none transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-lg font-bold uppercase tracking-wider text-sm shadow-lg flex justify-center items-center gap-2 transition-all duration-300
                ${
                    loading
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-red-700 hover:bg-red-600 text-white shadow-red-900/20 border-b-2 border-red-900 hover:border-red-800 active:border-none active:translate-y-[2px]"
                }`}
            >
                {loading ? (
                <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Authenticating...</span>
                </>
                ) : (
                "Sign In"
                )}
            </button>
          </div>
        </form>
        
        <div className="mt-8 text-center">
            <p className="text-[10px] text-gray-600 font-mono uppercase">System v1.0.0 | Authorized Personnel Only</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
