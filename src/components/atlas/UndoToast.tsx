"use client";

import { useEffect } from "react";
import { colors } from "@/lib/design-tokens";

// Composant stabilisé (voir docs/DESIGN_SYSTEM.md) : à réutiliser pour toute
// suppression de donnée métier facilement recréable (jamais pour un média).

export default function UndoToast({
  open,
  message,
  onUndo,
  onDismiss,
  durationMs = 5000,
}: {
  open: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, message]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 z-30 mx-auto flex max-w-md justify-center px-6" style={{ bottom: "96px" }}>
      <div
        className="flex items-center gap-4 rounded-[4px] px-5 py-3.5"
        style={{ backgroundColor: colors.ink, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
      >
        <span className="text-[14px]" style={{ color: colors.cream }}>
          {message}
        </span>
        <button onClick={onUndo} className="text-[14px] font-semibold" style={{ color: colors.rust }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
