"use client";

import { useEffect, useState } from "react";

type FeedbackModalProps = {
  open: boolean;
  type: "bug" | "feature";
  message: string;
  status: "idle" | "sending" | "sent" | "error";
  onTypeChange: (type: "bug" | "feature") => void;
  onMessageChange: (message: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
};

export function FeedbackModal({
  open,
  type,
  message,
  status,
  onTypeChange,
  onMessageChange,
  onSubmit,
  onClose,
}: FeedbackModalProps) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  // Mount/unmount tracks `open` with a delay on the way out, so the closing
  // transition gets to play before the dialog leaves the DOM.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setMounted(true), 0);
      return () => clearTimeout(t);
    }
    const showTimeout = setTimeout(() => setShow(false), 0);
    const mountTimeout = setTimeout(() => setMounted(false), 200);
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(mountTimeout);
    };
  }, [open]);

  // Once mounted, flip `show` on the next frame so the initial paint is the
  // closed state and the transition to open actually animates.
  useEffect(() => {
    if (!open || !mounted) return;
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-void/70 px-6 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${
        show ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send feedback"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-xl border border-panel-hi bg-panel p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] transition-all duration-200 motion-reduce:transition-none ${
          show ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">
            Send feedback
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-mist hover:bg-panel-hi hover:text-ink"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M2 2L12 12M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div
            className="relative flex items-center self-start rounded-full bg-panel-hi p-1"
            role="group"
            aria-label="Feedback type"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-1 left-1 w-20 rounded-full bg-panel shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${
                type === "feature" ? "translate-x-20" : "translate-x-0"
              }`}
            />
            <button
              type="button"
              onClick={() => onTypeChange("bug")}
              aria-pressed={type === "bug"}
              className={`relative z-10 w-20 rounded-full px-3 py-1 font-sans text-xs font-medium transition-colors duration-200 ${
                type === "bug" ? "text-ink" : "text-mist hover:text-ink"
              }`}
            >
              Bug
            </button>
            <button
              type="button"
              onClick={() => onTypeChange("feature")}
              aria-pressed={type === "feature"}
              className={`relative z-10 w-20 rounded-full px-3 py-1 font-sans text-xs font-medium transition-colors duration-200 ${
                type === "feature" ? "text-ink" : "text-mist hover:text-ink"
              }`}
            >
              Idea
            </button>
          </div>

          <textarea
            autoFocus
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder={type === "bug" ? "What went wrong?" : "What would you like to see?"}
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-md border border-panel-hi bg-void px-3 py-2 font-sans text-sm text-ink placeholder:text-mist outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          />

          {status === "sent" && (
            <span className="font-sans text-xs text-signal">Thanks — got it.</span>
          )}
          {status === "error" && (
            <span className="font-sans text-xs text-danger">Couldn&apos;t send that.</span>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!message.trim() || status === "sending"}
              className="rounded-md bg-signal px-4 py-1.5 font-sans text-xs font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {status === "sending" ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-sans text-xs text-mist hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
