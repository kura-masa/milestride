"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useUserData,
  useMutations,
  Node,
  Group,
  Difficulty,
  difficultyMeta,
  checklistProgress,
  isLocked,
  progress,
  nodeProgress,
  levelInfo,
  deriveStatusFromMemo,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useLongPress } from "@/lib/useLongPress";
import AuthGate from "@/components/AuthGate";
import ActionMenu from "@/components/ActionMenu";
import ConfirmDialog from "@/components/ConfirmDialog";
import RenameDialog from "@/components/RenameDialog";
import NodeEditor, { NodeDraft } from "@/components/NodeEditor";
import UnifiedField from "@/components/UnifiedField";

type Mode = "focus" | "overview";
type OverviewLayout = "grouped" | "unified";

const UNGROUPED = "__ungrouped__";

export default function Page() {
  return (
    <AuthGate>
      <App />
    </AuthGate>
  );
}

function App() {
  const { user, signOutUser } = useAuth();
  const { nodes, groups, ready } = useUserData();
  const ops = useMutations();

  const [mode, setMode] = useState<Mode>("focus");
  const [overviewLayout, setOverviewLayout] = useState<OverviewLayout>("grouped");
  const [activeTab, setActiveTab] = useState<string>(UNGROUPED);
  const [editor, setEditor] = useState<{
    node: Node | null;
    requireNewGroup?: boolean;
    showGroupChips?: boolean;
    presetGroupId?: string | null;
  } | null>(null);
  // Stable reference for NodeEditor's `initial` prop.
  // Without this, new-node creation produces a fresh object on every Firestore
  // update, causing NodeEditor's useEffect to reset the draft mid-edit.
  const editorInitial = useMemo<Partial<NodeDraft> & { id?: string; images?: string[] }>(
    () => editor?.node ?? { groupId: editor?.presetGroupId ?? null },
    [editor]
  );

  const [confirmDel, setConfirmDel] = useState<Node | null>(null);
  const [renameTarget, setRenameTarget] = useState<
    {
      id: string;
      current: string;
      currentDifficulty?: Difficulty;
    } | null
  >(null);
  const [groupMenu, setGroupMenu] = useState<
    { id: string; title: string } | null
  >(null);
  const [confirmDelGroup, setConfirmDelGroup] = useState<
    { id: string; title: string; nodeCount: number } | null
  >(null);

  type Tab = {
    id: string;
    title: string;
    nodes: Node[];
    difficulty?: Difficulty;
  };
  const tabs = useMemo<Tab[]>(() => {
    const ungrouped = nodes.filter((n) => !n.groupId);
    const groupTabs: Tab[] = groups.map((g) => ({
      id: g.id,
      title: g.title,
      nodes: nodes.filter((n) => n.groupId === g.id),
      difficulty: (g.difficulty ?? 1) as Difficulty,
    }));
    const all: Tab[] = [];
    if (ungrouped.length > 0 || groupTabs.length === 0) {
      all.push({ id: UNGROUPED, title: "未開拓エリア", nodes: ungrouped });
    }
    all.push(...groupTabs);
    return all;
  }, [nodes, groups]);

  const activeIdx = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );
  const currentTab = tabs[activeIdx];

  const seedingRef = useRef(false);
  useEffect(() => {
    if (!ready || !ops || !user) return;
    if (seedingRef.current) return;
    if (typeof window === "undefined") return;
    const key = `milestride_seeded_${user.uid}`;
    if (localStorage.getItem(key)) return;
    if (nodes.length > 0 || groups.length > 0) {
      localStorage.setItem(key, "1");
      return;
    }
    seedingRef.current = true;
    (async () => {
      try {
        const gid = await ops.addGroup("はじめてのロードマップ");
        const id1 = await ops.addNode({
          title: "アプリの使い方を確認する",
          memo: "Milestrideでできることを把握する\n- [x] サンプルを眺める",
          groupId: gid,
          parents: [],
          order: 1,
          status: "done",
        });
        const id2 = await ops.addNode({
          title: "やりたいことを1つ書く",
          memo: "達成したいことをメモに書く\n- [x] 何をやりたいか決める\n- [ ] メモに背景を書く",
          groupId: gid,
          parents: [id1],
          order: 2,
          status: "in_progress",
        });
        await ops.addNode({
          title: "行動してチェックを入れる",
          memo: "小さく動いて進捗を可視化する\n- [ ] 今日の一歩を実行\n- [ ] 気づきをメモに残す",
          groupId: gid,
          parents: [id2],
          order: 3,
          status: "todo",
        });
        localStorage.setItem(key, "1");
        setActiveTab(gid);
      } finally {
        seedingRef.current = false;
      }
    })();
  }, [ready, ops, user, nodes.length, groups.length]);

  if (!ready || !ops) {
    return (
      <div className="min-h-screen flex-1 flex items-center justify-center">
        <div className="text-sm text-[var(--text-muted)]">読み込み中…</div>
      </div>
    );
  }

  const handleSave = async (draft: NodeDraft) => {
    // If the memo has inline checklist items, derive status from them.
    // Otherwise fall back to whatever the user set manually via the
    // "クエスト達成" toggle in the editor.
    const status = deriveStatusFromMemo(draft.memo, draft.status);
    const draftWithStatus = { ...draft, status };
    if (editor?.node) {
      await ops.updateNode(editor.node.id, draftWithStatus);
    } else {
      // For new nodes, prefer draft.groupId (set by the editor),
      // else fall back to preset (e.g. current tab in non-unified views).
      const fallback =
        editor?.presetGroupId !== undefined
          ? editor.presetGroupId
          : currentTab && currentTab.id !== UNGROUPED
          ? currentTab.id
          : null;
      const newId = await ops.addNode({
        ...draftWithStatus,
        groupId: draft.groupId ?? fallback,
        order: Date.now(),
      });
      // If we just created a brand-new group, switch to that tab so the user
      // immediately sees the new group's roadmap.
      if (editor?.requireNewGroup && draft.groupId) {
        setActiveTab(draft.groupId);
        setMode("focus");
      }
      void newId;
    }
    setEditor(null);
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    await ops.removeFromAllParents(confirmDel.id, nodes);
    await ops.deleteNode(confirmDel.id);
    setConfirmDel(null);
  };

  return (
    <div className="min-h-screen flex-1 bg-[var(--bg-base)] pb-32">
      <Header
        userName={user?.displayName ?? ""}
        userPhoto={user?.photoURL ?? ""}
        nodes={nodes}
        groups={groups}
        onSignOut={() => signOutUser().catch(console.error)}
      />

      <div className="sticky top-[52px] z-20 bg-gradient-to-b from-[var(--bg-base)]/95 to-[var(--bg-base)]/70 backdrop-blur px-4 pt-2 pb-3">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <ModeToggle mode={mode} setMode={setMode} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === "focus" ? (
          <motion.div
            key="focus"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {tabs.length > 0 && (
              <ChainTabs
                tabs={tabs}
                activeId={currentTab?.id ?? UNGROUPED}
                onChange={setActiveTab}
                allNodes={nodes}
                onAddGroup={() =>
                  setEditor({
                    node: null,
                    requireNewGroup: true,
                    showGroupChips: false,
                  })
                }
                onRenameGroup={(id, current) => {
                  if (id === UNGROUPED) {
                    setRenameTarget({ id, current });
                  } else {
                    setGroupMenu({ id, title: current });
                  }
                }}
              />
            )}
            <FocusView
              nodes={currentTab?.nodes ?? []}
              allNodes={nodes}
              onTap={(n) => setEditor({ node: n })}
              onLongPress={() => {}}
              onAdd={() => setEditor({ node: null })}
            />
          </motion.div>
        ) : (
          <motion.div
            key="overview"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.18 }}
          >
            <div className="px-4 pt-1 pb-3 max-w-md mx-auto flex justify-center">
              <OverviewSubToggle
                layout={overviewLayout}
                setLayout={setOverviewLayout}
              />
            </div>
            {overviewLayout === "grouped" ? (
              <OverviewView
                tabs={tabs}
                allNodes={nodes}
                onPick={(n, tabId) => {
                  setActiveTab(tabId);
                  setMode("focus");
                  setTimeout(() => setEditor({ node: n }), 220);
                }}
                onPickGroup={(tabId) => {
                  setActiveTab(tabId);
                  setMode("focus");
                }}
              />
            ) : (
              <UnifiedField
                nodes={nodes}
                groups={groups}
                onTap={(n) => setEditor({ node: n })}
                onLongPress={() => {}}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <FAB
        onClick={() => {
          const inUnified = mode === "overview" && overviewLayout === "unified";
          setEditor({
            node: null,
            showGroupChips: inUnified,
            requireNewGroup: false,
            presetGroupId: inUnified
              ? null
              : currentTab && currentTab.id !== UNGROUPED
              ? currentTab.id
              : null,
          });
        }}
      />

      <NodeEditor
        open={!!editor}
        isNew={!editor?.node}
        initial={editorInitial}
        allNodes={nodes}
        requireNewGroup={editor?.requireNewGroup ?? false}
        onSave={handleSave}
        onCancel={() => setEditor(null)}
        onDelete={
          editor?.node
            ? () => {
                setConfirmDel(editor.node);
                setEditor(null);
              }
            : undefined
        }
        onAddGroup={async (title, difficulty) => {
          const id = await ops.addGroup(title, difficulty);
          return id;
        }}
        onAddImage={async (nodeId, file) => {
          await ops.addImage(nodeId, file);
        }}
        onRemoveImage={async (nodeId, url) => {
          await ops.removeImage(nodeId, url);
        }}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="本当に削除して良いですか？"
        message={confirmDel?.title}
        confirmLabel="削除"
        cancelLabel="削除しない"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
      />

      <RenameDialog
        open={!!renameTarget}
        title="エリア編集"
        initialValue={renameTarget?.current ?? ""}
        initialDifficulty={renameTarget?.currentDifficulty}
        placeholder="エリア名"
        onCancel={() => setRenameTarget(null)}
        onConfirm={async (next, difficulty) => {
          if (!renameTarget) return;
          const id = renameTarget.id;
          if (id === UNGROUPED) {
            const newId = await ops.addGroup(next);
            const ungroupedNodes = nodes.filter((n) => !n.groupId);
            await Promise.all(
              ungroupedNodes.map((n) => ops.updateNode(n.id, { groupId: newId }))
            );
            setActiveTab(newId);
          } else {
            const patch: { title?: string; difficulty?: Difficulty } = {};
            if (next !== renameTarget.current) patch.title = next;
            if (
              difficulty !== undefined &&
              difficulty !== renameTarget.currentDifficulty
            )
              patch.difficulty = difficulty;
            if (patch.title !== undefined || patch.difficulty !== undefined) {
              await ops.updateGroup(id, patch);
            }
          }
          setRenameTarget(null);
        }}
      />

      <ActionMenu
        open={!!groupMenu}
        title={groupMenu?.title ?? ""}
        editLabel="✎ 名前 / 難易度 変更"
        deleteLabel="🗑 エリア削除"
        onClose={() => setGroupMenu(null)}
        onEdit={() => {
          if (!groupMenu) return;
          const g = groups.find((x) => x.id === groupMenu.id);
          setRenameTarget({
            id: groupMenu.id,
            current: groupMenu.title,
            currentDifficulty: (g?.difficulty ?? 1) as Difficulty,
          });
          setGroupMenu(null);
        }}
        onDelete={() => {
          if (!groupMenu) return;
          const tab = tabs.find((t) => t.id === groupMenu.id);
          setConfirmDelGroup({
            id: groupMenu.id,
            title: groupMenu.title,
            nodeCount: tab?.nodes.length ?? 0,
          });
          setGroupMenu(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmDelGroup}
        title={
          (confirmDelGroup?.nodeCount ?? 0) > 0
            ? "エリア内のクエストが全て消えますがよろしいですか？"
            : "本当に削除して良いですか？"
        }
        message={confirmDelGroup?.title}
        confirmLabel="削除する"
        cancelLabel="削除しない"
        onConfirm={async () => {
          if (!confirmDelGroup) return;
          await ops.deleteGroup(
            confirmDelGroup.id,
            nodes,
            confirmDelGroup.nodeCount > 0
          );
          if (activeTab === confirmDelGroup.id) setActiveTab(UNGROUPED);
          setConfirmDelGroup(null);
        }}
        onCancel={() => setConfirmDelGroup(null)}
      />
    </div>
  );
}

function Header({
  userName,
  userPhoto,
  nodes,
  groups,
  onSignOut,
}: {
  userName: string;
  userPhoto: string;
  nodes: Node[];
  groups: Group[];
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const lv = useMemo(() => levelInfo(nodes, groups), [nodes, groups]);
  return (
    <header className="sticky top-0 z-30 bg-[var(--bg-panel)]/90 backdrop-blur border-b border-[var(--ring-soft)]">
      <div className="px-4 pt-2 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="font-quest text-[15px] font-bold text-[var(--accent-gold)] tracking-wider">
            MILESTRIDE
          </div>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="font-quest text-[11px] font-bold text-[var(--accent-blue)] tabular-nums">
              Lv {lv.lv}
            </span>
            <div className="flex-1 h-2 rounded-full bg-[var(--bg-elev)] ring-1 ring-[var(--ring-soft)] overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)]"
                initial={{ width: 0 }}
                animate={{ width: `${lv.pct}%` }}
                transition={{ type: "spring", damping: 22, stiffness: 120 }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] tabular-nums font-mono">
              {lv.cur}/{lv.need}
            </span>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-[var(--ring-soft)] active:scale-95 transition"
          >
            {userPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userPhoto} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] text-white text-xs font-bold flex items-center justify-center">
                {userName.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-3 top-12 z-50 rounded-xl bg-[var(--bg-elev)] shadow-xl ring-1 ring-[var(--ring-soft)] overflow-hidden">
                <div className="px-4 py-3 text-xs text-[var(--text-secondary)] border-b border-[var(--ring-soft)]">
                  {userName}
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-[var(--text-primary)] active:bg-[var(--ring-soft)]"
                >
                  サインアウト
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="relative inline-flex bg-[var(--bg-panel)]/80 ring-1 ring-[var(--ring-soft)] rounded-full p-1 shadow-sm">
      <motion.div
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
        animate={{ left: mode === "focus" ? 4 : "calc(50% + 0px)" }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
      />
      {(["focus", "overview"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`relative z-10 px-5 py-1.5 text-xs font-semibold rounded-full transition-colors ${
            mode === m ? "text-white" : "text-[var(--text-secondary)]"
          }`}
        >
          {m === "focus" ? "詳細" : "全体"}
        </button>
      ))}
    </div>
  );
}

function OverviewSubToggle({
  layout,
  setLayout,
}: {
  layout: OverviewLayout;
  setLayout: (l: OverviewLayout) => void;
}) {
  return (
    <div className="relative inline-flex bg-[var(--bg-panel)] ring-1 ring-[var(--ring-soft)] rounded-full p-0.5 shadow-sm text-[13px]">
      {(["grouped", "unified"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLayout(l)}
          className={`px-3 py-1 rounded-full font-semibold transition ${
            layout === l ? "bg-[var(--accent-blue)] text-white" : "text-[var(--text-secondary)]"
          }`}
        >
          {l === "grouped" ? "エリア別" : "冒険地図"}
        </button>
      ))}
    </div>
  );
}

function ChainTabs({
  tabs,
  activeId,
  onChange,
  allNodes,
  onAddGroup,
  onRenameGroup,
}: {
  tabs: {
    id: string;
    title: string;
    nodes: Node[];
    difficulty?: Difficulty;
  }[];
  activeId: string;
  onChange: (id: string) => void;
  allNodes: Node[];
  onAddGroup: () => void;
  onRenameGroup: (id: string, currentTitle: string) => void;
}) {
  return (
    <div className="px-4 pt-2">
      <div className="max-w-md mx-auto flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const p = progress(t.nodes);
          const active = t.id === activeId;
          return (
            <ChainTab
              key={t.id}
              id={t.id}
              title={t.title}
              pct={p.pct}
              difficulty={t.difficulty}
              active={active}
              onTap={() => onChange(t.id)}
              onLongPress={() => onRenameGroup(t.id, t.title)}
            />
          );
        })}
        <button
          onClick={onAddGroup}
          aria-label="エリアを追加"
          className="flex-none w-8 h-8 rounded-full bg-[var(--bg-panel)] text-sky-500 ring-1 ring-sky-200 active:bg-sky-50 flex items-center justify-center font-bold text-base"
        >
          ＋
        </button>
      </div>
      <span className="hidden">{allNodes.length}</span>
    </div>
  );
}

function ChainTab({
  title,
  pct,
  difficulty,
  active,
  onTap,
  onLongPress,
}: {
  id: string;
  title: string;
  pct: number;
  difficulty?: Difficulty;
  active: boolean;
  onTap: () => void;
  onLongPress?: () => void;
}) {
  const lp = useLongPress({
    onTap,
    onLongPress: onLongPress ?? (() => {}),
  });
  const props = onLongPress ? lp : { onClick: onTap };
  const m = difficulty ? difficultyMeta[difficulty] : null;
  return (
    <button
      {...props}
      className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition flex items-center gap-1.5 ${
        active
          ? "bg-[var(--accent-blue)] text-white ring-[var(--accent-blue)]"
          : "bg-[var(--bg-panel)] text-[var(--text-secondary)] ring-[var(--ring-soft)] active:bg-[var(--bg-panel-soft)]"
      }`}
    >
      {m && (
        <span
          className="text-sm leading-none"
          style={{ color: active ? "#fff" : m.color }}
        >
          {m.emoji}
        </span>
      )}
      <span>{title}</span>
      <span
        className={`tabular-nums ${
          active ? "text-emerald-300" : "text-[var(--text-muted)]"
        }`}
      >
        {pct}%
      </span>
    </button>
  );
}

function topoSort(ns: Node[]): Node[] {
  const ids = new Set(ns.map((n) => n.id));
  const inDeg = new Map(
    ns.map((n) => [n.id, (n.parents ?? []).filter((p) => ids.has(p)).length])
  );
  const result: Node[] = [];
  const used = new Set<string>();
  while (result.length < ns.length) {
    const ready = ns
      .filter((n) => !used.has(n.id) && (inDeg.get(n.id) ?? 0) === 0)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (ready.length === 0) {
      // cycle or external parents only — append rest
      for (const n of ns) if (!used.has(n.id)) result.push(n);
      return result;
    }
    for (const n of ready) {
      result.push(n);
      used.add(n.id);
      for (const m of ns) {
        if ((m.parents ?? []).includes(n.id)) {
          inDeg.set(m.id, (inDeg.get(m.id) ?? 0) - 1);
        }
      }
    }
  }
  return result;
}

const NODE_W = 80;
const NODE_R = NODE_W / 2;
const ROW_H = 160;
const ROW_PAD_T = 60;
const COL_PAD_X = 24;
const HCOL_SPAN = 140; // horizontal mode: x distance between level columns
const HROW_SPAN = 110; // horizontal mode: y distance between nodes in same column

function assignLevels(nodes: Node[]): Map<string, number> {
  const idSet = new Set(nodes.map((n) => n.id));
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  function lvl(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const n = nodes.find((x) => x.id === id);
    const vp = (n?.parents ?? []).filter((p) => idSet.has(p));
    const l = vp.length === 0 ? 0 : Math.max(...vp.map(lvl)) + 1;
    visiting.delete(id);
    memo.set(id, l);
    return l;
  }
  nodes.forEach((n) => lvl(n.id));
  return memo;
}

function FocusView({
  nodes: rawNodes,
  allNodes,
  onTap,
  onLongPress,
  onAdd,
}: {
  nodes: Node[];
  allNodes: Node[];
  onTap: (n: Node) => void;
  onLongPress: (n: Node) => void;
  onAdd: () => void;
}) {
  const nodes = useMemo(() => topoSort(rawNodes), [rawNodes]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(320);
  const [horizontal, setHorizontal] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(el.getBoundingClientRect().width || 320);
    const ro = new ResizeObserver(([e]) =>
      setContainerW(e.contentRect.width || 320)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const levels = useMemo(() => assignLevels(nodes), [nodes]);
  const maxLevel =
    nodes.length > 0 ? Math.max(...Array.from(levels.values())) : 0;

  const byLevel = useMemo(() => {
    const map = new Map<number, Node[]>();
    nodes.forEach((n) => {
      const l = levels.get(n.id) ?? 0;
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(n);
    });
    return map;
  }, [nodes, levels]);

  const maxNodesInLevel = useMemo(
    () => Math.max(1, ...Array.from(byLevel.values()).map((ns) => ns.length)),
    [byLevel]
  );

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();

    if (horizontal) {
      const hTotalH = (maxNodesInLevel - 1) * HROW_SPAN + 2 * (NODE_R + 32);
      for (let level = 0; level <= maxLevel; level++) {
        const ns = byLevel.get(level) ?? [];
        const sorted = [...ns].sort((a, b) => {
          const avgParentY = (n: Node) => {
            const ys = (n.parents ?? [])
              .map((pid) => map.get(pid)?.y)
              .filter((v): v is number => v !== undefined);
            return ys.length > 0
              ? ys.reduce((s, v) => s + v, 0) / ys.length
              : (n.order ?? 0);
          };
          return avgParentY(a) - avgParentY(b);
        });
        const count = sorted.length;
        sorted.forEach((n, i) => {
          const x = NODE_R + 24 + level * HCOL_SPAN;
          const y =
            count === 1
              ? hTotalH / 2
              : hTotalH / 2 + (i - (count - 1) / 2) * HROW_SPAN;
          map.set(n.id, { x, y });
        });
      }
    } else {
      const usable = containerW - 2 * COL_PAD_X - NODE_W;
      for (let level = 0; level <= maxLevel; level++) {
        const ns = byLevel.get(level) ?? [];
        const sorted = [...ns].sort((a, b) => {
          const avgParentX = (n: Node) => {
            const xs = (n.parents ?? [])
              .map((pid) => map.get(pid)?.x)
              .filter((v): v is number => v !== undefined);
            return xs.length > 0
              ? xs.reduce((s, v) => s + v, 0) / xs.length
              : (n.order ?? 0);
          };
          return avgParentX(a) - avgParentX(b);
        });
        const count = sorted.length;
        sorted.forEach((n, i) => {
          const x =
            count === 1
              ? containerW / 2
              : COL_PAD_X + NODE_R + (usable > 0 ? (i / (count - 1)) * usable : 0);
          const y = level * ROW_H + ROW_PAD_T;
          map.set(n.id, { x, y });
        });
      }
    }

    return map;
  }, [byLevel, containerW, maxLevel, horizontal, maxNodesInLevel]);

  if (nodes.length === 0) {
    return (
      <main className="px-6 pt-12">
        <div className="max-w-md mx-auto text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <div className="font-bold text-[var(--text-primary)] mb-1">クエストがまだありません</div>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            最初の一歩を追加して、ロードマップを始めましょう
          </p>
          <button
            onClick={onAdd}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-sky-400 text-white font-bold text-sm shadow-lg active:scale-95 transition"
          >
            ⚔ 最初のクエストを発行
          </button>
        </div>
      </main>
    );
  }

  const hTotalH = (maxNodesInLevel - 1) * HROW_SPAN + 2 * (NODE_R + 32);
  const hTotalW = (maxLevel + 1) * HCOL_SPAN + NODE_R + 48;
  const totalH = horizontal ? hTotalH : (maxLevel + 1) * ROW_H + ROW_PAD_T + 60;
  const svgW = horizontal ? hTotalW : containerW;

  type Edge = {
    key: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    active: boolean;
    inProgress: boolean;
    levelSpan: number;
  };
  const edges: Edge[] = [];
  nodes.forEach((n) => {
    const to = positions.get(n.id);
    if (!to) return;
    (n.parents ?? []).forEach((pid) => {
      const from = positions.get(pid);
      if (!from) return;
      const parent = nodes.find((x) => x.id === pid);
      const levelSpan = (levels.get(n.id) ?? 0) - (levels.get(pid) ?? 0);
      edges.push({
        key: `${pid}-${n.id}`,
        from,
        to,
        active: parent?.status === "done",
        inProgress: parent?.status === "in_progress",
        levelSpan,
      });
    });
  });

  return (
    <main className="pt-6">
      <div className="flex justify-end px-4 mb-2 max-w-md mx-auto">
        <button
          onClick={() => setHorizontal((h) => !h)}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ring-[var(--ring-soft)] bg-[var(--bg-panel)] text-[var(--text-secondary)] active:bg-[var(--bg-elev)]"
        >
          {horizontal ? "↕ 縦" : "↔ 横"}
        </button>
      </div>
      <div className={horizontal ? "overflow-x-auto pb-4" : ""}>
      <div
        ref={containerRef}
        className={horizontal ? "relative" : "relative mx-auto max-w-md"}
        style={
          horizontal
            ? { height: hTotalH, width: hTotalW, minWidth: hTotalW }
            : { height: totalH }
        }
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgW}
          height={totalH}
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="line-active" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <filter id="line-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
            </marker>
            <marker
              id="arrow-progress"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
            </marker>
            <marker
              id="arrow-locked"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
          </defs>
          {edges.map((e) => {
            let d: string;
            if (horizontal) {
              const startX = e.from.x + NODE_R;
              const endX = e.to.x - NODE_R - 6;
              const midX = (startX + endX) / 2;
              d = `M ${startX} ${e.from.y} C ${midX} ${e.from.y}, ${midX} ${e.to.y}, ${endX} ${e.to.y}`;
            } else {
              const startY = e.from.y + NODE_R;
              const endY = e.to.y - NODE_R - 6;
              const midY = (startY + endY) / 2;
              const longEdgeBow =
                e.levelSpan > 1
                  ? (e.from.x <= containerW / 2 ? -50 : 50)
                  : 0;
              // objectBoundingBox gradient fails on zero-width paths (SVG spec §13.4.2).
              // Bow vertical edges toward center so the bounding box has nonzero width.
              const vertBow =
                e.from.x === e.to.x
                  ? (e.from.x < containerW / 2 ? 22 : -22)
                  : 0;
              const cx1 = e.from.x + longEdgeBow + vertBow;
              const cx2 = e.to.x + longEdgeBow + vertBow;
              d = `M ${e.from.x} ${startY} C ${cx1} ${midY}, ${cx2} ${midY}, ${e.to.x} ${endY}`;
            }
            const markerId = e.active
              ? "arrow-active"
              : e.inProgress
              ? "arrow-progress"
              : "arrow-locked";
            return (
              <motion.path
                key={e.key}
                d={d}
                fill="none"
                stroke={
                  e.active
                    ? "url(#line-active)"
                    : e.inProgress
                    ? "#fbbf24"
                    : "#cbd5e1"
                }
                strokeWidth={e.active ? 3.5 : e.inProgress ? 3 : 2}
                strokeLinecap="round"
                strokeDasharray={e.active ? "0" : "5 6"}
                strokeOpacity={e.active ? 1 : e.inProgress ? 0.85 : 0.7}
                filter={e.active ? "url(#line-glow)" : undefined}
                markerEnd={`url(#${markerId})`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              />
            );
          })}
        </svg>
        {nodes.map((n, i) => {
          const pos = positions.get(n.id);
          if (!pos) return null;
          return (
            <PathNode
              key={n.id}
              n={n}
              i={i}
              x={pos.x}
              y={pos.y}
              allNodes={allNodes}
              onTap={() => onTap(n)}
              onLongPress={() => onLongPress(n)}
            />
          );
        })}
      </div>
      </div>
    </main>
  );
}

function PathNode({
  n,
  i,
  x,
  y,
  allNodes,
  onTap,
  onLongPress,
}: {
  n: Node;
  i: number;
  x: number;
  y: number;
  allNodes: Node[];
  onTap: () => void;
  onLongPress: () => void;
}) {
  const isDone = n.status === "done";
  const isProg = n.status === "in_progress";
  const locked = isLocked(n, allNodes);
  const pct = Math.round(nodeProgress(n) * 100);

  // ring color by status (dark theme)
  const ringClass = isDone
    ? "ring-emerald-500/60"
    : isProg
    ? "ring-amber-400/60"
    : locked
    ? "ring-slate-700"
    : "ring-sky-500/50";

  // water gradient (from→to, bottom→top)
  const waterFrom = isDone
    ? "#34d399"
    : isProg
    ? "#fbbf24"
    : locked
    ? "#cbd5e1"
    : "#7dd3fc";
  const waterTo = isDone
    ? "#a7f3d0"
    : isProg
    ? "#fde68a"
    : locked
    ? "#e2e8f0"
    : "#bae6fd";

  // empty tank background (dark-theme friendly)
  const tankBg = locked ? "#1a1d29" : "#14171f";

  const longPress = useLongPress({ onTap, onLongPress });

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        delay: Math.min(i * 0.05, 0.4),
        type: "spring",
        damping: 16,
      }}
      style={{
        position: "absolute",
        left: x - 70,
        top: y - NODE_W / 2,
        width: 140,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Circle button — exactly NODE_W wide so tap targets don't overlap */}
      <button {...longPress} className="relative block" style={{ width: NODE_W, height: NODE_W }}>
        {isDone && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(52,211,153,0.45)",
                  "0 0 0 14px rgba(52,211,153,0)",
                ],
              }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
            <span className="quest-stamp">達成</span>
          </>
        )}
        <div
          className={`relative w-20 h-20 rounded-full overflow-hidden ring-4 shadow-lg ${ringClass}`}
          style={{ background: tankBg }}
        >
          {/* water fill */}
          <motion.div
            className="absolute inset-x-0 bottom-0"
            style={{
              background: `linear-gradient(to top, ${waterFrom}, ${waterTo})`,
            }}
            initial={false}
            animate={{ height: `${locked ? 0 : pct}%` }}
            transition={{ type: "spring", damping: 22, stiffness: 140 }}
          >
            {/* surface ripple line */}
            <div
              className="absolute top-0 inset-x-0 h-[3px]"
              style={{
                background: `linear-gradient(to bottom, rgba(255,255,255,0.55), transparent)`,
              }}
            />
          </motion.div>
          {/* glass highlight */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%)",
            }}
          />
          {/* center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {locked ? (
              <span className="text-2xl">🔒</span>
            ) : (
              <>
                <span
                  className={`text-[15px] font-extrabold tabular-nums leading-none drop-shadow-sm ${
                    isDone || isProg ? "text-white" : "text-sky-300"
                  }`}
                >
                  {pct}%
                </span>
                {isDone && (
                  <span className="text-[10px] text-white/90 mt-0.5 leading-none">
                    ✓
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </button>
      {/* Title below — pointer-events-none so it doesn't create a false tap target */}
      <div className="mt-2 px-1 w-full text-center pointer-events-none">
        <div
          className={`text-xs font-semibold leading-tight ${
            locked ? "text-slate-400" : "text-[var(--text-primary)]"
          }`}
        >
          {n.title}
        </div>
      </div>
    </motion.div>
  );
}

function OverviewView({
  tabs,
  allNodes,
  onPick,
  onPickGroup,
}: {
  tabs: {
    id: string;
    title: string;
    nodes: Node[];
    difficulty?: Difficulty;
  }[];
  allNodes: Node[];
  onPick: (n: Node, tabId: string) => void;
  onPickGroup: (tabId: string) => void;
}) {
  if (tabs.length === 0 || allNodes.length === 0) {
    return (
      <main className="px-6 pt-12 text-center">
        <div className="text-sm text-[var(--text-muted)]">クエストがまだありません</div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-4">
      <div className="max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {tabs.map((t) => {
            const p = progress(t.nodes);
            const m = t.difficulty ? difficultyMeta[t.difficulty] : null;
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => onPickGroup(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onPickGroup(t.id);
                }}
                className="rounded-2xl bg-[var(--bg-panel)] ring-1 ring-[var(--ring-soft)] p-2.5 shadow-sm cursor-pointer active:scale-[0.98] active:bg-[var(--bg-panel-soft)] transition"
              >
                <div className="flex items-center gap-1.5">
                  {m && (
                    <span
                      className="text-base leading-none"
                      style={{ color: m.color }}
                    >
                      {m.emoji}
                    </span>
                  )}
                  <div className="text-[14px] font-bold text-[var(--text-primary)] leading-tight line-clamp-1 flex-1 min-w-0">
                    {t.title}
                  </div>
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-[var(--bg-elev)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-sky-400"
                    style={{ width: `${p.pct}%` }}
                  />
                </div>
                <div className="text-[13px] text-[var(--text-muted)] mt-1 tabular-nums">{p.pct}%</div>
                <div className="mt-2 space-y-1.5">
                  {t.nodes.map((n, i) => (
                    <MiniNode
                      key={n.id}
                      n={n}
                      idx={i}
                      allNodes={allNodes}
                      onPick={(e) => {
                        e.stopPropagation();
                        onPick(n, t.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function MiniNode({
  n,
  idx,
  allNodes,
  onPick,
}: {
  n: Node;
  idx: number;
  allNodes: Node[];
  onPick: (e: React.MouseEvent) => void;
}) {
  const cp = checklistProgress(n);
  const isDone = n.status === "done";
  const isProg = n.status === "in_progress";
  const locked = isLocked(n, allNodes);
  return (
    <motion.button
      onClick={onPick}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className="w-full flex items-center gap-1.5 text-left"
    >
      <div
        className={`flex-none w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
          isDone
            ? "bg-gradient-to-br from-emerald-300 to-emerald-500 text-white"
            : isProg
            ? "bg-gradient-to-br from-amber-300 to-orange-400 text-white"
            : locked
            ? "bg-slate-200 text-slate-400"
            : "bg-[var(--bg-panel)] ring-1 ring-sky-300 text-sky-500"
        }`}
      >
        {isDone ? "✓" : isProg ? "◐" : locked ? "🔒" : idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[14px] leading-tight truncate ${
            locked ? "text-slate-400" : "text-[var(--text-primary)]"
          }`}
        >
          {n.title}
        </div>
        {isProg && (
          <div className="mt-0.5 h-0.5 w-full rounded-full bg-[var(--bg-elev)] overflow-hidden">
            <div
              className="h-full bg-amber-400"
              style={{ width: `${cp.pct}%` }}
            />
          </div>
        )}
      </div>
    </motion.button>
  );
}

function FAB({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2, type: "spring", damping: 16 }}
      className="fixed bottom-6 right-5 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-white text-2xl font-bold shadow-xl shadow-sky-300/50 flex items-center justify-center"
      aria-label="クエスト発行"
    >
      ＋
    </motion.button>
  );
}
