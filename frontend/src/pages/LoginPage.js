import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { Loader2, Eye, EyeOff, ArrowRight, Github } from "lucide-react";
import logo from "../assets/logo.png";

// The faint technical grid behind everything, plus the reference's full-height
// column rules. Purely decorative, so it never intercepts clicks.
const GridBackdrop = () => (
  <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    />
    {["14%", "38%", "62%"].map((left) => (
      <div
        key={left}
        className="absolute top-0 bottom-0 w-px bg-white/[0.05] hidden lg:block"
        style={{ left }}
      />
    ))}
    {/* Soft light falling in from the top-left, as in the reference. */}
    <div className="absolute -top-40 -left-40 w-[38rem] h-[38rem] rounded-full bg-white/[0.04] blur-[120px]" />
    <div className="absolute top-1/3 -right-32 w-[26rem] h-[26rem] rounded-full bg-red-700/10 blur-[130px]" />
  </div>
);

const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-600">
    <span className="text-red-600">{"//"}</span> {children}
  </p>
);

// ─── Set this to your GitHub profile or the repo URL. ────────────────────────
const GITHUB_URL = "https://github.com/JehanSilva";

const CAPABILITIES = [
  "Point-of-sale billing & printed invoices",
  "Live stock, restocking & returns",
  "Customers, vehicles & service history",
];

const MODULES = [
  { label: "Counter", items: ["Point of sale", "Invoices & receipts", "Credit & part payment"] },
  { label: "Workshop", items: ["Repair pricing", "Vehicle history", "Insurance estimates"] },
  { label: "Back office", items: ["Stock & restocking", "Sales & daily reports", "Staff & payroll"] },
];

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

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none backdrop-blur-sm transition-all focus:border-red-500/50 focus:bg-black/60 focus:ring-2 focus:ring-red-600/15 disabled:opacity-50";

  return (
    <div className="min-h-screen lg:h-screen bg-black p-3 md:p-4 font-display antialiased lg:overflow-hidden">
      <div className="relative min-h-[calc(100vh-1.5rem)] lg:h-full lg:min-h-0 flex flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#0d0d0d]">
        <GridBackdrop />

        {/* ── ROW 1: headline + sign-in ─────────────────────────────── */}
        <div className="relative flex flex-1 lg:min-h-0 flex-col lg:flex-row">
          {/* The form is why anyone opens this page, so on phones it comes
              first and the headline follows. */}
          <div className="order-first lg:order-last w-full lg:w-[440px] xl:w-[480px] shrink-0 border-b lg:border-b-0 lg:border-l border-white/[0.06] p-6 sm:p-8 lg:pl-8 lg:pr-14 xl:pl-10 xl:pr-16 flex items-center">
            <div className="relative w-full animate-login-rise" style={{ animationDelay: "80ms" }}>
              <div
                className="pointer-events-none absolute -inset-10 rounded-[56px] bg-red-600/[0.025] blur-[72px]"
                aria-hidden="true"
              />
              <div className="relative rounded-[28px] border border-white/[0.08] bg-black/50 p-6 sm:p-7 lg:p-6 xl:p-7 shadow-[0_28px_70px_-20px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
                {/* Light catching the top edge — what sells the glass. */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-b from-white/[0.05] via-transparent to-transparent"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  aria-hidden="true"
                />
                <div className="relative">

                  <h2 className="font-display text-2xl lg:text-[24px] xl:text-[28px] font-bold leading-[1.1] tracking-tight text-white">
                    Sign in to the
                    <br />
                    workshop <span className="text-red-600">system</span>
                  </h2>

                  <p className="mt-4 xl:mt-5 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
                    You'll have access to:
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {CAPABILITIES.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[12.5px] text-slate-400">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-red-600" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="my-4 xl:my-5 h-px bg-white/10" />

                  {error && (
                    <div
                      role="alert"
                      className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] font-medium text-red-300 backdrop-blur-sm"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleLogin}>
                    <label
                      htmlFor="login-username"
                      className="block text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500"
                    >
                      Username
                    </label>
                    <input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={inputClass}
                      placeholder="Type your username"
                      autoComplete="username"
                      required
                      disabled={loading}
                    />

                    <label
                      htmlFor="login-password"
                      className="mt-4 xl:mt-5 block text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputClass} pr-11`}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={loading}
                        className="absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300 focus:outline-none"
                        title={showPassword ? "Hide password" : "Show password"}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Left accent bar + trailing arrow, as in the reference. */}
                    <button
                      type="submit"
                      disabled={loading}
                      className={`group mt-6 xl:mt-7 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold transition-all ${loading
                        ? "cursor-not-allowed border border-white/[0.08] bg-black/40 text-slate-500"
                        : "bg-red-600 text-white shadow-lg shadow-red-950/50 hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-xl hover:shadow-red-900/50 active:translate-y-0"
                        }`}
                    >
                      {loading ? (
                        <>
                          <span>Authenticating…</span>
                          <Loader2 className="animate-spin" size={16} />
                        </>
                      ) : (
                        <>
                          <span>Sign In</span>
                          <ArrowRight
                            size={16}
                            className="transition-transform group-hover:translate-x-1"
                          />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="flex flex-1 flex-col justify-center p-6 sm:p-10 lg:px-12 lg:py-8 xl:px-14">
            <div className="animate-login-rise">
              <SectionLabel>NSS Auto Spares Management System</SectionLabel>
            </div>

            <h1
              className="animate-login-rise mt-6 font-display font-black leading-[0.82] tracking-[-0.045em] text-white"
              style={{ fontSize: "clamp(2.5rem, min(8.5vw, 15vh), 7.5rem)", animationDelay: "120ms" }}
            >
              NSS
              <br />
              Auto
              <br />
              Engineers
              <span className="text-red-600">.</span>
            </h1>

            <p
              className="animate-login-rise mt-6 max-w-xl text-sm leading-relaxed text-slate-400 xl:text-[15px]"
              style={{ animationDelay: "200ms" }}
            >
              Spare parts, repairs, and the paperwork in between. One system for the counter, the
              workshop floor and the back office — billing that deducts stock as it prints, inventory
              that tracks every restock and return, and vehicles remembered by their plate.
            </p>
          </div>
        </div>

        {/* ── ROW 2: what the system covers ─────────────────────────── */}
        <div className="relative hidden border-t border-white/[0.06] sm:grid sm:grid-cols-3 [@media(max-height:780px)]:!hidden">
          {MODULES.map(({ label, items }, i) => (
            <div
              key={label}
              className={`p-6 lg:px-12 lg:py-5 xl:px-14 ${i > 0 ? "border-l border-white/[0.06]" : ""}`}
            >
              <SectionLabel>{label}</SectionLabel>
              <ul className="mt-3 space-y-1.5">
                {items.map((item) => (
                  <li key={item} className="text-[13px] text-slate-400">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── ROW 3: footer bar ─────────────────────────────────────── */}
        <div className="relative flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] px-6 py-3.5 text-center sm:flex-row sm:text-left lg:px-12 xl:px-14">
          <div className="flex items-center gap-2.5">
            {/* The logo mark is red on transparent with baked-in whitespace, so
                it sits on a white chip and is sized width-only (see Invoice.js). */}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
              <img src={logo} alt="" className="w-6 h-auto" />
            </span>
            <span className="text-[13px] font-bold text-white">NSS Auto Spares</span>
          </div>

          <p className="text-[11px] text-slate-600">
            © {new Date().getFullYear()} NSS Auto Engineers
          </p>

          {/* Renders as a link once GITHUB_URL is filled in above, and as plain
              text until then — so an empty URL never ships a dead anchor. */}
          {React.createElement(
            GITHUB_URL ? "a" : "div",
            {
              ...(GITHUB_URL
                ? { href: GITHUB_URL, target: "_blank", rel: "noopener noreferrer" }
                : {}),
              className:
                "group flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-slate-300",
            },
            <>
              <Github size={13} className="shrink-0 transition-colors group-hover:text-white" />
              <span>
                Developed by{" "}
                <span className="font-semibold text-slate-300 group-hover:text-white">
                  Jehan Silva
                </span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
