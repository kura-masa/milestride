"use client";
import { motion, AnimatePresence } from "framer-motion";

export default function ActionMenu({
  open,
  title,
  onClose,
  onEdit,
  onDelete,
  editLabel = "✎ 編集",
  deleteLabel = "🗑 削除",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 px-4 pb-6"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="max-w-md mx-auto space-y-2">
              <div className="rounded-2xl bg-[var(--bg-panel)] ring-1 ring-[var(--ring-soft)] shadow-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--ring-soft)]">
                  <div className="font-quest text-[10px] text-[var(--accent-gold)] font-semibold tracking-wider uppercase">操作</div>
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate mt-0.5">{title}</div>
                </div>
                <button
                  onClick={onEdit}
                  className="w-full px-5 py-4 text-left text-sm font-medium text-[var(--text-primary)] active:bg-[var(--bg-elev)] border-b border-[var(--ring-soft)]"
                >
                  {editLabel}
                </button>
                <button
                  onClick={onDelete}
                  className="w-full px-5 py-4 text-left text-sm font-medium text-red-400 active:bg-red-950/30"
                >
                  {deleteLabel}
                </button>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-[var(--bg-panel)] ring-1 ring-[var(--ring-soft)] text-sm font-semibold text-[var(--text-secondary)] shadow-xl active:bg-[var(--bg-elev)]"
              >
                キャンセル
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
