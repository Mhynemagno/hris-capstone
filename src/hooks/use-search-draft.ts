"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The text a person is typing in a search box, kept apart from the list's committed search.
 * The box updates instantly, the list is queried once typing pauses (or on Enter), and a
 * committed value coming back from the URL never overwrites what is being typed. Only an
 * outside change (Clear all, Back, a dashboard link) replaces the draft.
 */
export function useSearchDraft(value: string, onCommit: (value: string) => void, delay = 300) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [committed, setCommitted] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitRef = useRef(onCommit);
  useEffect(() => { commitRef.current = onCommit; });
  useEffect(() => {
    // A list can remain mounted briefly while Next begins a client-side Link navigation.
    // Cancel a pending search so its delayed callback cannot rewrite the destination URL.
    function cancelForNavigation(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest("a[href]")) {
        clearTimeout(timer.current);
      }
    }

    document.addEventListener("click", cancelForNavigation, true);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("click", cancelForNavigation, true);
    };
  }, []);

  if (value !== seen) {
    setSeen(value);
    if (value !== committed) {
      setCommitted(value);
      setDraft(value);
    }
  }

  function commit(next: string) {
    clearTimeout(timer.current);
    const trimmed = next.trim();
    setCommitted(trimmed);
    commitRef.current(trimmed);
  }

  return {
    draft,
    change(next: string) {
      setDraft(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => commit(next), delay);
    },
    /** Search now (Enter key) instead of waiting for the pause. */
    flush() { commit(draft); },
    clear() { setDraft(""); commit(""); },
  };
}
