"use client";

import { useEffect, useRef } from "react";

interface Props {
  message: string;
  onClose: () => void;
}

export default function AlertModal({ message, onClose }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-elevated border border-white/10 rounded-lg shadow-2xl px-6 py-5 w-full max-w-sm mx-4">
        <p className="text-fore text-sm mb-5 leading-relaxed">{message}</p>
        <div className="flex justify-end">
          <button
            ref={btnRef}
            onClick={onClose}
            className="px-4 py-2 rounded bg-raised hover:bg-elevated/80 text-fore text-sm font-semibold transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
