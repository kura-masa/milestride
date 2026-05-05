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
            className="fixed inset-0 z-50 bg-black/40"
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
              <div className="rounded-2xl bg-white shadow-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <div className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">操作</div>
                  <div className="text-sm font-semibold text-gray-900 truncate mt-0.5">{title}</div>
                </div>
                <button
                  onClick={onEdit}
                  className="w-full px-5 py-4 text-left text-sm font-medium text-gray-800 active:bg-gray-50 border-b border-gray-100"
                >
                  {editLabel}
                </button>
                <button
                  onClick={onDelete}
                  className="w-full px-5 py-4 text-left text-sm font-medium text-red-600 active:bg-red-50"
                >
                  {deleteLabel}
                </button>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-white text-sm font-semibold text-gray-700 shadow-xl active:bg-gray-50"
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
