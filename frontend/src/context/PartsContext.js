/**
 * PartsContext — Global in-memory cache for all parts.
 *
 * Fetches ALL parts from the API once and stores them here.
 * Both InventoryPage and POSPage read from this cache and filter
 * client-side — no API calls per keystroke.
 *
 * Cache stays fresh by:
 *  - Being invalidated after any mutation (create/update/delete/restock)
 *  - Auto-refreshing every 5 minutes in the background
 *  - Refetching when the browser tab regains focus (if data > 2 min stale)
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { fetchParts } from "../services/api";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const STALE_ON_FOCUS_MS   = 2 * 60 * 1000;   // refetch on focus if > 2 min old

const PartsContext = createContext(null);

export const PartsProvider = ({ children }) => {
  const [allParts, setAllParts]       = useState([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const lastFetchedRef                = useRef(null); // timestamp of last successful fetch
  const isFetchingRef                 = useRef(false);
  const location                      = useLocation();

  // ── Core fetch (silent = don't show spinner for background refresh) ──
  const doFetch = useCallback(async (silent = false) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setAllParts([]);
      setPartsLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!silent) setPartsLoading(true);

    try {
      const data = await fetchParts({});   // fetch ALL parts — no filters
      setAllParts(data);
      lastFetchedRef.current = Date.now();
    } catch (err) {
      console.error("[PartsCache] Failed to fetch parts:", err);
    } finally {
      isFetchingRef.current = false;
      if (!silent) setPartsLoading(false);
    }
  }, []);

  // ── Load/refresh parts on navigation to authenticated pages ──
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setAllParts([]);
      setPartsLoading(false);
      return;
    }

    if (location.pathname !== "/login" && allParts.length === 0) {
      doFetch(false); // Initial visible load
    }
  }, [location.pathname, doFetch, allParts.length]);

  // ── Periodic background refresh every 5 minutes ──
  useEffect(() => {
    const interval = setInterval(() => {
      doFetch(true); // silent — no spinner
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [doFetch]);

  // ── Refresh on tab focus if data is stale ──
  useEffect(() => {
    const handleFocus = () => {
      const age = Date.now() - (lastFetchedRef.current || 0);
      if (age > STALE_ON_FOCUS_MS) {
        doFetch(true); // silent
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [doFetch]);

  /**
   * Call this after any mutation (create/update/delete/restock/bulk-upload).
   * Triggers an immediate background refetch so the cache is up to date.
   * No loading spinner shown — the old data remains visible until the
   * new data arrives, making the UI feel instant.
   */
  const invalidateParts = useCallback(() => {
    doFetch(true);
  }, [doFetch]);

  /**
   * Force a full reload with a visible loading spinner.
   * Use for manual "refresh" buttons.
   */
  const refreshParts = useCallback(() => {
    doFetch(false);
  }, [doFetch]);

  // Interchangeable parts, grouped by interchange_group id.
  const partsByGroup = useMemo(() => {
    const map = new Map();
    allParts.forEach((p) => {
      if (p.interchange_group == null) return;
      if (!map.has(p.interchange_group)) map.set(p.interchange_group, []);
      map.get(p.interchange_group).push(p);
    });
    return map;
  }, [allParts]);

  /**
   * The other parts that can stand in for this one (same interchange group),
   * in-stock first, then by name. Pass a groupId to override a stale
   * snapshot of the part (e.g. straight after linking).
   */
  const alternativesFor = useCallback(
    (part, groupId) => {
      const group = groupId !== undefined ? groupId : part?.interchange_group;
      if (!part || group == null) return [];
      return (partsByGroup.get(group) || [])
        .filter((p) => p.id !== part.id)
        .sort((a, b) => (b.stock_qty > 0) - (a.stock_qty > 0) || a.name.localeCompare(b.name));
    },
    [partsByGroup]
  );

  /**
   * Search results with each match's compatible parts slotted in right after
   * it. Returns entries { part, compatibleWith } — compatibleWith is the
   * matched part a row was pulled in for (null for a direct match). A part
   * already in the results, or already added, isn't repeated.
   */
  const withCompatibleParts = useCallback(
    (results) => {
      const seen = new Set(results.map((p) => p.id));
      const out = [];
      results.forEach((match) => {
        out.push({ part: match, compatibleWith: null });
        alternativesFor(match).forEach((alt) => {
          if (seen.has(alt.id)) return;
          seen.add(alt.id);
          out.push({ part: alt, compatibleWith: match });
        });
      });
      return out;
    },
    [alternativesFor]
  );

  return (
    <PartsContext.Provider
      value={{ allParts, partsLoading, invalidateParts, refreshParts, alternativesFor, withCompatibleParts }}
    >
      {children}
    </PartsContext.Provider>
  );
};

/**
 * Hook — consume the parts cache from any component.
 *
 * @returns {{ allParts: Array, partsLoading: boolean, invalidateParts: Function, refreshParts: Function }}
 */
export const useParts = () => {
  const ctx = useContext(PartsContext);
  if (!ctx) {
    throw new Error("useParts must be used inside <PartsProvider>");
  }
  return ctx;
};
