"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Node,
  parseMemoChecklist,
  toggleMemoChecklistAt,
} from "@/lib/store";
import { MemoEditor, MemoEditorHandle } from "./MemoEditor";

export default function NodeSheet({
  node,
  onClose,
  onSaveMemo,
}: {
  node: Node | null;
  onClose: () => void;
  onSaveMemo: (node: Node, memo: string) => Promise<void> | void;
}) {
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);
  const [displayMemo, setDisplayMemo] = useState("");
  const memoEditorRef = useRef<MemoEditorHandle>(null);

  useEffect(() => {
    setEditingMemo(false);
    setMemoDraft(node?.memo ?? "");
    setDisplayMemo(node?.memo ?? "");
  }, [node?.id]);

  // Keep displayMemo in sync with snapshot updates when not editing
  useEffect(() => {
    if (!editingMemo) setDisplayMemo(node?.memo ?? "");
  }, [node?.memo, editingMemo]);

  const items = useMemo(() => parseMemoChecklist(displayMemo), [displayMemo]);
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  if (!node) return null;

  const startEditMemo = () => {
    setMemoDraft(node.memo ?? "");
    setEditingMemo(true);
  };

  const handleSaveMemo = async () => {
    if (savingMemo) return;
    setSavingMemo(true);
    try {
      await onSaveMemo(node, memoDraft);
      setDisplayMemo(memoDraft);
      setEditingMemo(false);
    } finally {
      setSavingMemo(false);
    }
  };

  const handleToggleAt = (markerStart: number) => {
    setDisplayMemo((prev) => {
      if (!node) return prev;
      const next = toggleMemoChecklistAt(prev, markerStart);
      onSaveMemo(node, next);
      return next;
    });
  };

  // Render memo as inline mixed text + checkbox elements
  const renderInlineMemo = () => {
    const memo = displayMemo;
    const out: React.ReactNode[] = [];
    let lineGlobalStart = 0;
    memo.split("\n").forEach((line, lineIdx) => {
      if (lineIdx > 0) out.push(<br key={`br${lineIdx}`} />);
      const re = /\[( |x|X)\]/g;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        if (m.index > last) {
          out.push(
            <span key={`t${lineIdx}-${last}`}>{line.slice(last, m.index)}</span>
          );
        }
        const done = m[1].toLowerCase() === "x";
        const globalStart = lineGlobalStart + m.index;
        out.push(
          <button
            key={`c${lineIdx}-${m.index}`}
            type="button"
            onClick={() => handleToggleAt(globalStart)}
            className={`inline-flex items-center justify-center align-[-3px] mx-[3px] rounded-full border-2 font-bold transition ${
              done
                ? "bg-emerald-400 border-emerald-400 text-white"
                : "bg-transparent border-gray-300 text-transparent"
            }`}
            style={{
              width: "1.15em",
              height: "1.15em",
              fontSize: "0.7em",
              lineHeight: 1,
              padding: 0,
            }}
          >
            {done ? "✓" : ""}
          </button>
        );
        last = m.index + m[0].length;
      }
      if (last < line.length) {
        out.push(
          <span key={`t${lineIdx}-end`}>{line.slice(last)}</span>
        );
      }
      lineGlobalStart += line.length + 1;
    });
    return out;
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

              {total > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">
                      進捗
                    </span>
                    <span className="text-xs text-gray-500">
                      {done}/{total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", damping: 20 }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
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
                  {editingMemo && (
                    <button
                      type="button"
                      onClick={() => memoEditorRef.current?.addItem()}
                      className="px-3 py-1 rounded-full text-xs font-semibold text-sky-600 ring-1 ring-sky-200 active:bg-sky-50"
                    >
                      ＋ 項目を追加
                    </button>
                  )}
                </div>
                {editingMemo ? (
                  <MemoEditor
                    ref={memoEditorRef}
                    initialValue={node.memo ?? ""}
                    resetKey={`${node.id}-edit-${editingMemo}`}
                    onChange={setMemoDraft}
                    placeholder="メモ・チェックリスト"
                  />
                ) : displayMemo ? (
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {renderInlineMemo()}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">まだメモはありません</p>
                )}
              </div>

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
