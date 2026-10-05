import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Holds back any in-app navigation away from the current page — a link, the
 * navbar, the browser's Back button — while `isDirty()` says there is unsaved
 * work, and warns on a refresh or closed tab, which the app can't intercept.
 *
 * `isDirty` is a function read at navigation time rather than a boolean from
 * the last render, so a page that saves and then changes its own URL in the
 * same tick (a new record moving to /:id) isn't blocked by stale state.
 *
 * Returns the router blocker: `blocker.state === "blocked"` while the prompt
 * should show; call `blocker.proceed()` to leave or `blocker.reset()` to stay.
 */
const useUnsavedChangesPrompt = (isDirty) => {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname && isDirty()
  );

  useEffect(() => {
    // Browsers show their own wording here; the flag is all they take.
    const warn = (event) => {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  return blocker;
};

export default useUnsavedChangesPrompt;
