"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function RenameDialog({
  open,
  title,
  initialValue,
  placeholder,
  confirmLabel = "保存",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  initialValue: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, initialValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 pointer-events-none"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
          >
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="p-5">
                <div className="text-base font-bold text-gray-900 mb-3">
                  {title}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                    if (e.key === "Escape") onCancel();
                  }}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 ring-1 ring-gray-200 focus:ring-sky-400 outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-2 border-t border-gray-100">
                <button
                  onClick={onCancel}
                  className="py-4 text-sm font-semibold text-gray-700 active:bg-gray-50 border-r border-gray-100"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={submit}
                  disabled={!value.trim()}
                  className="py-4 text-sm font-bold text-sky-600 active:bg-sky-50 disabled:text-gray-300"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
