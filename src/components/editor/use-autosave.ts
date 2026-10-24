"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import type { QuizDocument } from "@/lib/domain/schema";

export type SaveStatus = "saved" | "dirty" | "saving" | "error";

/**
 * Debounced autosave of the full quiz document. Saves are serialised: if the document changes
 * while a save is in flight, another save follows once it finishes.
 */
export function useAutosave(quizId: string, document: QuizDocument, delayMs = 1200) {
  const json = JSON.stringify(document);
  const lastSaved = useRef(json);
  const inFlight = useRef(false);
  const latest = useRef(json);
  useEffect(() => {
    latest.current = json;
  });
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false;
    const body = latest.current;
    if (body === lastSaved.current) {
      setStatus("saved");
      return true;
    }
    inFlight.current = true;
    setStatus("saving");
    try {
      await apiFetch(`/api/quizzes/${quizId}`, { method: "PUT", body: JSON.parse(body) });
      lastSaved.current = body;
      setError(null);
      setSavedAt(Date.now());
      setStatus(latest.current === body ? "saved" : "dirty");
      return true;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Spremanje nije uspjelo.");
      setStatus("error");
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [quizId]);

  // `status` is a dependency on purpose: when a save finishes while newer edits exist,
  // the status flips to "dirty" and this effect schedules the follow-up save.
  useEffect(() => {
    if (json === lastSaved.current) return;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    const timer = window.setTimeout(() => void save(), delayMs);
    return () => window.clearTimeout(timer);
  }, [json, delayMs, save, status]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (latest.current !== lastSaved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  /** Saves immediately and waits for any in-flight save. */
  const flush = useCallback(async () => {
    for (let i = 0; i < 40 && inFlight.current; i++) await new Promise((r) => setTimeout(r, 100));
    return save();
  }, [save]);

  return { status, error, savedAt, flush };
}
