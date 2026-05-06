"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Node, ChecklistItem, checklistProgress } from "@/lib/store";

export default function NodeSheet({
  node,
  onClose,
  onSaveChecklist,
  onSaveMemo,
}: {
  node: Node | null;
  onClose: () => void;
  onSaveChecklist: (node: Node, items: ChecklistItem[]) => void;
  onSaveMemo: (node: Node, memo: string) => Promise<void> | void;
}) {
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>([]);
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);
  const memoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingMemo && memoRef.current) {
      const el = memoRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editingMemo]);

  useEffect(() => {
    setLocalChecklist(node?.checklist ?? []);
  }, [node?.id, node?.checklist]);

  useEffect(() => {
    setEditingMemo(false);
    setMemoDraft(node?.memo ?? "");
  }, [node?.id]);

  if (!node) return null;
  const total = localChecklist.length;
  const done = localChecklist.filter((c) => c.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const handleToggle = (itemId: string) => {
    setLocalChecklist((prev) => {
      const next = prev.map((c) =>
        c.id === itemId ? { ...c, done: !c.done } : c
      );
      onSaveChecklist(node, next);
      return next;
    });
  };

  const startEditMemo = () => {
    setMemoDraft(node.memo ?? "");
    setEditingMemo(true);
  };

  const handleSaveMemo = async () => {
    if (savingMemo) return;
    setSavingMemo(true);
    try {
      await onSaveMemo(node, memoDraft);
      setEditingMemo(false);
    } finally {
      setSavingMemo(false);
    }
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
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="sticky top-0 bg-white pt-3 pb-2 px-5 border-b border-gray-100">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
            </div>
            <div className="p-5 space-y-4">
              <h2 className="text-xl font-bold text-gray-900">{node.title}</h2>
              {node.detail && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">目的</div>
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {node.detail}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">メモ</span>
                  {editingMemo ? (
                    <button
                      onClick={handleSaveMemo}
                      disabled={savingMemo}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-600/20 active:bg-emerald-600 disabled:bg-gray-300 disabled:ring-0"
                    >
                      {savingMemo ? "保存中…" : "✓ 保存"}
                    </button>
                  ) : (
                    <button
                      onClick={startEditMemo}
                      className="text-xs font-semibold text-sky-600 active:text-sky-700"
                    >
                      ✎ 編集
                    </button>
                  )}
                </div>
                {editingMemo ? (
                  <textarea
                    ref={memoRef}
                    value={memoDraft}
                    onChange={(e) => setMemoDraft(e.target.value)}
                    placeholder="メモを入力…"
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 ring-1 ring-gray-200 focus:ring-sky-400 outline-none text-sm resize-y"
                  />
                ) : node.memo ? (
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {node.memo}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">まだメモはありません</p>
                )}
              </div>

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
