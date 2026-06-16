"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  variant?: "danger";
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position so menu stays within viewport
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      el.style.left = `${Math.max(0, window.innerWidth - rect.width - 4)}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${Math.max(0, window.innerHeight - rect.height - 4)}px`;
    }
  }, []);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-elevated border border-white/10 rounded-md shadow-xl py-1 min-w-[140px]"
      style={{ top: y, left: x }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          role="button"
          tabIndex={0}
          className={`px-3 py-1.5 text-sm cursor-pointer ${
            item.variant === "danger"
              ? "text-red-400 hover:bg-red-900/20"
              : "text-fore hover:bg-raised"
          }`}
          onClick={() => {
            item.onClick();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") item.onClick();
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
