"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Node,
  Status,
  Difficulty,
  difficultyMeta,
  parseMemoChecklist,
} from "@/lib/store";
import { MemoEditor, MemoEditorHandle } from "./MemoEditor";
import ImageAttachments from "./ImageAttachments";

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
  nodeImages,
  allNodes,
  isNew,
  requireNewGroup = false,
  onSave,
  onCancel,
  onDelete,
  onAddGroup,
  onAddImage,
  onRemoveImage,
}: {
  open: boolean;
  initial: Partial<NodeDraft> & { id?: string; images?: string[] };
  nodeImages?: string[];
  allNodes: Node[];
  isNew: boolean;
  requireNewGroup?: boolean;
  onSave: (draft: NodeDraft) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => void;
  onAddGroup: (title: string, difficulty: Difficulty) => Promise<string>;
  onAddImage: (nodeId: string, file: File) => Promise<void>;
  onRemoveImage: (nodeId: string, url: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<NodeDraft>(() => normalize(initial));
  const [saving, setSaving] = useState(false);
  const [groupNameAtTop, setGroupNameAtTop] = useState("");
  const [groupNameError, setGroupNameError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [fabBottom, setFabBottom] = useState(12);
  const [parentsExpanded, setParentsExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(normalize(initial));
      setGroupNameAtTop("");
      setGroupNameError(null);
      setDifficulty(1);
      setParentsExpanded(false);
    }
  }, [open, initial]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setFabBottom(kb + 12);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  // Only show nodes from the same group as potential parents.
  // Cross-tab parents are never displayed as edges in FocusView anyway, so
  // including them just creates confusion (same-named nodes look identical).
  // When the group is known (editing existing node, or new node with a preset
  // group), restrict to that group. Otherwise show all nodes.
  const otherNodes = allNodes.filter((n) => {
    if (n.id === initial.id) return false;
    const knownGroup = initial.groupId !== undefined;
    if (knownGroup) return n.groupId === (initial.groupId ?? null);
    return true;
  });

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
        setGroupNameError("エリア名を入力してください");
        return;
      }
      setGroupNameError(null);
    }
    setSaving(true);
    try {
      let groupId = draft.groupId;
      if (requireNewGroup) {
        groupId = await onAddGroup(groupNameAtTop.trim(), difficulty);
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
            className="fixed inset-x-0 bottom-0 z-[55] rounded-t-3xl bg-[var(--bg-panel)] ring-1 ring-[var(--ring-soft)] shadow-2xl max-h-[98.5dvh] overflow-y-auto overscroll-contain"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="sticky top-0 z-10 bg-[var(--bg-panel)] pt-3 pb-3 px-5 border-b border-[var(--ring-soft)] flex items-center justify-between gap-2">
              <button
                onClick={onCancel}
                className="text-sm font-medium text-[var(--text-secondary)]"
              >
                キャンセル
              </button>
              {!isNew && initial.title && (
                <span className="flex-1 text-center text-xs font-semibold text-[var(--text-muted)] truncate px-2">
                  {initial.title}
                </span>
              )}
              <div className="flex items-center gap-3">
                {!isNew && onDelete && (
                  <button
                    onClick={onDelete}
                    className="text-sm font-medium text-red-400 active:text-red-300"
                  >
                    削除
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !draft.title.trim()}
                  className="font-quest text-sm font-bold text-[var(--accent-gold)] disabled:text-[var(--text-muted)]"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {requireNewGroup && (
                <Field label="新しいエリア名" hint="このエリアに最初のクエストを追加します">
                  <input
                    className={`w-full px-3 py-2.5 rounded-xl bg-[var(--bg-panel-soft)] ring-1 outline-none text-sm text-[var(--text-primary)] ${
                      groupNameError
                        ? "ring-red-400 focus:ring-red-500"
                        : "ring-[var(--ring-soft)] focus:ring-sky-400"
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

              {requireNewGroup && (
                <Field label="難易度" hint="EXP 倍率と紋章を決めます">
                  <div className="grid grid-cols-5 gap-2">
                    {([1, 2, 3, 4, 5] as Difficulty[]).map((d) => {
                      const m = difficultyMeta[d];
                      const active = difficulty === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDifficulty(d)}
                          className={`flex flex-col items-center gap-0.5 py-2 rounded-xl ring-1 transition ${
                            active
                              ? "bg-[var(--bg-elev)] ring-[var(--accent-gold)]"
                              : "bg-[var(--bg-panel-soft)] ring-[var(--ring-soft)] active:bg-[var(--bg-elev)]"
                          }`}
                          style={active ? { color: m.color } : { color: "var(--text-secondary)" }}
                        >
                          <span className="text-xl leading-none">{m.emoji}</span>
                          <span className="font-quest text-[10px] tracking-wider">
                            {m.name}
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)]">
                            ×{m.expMul}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              <Field label="クエスト名">
                <input
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-panel-soft)] ring-1 ring-[var(--ring-soft)] focus:ring-sky-400 outline-none text-sm text-[var(--text-primary)]"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="クエスト名を書いてください"
                  autoFocus={isNew && !requireNewGroup}
                />
              </Field>

              {(() => {
                const COLLAPSE_THRESHOLD = 5;
                const needsCollapse = otherNodes.length > COLLAPSE_THRESHOLD;
                const visibleNodes = !needsCollapse || parentsExpanded
                  ? otherNodes
                  : (() => {
                      const sel = otherNodes.filter((n) => draft.parents.includes(n.id));
                      const unsel = otherNodes.filter((n) => !draft.parents.includes(n.id));
                      const extra = Math.max(0, COLLAPSE_THRESHOLD - sel.length);
                      return [...sel, ...unsel.slice(0, extra)];
                    })();
                const hiddenCount = otherNodes.length - visibleNodes.length;
                return (
                  <Field label="前提クエスト">
                    {otherNodes.length === 0 ? (
                      <div className="text-xs text-[var(--text-muted)] px-1">他のクエストがまだありません</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {visibleNodes.map((n) => (
                            <Chip
                              key={n.id}
                              active={draft.parents.includes(n.id)}
                              onClick={() => toggleParent(n.id)}
                            >
                              {n.title}
                            </Chip>
                          ))}
                        </div>
                        {needsCollapse && (
                          <button
                            type="button"
                            onClick={() => setParentsExpanded((v) => !v)}
                            className="text-xs text-[var(--accent-blue)] font-semibold px-1"
                          >
                            {parentsExpanded
                              ? "▲ 折りたたむ"
                              : `▼ 他${hiddenCount}件を表示`}
                          </button>
                        )}
                      </div>
                    )}
                  </Field>
                );
              })()}

              {(() => {
                const hasChecks = parseMemoChecklist(draft.memo).length > 0;
                const isDone = draft.status === "done";
                return (
                  <Field
                    label="クエスト状態"
                    hint={
                      hasChecks ? "メモのチェックで自動判定" : "手動で達成にできます"
                    }
                  >
                    <button
                      type="button"
                      disabled={hasChecks}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          status: d.status === "done" ? "todo" : "done",
                        }))
                      }
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl ring-1 text-sm font-bold transition ${
                        isDone
                          ? "bg-[var(--accent-stamp)]/15 ring-[var(--accent-stamp)] text-[var(--accent-stamp)]"
                          : "bg-[var(--bg-panel-soft)] ring-[var(--ring-soft)] text-[var(--text-secondary)] active:bg-[var(--bg-elev)]"
                      } ${hasChecks ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className="text-base">
                        {isDone ? "★" : "☆"}
                      </span>
                      <span className="font-quest tracking-wider">
                        {isDone ? "達成済み" : "未達成"}
                      </span>
                    </button>
                  </Field>
                );
              })()}

              <Field
                label="メモ"
                rightSlot={
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      memoEditorRef.current?.addItem();
                    }}
                    onClick={(e) => e.preventDefault()}
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
                  placeholder="クエストのメモ"
                />
              </Field>

              <Field label="画像">
                <ImageAttachments
                  images={nodeImages ?? initial.images ?? []}
                  nodeId={initial.id ?? null}
                  onAdd={(file) => onAddImage(initial.id!, file)}
                  onRemove={(url) => onRemoveImage(initial.id!, url)}
                />
              </Field>

              <div className="h-4" />
            </div>

            {/* Floating "+ 項目を追加" — fixed above keyboard */}
            <div className="fixed z-[60] flex justify-end px-4 pointer-events-none" style={{ bottom: fabBottom, left: 0, right: 0 }}>
              <button
                type="button"
                aria-label="項目を追加"
                onPointerDown={(e) => {
                  e.preventDefault();
                  memoEditorRef.current?.addItem();
                }}
                onClick={(e) => e.preventDefault()}
                className="pointer-events-auto px-3 h-10 rounded-full bg-sky-500 text-white text-sm font-bold shadow-lg active:bg-sky-600 flex items-center justify-center"
              >
                ＋項目
              </button>
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
        <label className="font-quest text-xs font-semibold text-[var(--accent-gold)] uppercase tracking-wider">{label}</label>
        {rightSlot ? (
          rightSlot
        ) : hint ? (
          <span className="text-[10px] text-[var(--text-muted)]">{hint}</span>
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
          ? "bg-[var(--accent-blue)] text-[var(--bg-base)] ring-[var(--accent-blue)]"
          : "bg-[var(--bg-elev)] text-[var(--text-secondary)] ring-[var(--ring-soft)] active:bg-[var(--ring-soft)]"
      }`}
    >
      {children}
    </button>
  );
}

