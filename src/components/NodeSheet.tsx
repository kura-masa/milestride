"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Node, ChecklistItem, phaseMeta, checklistProgress } from "@/lib/store";

export default function NodeSheet({
  node,
  onClose,
  onToggleChecklist,
}: {
  node: Node | null;
  onClose: () => void;
  onToggleChecklist: (node: Node, itemId: string) => void;
}) {
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    setLocalChecklist(node?.checklist ?? []);
  }, [node?.id, node?.checklist]);

  if (!node) return null;
  const p = phaseMeta[node.phase];
  const total = localChecklist.length;
  const done = localChecklist.filter((c) => c.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const handleToggle = (itemId: string) => {
    setLocalChecklist((prev) =>
      prev.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c))
    );
    onToggleChecklist(node, itemId);
  };

  return (
    <AnimatePresence>
      {node && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white shadow-2xl max-h-[85vh] overflow-y-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="sticky top-0 bg-white pt-3 pb-2 px-5 border-b border-gray-100">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.bg} ${p.color}`}>
                  {p.label}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{node.title}</h2>
              {node.summary && <p className="text-sm text-gray-600">{node.summary}</p>}
              {node.detail && (
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {node.detail}
                </p>
              )}

              {localChecklist.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">チェックリスト</span>
                    <span className="text-xs text-gray-500">
                      {done}/{total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", damping: 20 }}
                    />
                  </div>
                  <ul className="space-y-1.5 pt-2">
                    {localChecklist.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => handleToggle(c.id)}
                          className="w-full flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition text-left"
                        >
                          <span
                            className={`flex-none w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
                              c.done
                                ? "bg-emerald-400 border-emerald-400 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {c.done && "✓"}
                          </span>
                          <span
                            className={`text-sm ${
                              c.done ? "text-gray-400 line-through" : "text-gray-800"
                            }`}
                          >
                            {c.label}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 mt-4 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium active:bg-gray-200"
              >
                閉じる
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
