"use client";
import { motion, AnimatePresence } from "framer-motion";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "削除",
  cancelLabel = "削除しない",
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
              <div className="p-6 text-center">
                <div className="text-base font-bold text-gray-900">{title}</div>
                {message && (
                  <div className="mt-2 text-sm text-gray-600">{message}</div>
                )}
              </div>
              <div className="grid grid-cols-2 border-t border-gray-100">
                <button
                  onClick={onCancel}
                  className="py-4 text-sm font-semibold text-gray-700 active:bg-gray-50 border-r border-gray-100"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  className={`py-4 text-sm font-bold active:bg-opacity-80 ${
                    destructive ? "text-red-600 active:bg-red-50" : "text-sky-600 active:bg-sky-50"
                  }`}
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
