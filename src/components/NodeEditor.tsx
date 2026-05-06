"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Node, Status } from "@/lib/store";
import { MemoEditor, MemoEditorHandle } from "./MemoEditor";

export type NodeDraft = {
  title: string;
  status: Status;
  groupId: string | null;
  parents: string[];
  memo: string;
};

export default function NodeEditor({
  open,
  initial,
  allNodes,
  isNew,
  requireNewGroup = false,
  onSave,
  onCancel,
  onAddGroup,
}: {
  open: boolean;
  initial: Partial<NodeDraft> & { id?: string };
  allNodes: Node[];
  isNew: boolean;
  requireNewGroup?: boolean;
  onSave: (draft: NodeDraft) => Promise<void> | void;
  onCancel: () => void;
  onAddGroup: (title: string) => Promise<string>;
}) {
  const [draft, setDraft] = useState<NodeDraft>(() => normalize(initial));
  const [saving, setSaving] = useState(false);
  const [groupNameAtTop, setGroupNameAtTop] = useState("");
  const [groupNameError, setGroupNameError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(normalize(initial));
      setGroupNameAtTop("");
      setGroupNameError(null);
    }
  }, [open, initial]);

  const otherNodes = allNodes.filter((n) => n.id !== initial.id);

  const memoEditorRef = useRef<MemoEditorHandle>(null);

  const toggleParent = (pid: string) =>
    setDraft((d) => ({
      ...d,
      parents: d.parents.includes(pid)
        ? d.parents.filter((x) => x !== pid)
        : [...d.parents, pid],
    }));

  const handleSave = async () => {
    if (!draft.title.trim()) return;
    if (requireNewGroup) {
      if (!groupNameAtTop.trim()) {
        setGroupNameError("グループ名を入力してください");
        return;
      }
      setGroupNameError(null);
    }
    setSaving(true);
    try {
      let groupId = draft.groupId;
      if (requireNewGroup) {
        groupId = await onAddGroup(groupNameAtTop.trim());
      }
      const cleaned: NodeDraft = { ...draft, groupId };
      await onSave(cleaned);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[55] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[55] rounded-t-3xl bg-white shadow-2xl max-h-[98.5dvh] overflow-y-auto overscroll-contain"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="sticky top-0 z-10 bg-white pt-3 pb-3 px-5 border-b border-gray-100 flex items-center justify-between">
              <button
                onClick={onCancel}
                className="text-sm font-medium text-gray-500"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !draft.title.trim()}
                className="text-sm font-bold text-emerald-600 disabled:text-gray-300"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>

            <div className="p-5 space-y-5">
              {requireNewGroup && (
                <Field label="新しいグループ名" hint="このグループに最初のノードを追加します">
                  <input
                    className={`w-full px-3 py-2.5 rounded-xl bg-gray-50 ring-1 outline-none text-sm ${
                      groupNameError
                        ? "ring-red-400 focus:ring-red-500"
                        : "ring-gray-200 focus:ring-sky-400"
                    }`}
                    value={groupNameAtTop}
                    onChange={(e) => {
                      setGroupNameAtTop(e.target.value);
                      if (e.target.value.trim()) setGroupNameError(null);
                    }}
                    placeholder="例: 影響力の武器"
                    autoFocus
                  />
                  {groupNameError && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
                      <span>⚠</span>
                      <span>{groupNameError}</span>
                    </div>
                  )}
                </Field>
              )}

              <Field label="タイトル">
                <input
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 ring-1 ring-gray-200 focus:ring-sky-400 outline-none text-sm"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="タイトルを書いてください"
                  autoFocus={isNew && !requireNewGroup}
                />
              </Field>

              <Field
                label="親ノード（依存）"
                hint="完了が必要な前提ノード。複数選択可"
              >
                {otherNodes.length === 0 ? (
                  <div className="text-xs text-gray-400 px-1">他のノードがまだありません</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {otherNodes.map((n) => (
                      <Chip
                        key={n.id}
                        active={draft.parents.includes(n.id)}
                        onClick={() => toggleParent(n.id)}
                      >
                        {n.title}
                      </Chip>
                    ))}
                  </div>
                )}
              </Field>

              <Field
                label="メモ"
                rightSlot={
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      memoEditorRef.current?.addItem();
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      memoEditorRef.current?.addItem();
                    }}
                    className="px-3 py-1 rounded-full text-xs font-semibold text-sky-600 ring-1 ring-sky-200 active:bg-sky-50"
                  >
                    ＋ 項目を追加
                  </button>
                }
              >
                <MemoEditor
                  ref={memoEditorRef}
                  initialValue={initial.memo ?? ""}
                  resetKey={`${initial.id ?? "new"}-${open ? "open" : "closed"}`}
                  onChange={(memo) => setDraft((d) => ({ ...d, memo }))}
                  placeholder="このノードのメモ"
                />
              </Field>

              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function normalize(initial: Partial<NodeDraft>): NodeDraft {
  return {
    title: initial.title ?? "",
    status: initial.status ?? "todo",
    groupId: initial.groupId ?? null,
    parents: initial.parents ?? [],
    memo: initial.memo ?? "",
  };
}

function Field({
  label,
  hint,
  rightSlot,
  children,
}: {
  label: string;
  hint?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-gray-700">{label}</label>
        {rightSlot ? (
          rightSlot
        ) : hint ? (
          <span className="text-[10px] text-gray-400">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition ${
        active
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-gray-700 ring-gray-200 active:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

