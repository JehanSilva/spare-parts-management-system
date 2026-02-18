import { useEffect, useRef, useCallback } from "react";
import { logoutUser } from "../services/api";

// 1 Hour in milliseconds
const INACTIVITY_LIMIT = 60 * 60 * 1000;

// Helper to decode JWT payload (since jwt-decode might not be installed)
const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    return null;
  }
};

const useAutoLogout = () => {
  const timerRef = useRef(null);

  // Function to check if token is expired
  const checkTokenExpiration = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return; // No token, nothing to do (already logged out or public page)

    const decoded = parseJwt(token);
    if (decoded && decoded.exp) {
      // exp is in seconds, convert to milliseconds
      const expirationTime = decoded.exp * 1000;
      const currentTime = Date.now();

      if (currentTime >= expirationTime) {
        console.log("Token expired. Auto-logging out.");
        logoutUser();
      }
    }
  }, []);

  useEffect(() => {
    // 1. Function to logout due to inactivity
    const handleInactivityLogout = () => {
      localStorage.setItem("session_expired", "true");
      logoutUser();
    };

    // 2. Function to reset the inactivity timer
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT);
    };

    // 3. Listen for these events to detect "Activity"
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
    ];

    // 4. Attach listeners for inactivity
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // 5. Check token on load and focus
    checkTokenExpiration(); // Check immediately on mount
    window.addEventListener("focus", checkTokenExpiration); // Check when tab gets focus

    // 6. Start the initial inactivity timer
    resetTimer();

    // 7. Cleanup
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      window.removeEventListener("focus", checkTokenExpiration);
    };
  }, [checkTokenExpiration]);
};

export default useAutoLogout;
