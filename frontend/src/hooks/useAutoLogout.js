import { useEffect, useRef } from "react";
import { logoutUser } from "../services/api";

// 1 Hour in milliseconds
const INACTIVITY_LIMIT = 60 * 60 * 1000;

const useAutoLogout = () => {
  const timerRef = useRef(null);

  useEffect(() => {
    // 1. Function to logout
    const handleLogout = () => {
      // Optional: Add a flag so you can show a "Session Expired" message on the login screen
      localStorage.setItem("session_expired", "true");
      logoutUser();
    };

    // 2. Function to reset the timer
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleLogout, INACTIVITY_LIMIT);
    };

    // 3. Listen for these events to detect "Activity"
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
    ];

    // 4. Attach listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // 5. Start the initial timer
    resetTimer();

    // 6. Cleanup (Remove listeners when App closes)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);
};

export default useAutoLogout;
