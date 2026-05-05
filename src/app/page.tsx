"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useUserData,
  useMutations,
  Node,
  Group,
  checklistProgress,
  isLocked,
  progress,
  nodeProgress,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useLongPress } from "@/lib/useLongPress";
import AuthGate from "@/components/AuthGate";
import NodeSheet from "@/components/NodeSheet";
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
  const [sheet, setSheet] = useState<Node | null>(null);
  const [menu, setMenu] = useState<Node | null>(null);
  const [editor, setEditor] = useState<{
    node: Node | null;
    requireNewGroup?: boolean;
    showGroupChips?: boolean;
    presetGroupId?: string | null;
  } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Node | null>(null);
  const [renameTarget, setRenameTarget] = useState<
    { id: string; current: string } | null
  >(null);
  const [groupMenu, setGroupMenu] = useState<
    { id: string; title: string } | null
  >(null);
  const [confirmDelGroup, setConfirmDelGroup] = useState<
    { id: string; title: string } | null
  >(null);

  const tabs = useMemo<{ id: string; title: string; nodes: Node[] }[]>(() => {
    const ungrouped = nodes.filter((n) => !n.groupId);
    const groupTabs = groups.map((g) => ({
      id: g.id,
      title: g.title,
      nodes: nodes.filter((n) => n.groupId === g.id),
    }));
    const all: { id: string; title: string; nodes: Node[] }[] = [];
    if (ungrouped.length > 0 || groupTabs.length === 0) {
      all.push({ id: UNGROUPED, title: "未分類", nodes: ungrouped });
    }
    all.push(...groupTabs);
    return all;
  }, [nodes, groups]);

  const activeIdx = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );
  const currentTab = tabs[activeIdx];

  const overall = progress(nodes);

  if (!ready || !ops) {
    return (
      <div className="min-h-screen flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-400">読み込み中…</div>
      </div>
    );
  }

  const handleSave = async (draft: NodeDraft) => {
    if (editor?.node) {
      await ops.updateNode(editor.node.id, draft);
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
        ...draft,
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
    if (sheet?.id === confirmDel.id) setSheet(null);
  };

  return (
    <div className="min-h-screen flex-1 bg-gradient-to-b from-slate-50 via-sky-50 to-white pb-32">
      <Header
        userName={user?.displayName ?? ""}
        userPhoto={user?.photoURL ?? ""}
        pct={overall.pct}
        done={overall.done}
        inProg={overall.inProg}
        total={overall.total}
        onSignOut={() => signOutUser().catch(console.error)}
      />

      <div className="sticky top-[88px] z-20 bg-gradient-to-b from-slate-50/95 to-slate-50/70 backdrop-blur px-4 pt-2 pb-3">
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
                  const tab = tabs.find((t) => t.id === id);
                  const empty = (tab?.nodes.length ?? 0) === 0;
                  if (id !== UNGROUPED && empty) {
                    setGroupMenu({ id, title: current });
                  } else {
                    setRenameTarget({ id, current });
                  }
                }}
              />
            )}
            <FocusView
              nodes={currentTab?.nodes ?? []}
              allNodes={nodes}
              onTap={setSheet}
              onLongPress={setMenu}
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
                  setTimeout(() => setSheet(n), 220);
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
                onTap={setSheet}
                onLongPress={setMenu}
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

      <NodeSheet
        node={sheet}
        onClose={() => setSheet(null)}
        onToggleChecklist={(n, id) => ops.toggleChecklist(n, id)}
      />

      <ActionMenu
        open={!!menu}
        title={menu?.title ?? ""}
        onClose={() => setMenu(null)}
        onEdit={() => {
          setEditor({ node: menu });
          setMenu(null);
        }}
        onDelete={() => {
          setConfirmDel(menu);
          setMenu(null);
        }}
      />

      <NodeEditor
        open={!!editor}
        isNew={!editor?.node}
        initial={editor?.node ?? {}}
        allNodes={nodes}
        groups={groups}
        showGroupChips={
          editor?.node ? true : editor?.showGroupChips ?? false
        }
        requireNewGroup={editor?.requireNewGroup ?? false}
        onSave={handleSave}
        onCancel={() => setEditor(null)}
        onAddGroup={async (title) => {
          const id = await ops.addGroup(title);
          return id;
        }}
        newChecklistId={ops.newChecklistId}
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
        title="グループ名を編集"
        initialValue={renameTarget?.current ?? ""}
        placeholder="グループ名"
        onCancel={() => setRenameTarget(null)}
        onConfirm={async (next) => {
          if (!renameTarget) return;
          const id = renameTarget.id;
          if (id === UNGROUPED) {
            const newId = await ops.addGroup(next);
            const ungroupedNodes = nodes.filter((n) => !n.groupId);
            await Promise.all(
              ungroupedNodes.map((n) => ops.updateNode(n.id, { groupId: newId }))
            );
            setActiveTab(newId);
          } else if (next !== renameTarget.current) {
            await ops.updateGroup(id, { title: next });
          }
          setRenameTarget(null);
        }}
      />

      <ActionMenu
        open={!!groupMenu}
        title={groupMenu?.title ?? ""}
        editLabel="✎ 名前変更"
        deleteLabel="🗑 グループ削除"
        onClose={() => setGroupMenu(null)}
        onEdit={() => {
          if (!groupMenu) return;
          setRenameTarget({ id: groupMenu.id, current: groupMenu.title });
          setGroupMenu(null);
        }}
        onDelete={() => {
          if (!groupMenu) return;
          setConfirmDelGroup({ id: groupMenu.id, title: groupMenu.title });
          setGroupMenu(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmDelGroup}
        title="本当に削除して良いですか？"
        message={confirmDelGroup?.title}
        confirmLabel="削除する"
        cancelLabel="削除しない"
        onConfirm={async () => {
          if (!confirmDelGroup) return;
          await ops.deleteGroup(confirmDelGroup.id, nodes);
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
  pct,
  done,
  inProg,
  total,
  onSignOut,
}: {
  userName: string;
  userPhoto: string;
  pct: number;
  done: number;
  inProg: number;
  total: number;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-gray-100">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-gray-900">Milestride</div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-gray-200 active:scale-95 transition"
          >
            {userPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userPhoto} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-sky-400 to-emerald-400 text-white text-xs font-bold flex items-center justify-center">
                {userName.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-3 top-12 z-50 rounded-xl bg-white shadow-xl ring-1 ring-gray-200 overflow-hidden">
                <div className="px-4 py-3 text-xs text-gray-600 border-b border-gray-100">
                  {userName}
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-800 active:bg-gray-50"
                >
                  サインアウト
                </button>
              </div>
            </>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 to-sky-400"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", damping: 22, stiffness: 120 }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-900 tabular-nums w-9 text-right">
            {pct}%
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
          <span>完了 {done}</span>
          <span>進行中 {inProg}</span>
          <span>合計 {total}</span>
        </div>
      </div>
    </header>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="relative inline-flex bg-white/80 ring-1 ring-gray-200 rounded-full p-1 shadow-sm">
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
            mode === m ? "text-white" : "text-gray-600"
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
    <div className="relative inline-flex bg-white ring-1 ring-gray-200 rounded-full p-0.5 shadow-sm text-[13px]">
      {(["grouped", "unified"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLayout(l)}
          className={`px-3 py-1 rounded-full font-semibold transition ${
            layout === l ? "bg-slate-900 text-white" : "text-gray-600"
          }`}
        >
          {l === "grouped" ? "グループ別" : "統合フィールド"}
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
  tabs: { id: string; title: string; nodes: Node[] }[];
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
              active={active}
              onTap={() => onChange(t.id)}
              onLongPress={() => onRenameGroup(t.id, t.title)}
            />
          );
        })}
        <button
          onClick={onAddGroup}
          aria-label="グループを追加"
          className="flex-none w-8 h-8 rounded-full bg-white text-sky-500 ring-1 ring-sky-200 active:bg-sky-50 flex items-center justify-center font-bold text-base"
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
  active,
  onTap,
  onLongPress,
}: {
  id: string;
  title: string;
  pct: number;
  active: boolean;
  onTap: () => void;
  onLongPress?: () => void;
}) {
  const lp = useLongPress({
    onTap,
    onLongPress: onLongPress ?? (() => {}),
  });
  const props = onLongPress ? lp : { onClick: onTap };
  return (
    <button
      {...props}
      className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition ${
        active
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-gray-700 ring-gray-200 active:bg-gray-50"
      }`}
    >
      {title}
      <span
        className={`ml-2 tabular-nums ${
          active ? "text-emerald-300" : "text-gray-400"
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
const COL_W = 280;
const SPACING = 140;
const PAD_T = 50;
const OFFSETS = [0, 56, 0, -56];

const xOf = (i: number) => COL_W / 2 + OFFSETS[i % 4];
const yOf = (i: number) => i * SPACING + PAD_T;

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

  if (nodes.length === 0) {
    return (
      <main className="px-6 pt-12">
        <div className="max-w-md mx-auto text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <div className="font-bold text-gray-900 mb-1">ノードがまだありません</div>
          <p className="text-sm text-gray-500 mb-6">
            最初の一歩を追加して、ロードマップを始めましょう
          </p>
          <button
            onClick={onAdd}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-sky-400 text-white font-bold text-sm shadow-lg active:scale-95 transition"
          >
            ＋ 最初のノードを追加
          </button>
        </div>
      </main>
    );
  }

  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const totalH = nodes.length * SPACING + PAD_T + 30;

  type Edge = {
    key: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    active: boolean;
  };
  const edges: Edge[] = [];
  nodes.forEach((n, i) => {
    for (const pid of n.parents ?? []) {
      const pi = idx.get(pid);
      if (pi === undefined) continue;
      const parent = nodes[pi];
      edges.push({
        key: `${pid}-${n.id}`,
        from: { x: xOf(pi), y: yOf(pi) },
        to: { x: xOf(i), y: yOf(i) },
        active: parent.status === "done",
      });
    }
  });

  return (
    <main className="pt-6">
      <div
        className="relative mx-auto"
        style={{ width: COL_W, height: totalH }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          width={COL_W}
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
              id="arrow-locked"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
          </defs>
          {edges.map((e) => {
            const r = NODE_W / 2;
            const startY = e.from.y + r;
            const endY = e.to.y - r - 6; // small gap so arrowhead doesn't bury into circle
            const midY = (startY + endY) / 2;
            const d = `M ${e.from.x} ${startY} C ${e.from.x} ${midY}, ${e.to.x} ${midY}, ${e.to.x} ${endY}`;
            return (
              <motion.path
                key={e.key}
                d={d}
                fill="none"
                stroke={e.active ? "url(#line-active)" : "#cbd5e1"}
                strokeWidth={e.active ? 3.5 : 2.5}
                strokeLinecap="round"
                strokeDasharray={e.active ? "0" : "5 6"}
                filter={e.active ? "url(#line-glow)" : undefined}
                markerEnd={e.active ? "url(#arrow-active)" : "url(#arrow-locked)"}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              />
            );
          })}
        </svg>
        {nodes.map((n, i) => (
          <PathNode
            key={n.id}
            n={n}
            i={i}
            x={xOf(i)}
            y={yOf(i)}
            allNodes={allNodes}
            onTap={() => onTap(n)}
            onLongPress={() => onLongPress(n)}
          />
        ))}
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

  // ring color by status
  const ringClass = isDone
    ? "ring-emerald-200"
    : isProg
    ? "ring-amber-200"
    : locked
    ? "ring-slate-100"
    : "ring-sky-200";

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

  // empty tank background
  const tankBg = locked ? "#f1f5f9" : "#f8fafc";

  const longPress = useLongPress({ onTap, onLongPress });

  return (
    <motion.div
      layoutId={n.id}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        layout: { type: "spring", damping: 24, stiffness: 220 },
        default: {
          delay: Math.min(i * 0.05, 0.4),
          type: "spring",
          damping: 16,
        },
      }}
      style={{
        position: "absolute",
        left: x - 70,
        top: y - NODE_W / 2,
        width: 140,
      }}
    >
      <button {...longPress} className="block w-full">
        <div className="flex flex-col items-center">
          <div className="relative">
            {isDone && (
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
                        isDone || isProg ? "text-white" : "text-sky-900"
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
          </div>
          <div className="text-center mt-2 px-1 w-full">
            <div
              className={`text-xs font-semibold leading-tight ${
                locked ? "text-slate-400" : "text-gray-800"
              }`}
            >
              {n.title}
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

function OverviewView({
  tabs,
  allNodes,
  onPick,
  onPickGroup,
}: {
  tabs: { id: string; title: string; nodes: Node[] }[];
  allNodes: Node[];
  onPick: (n: Node, tabId: string) => void;
  onPickGroup: (tabId: string) => void;
}) {
  if (tabs.length === 0 || allNodes.length === 0) {
    return (
      <main className="px-6 pt-12 text-center">
        <div className="text-sm text-gray-400">ノードがまだありません</div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-4">
      <div className="max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {tabs.map((t) => {
            const p = progress(t.nodes);
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => onPickGroup(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onPickGroup(t.id);
                }}
                className="rounded-2xl bg-white ring-1 ring-gray-200 p-2.5 shadow-sm cursor-pointer active:scale-[0.98] active:bg-gray-50 transition"
              >
                <div className="text-[14px] font-bold text-gray-800 leading-tight line-clamp-1">
                  {t.title}
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-sky-400"
                    style={{ width: `${p.pct}%` }}
                  />
                </div>
                <div className="text-[13px] text-gray-400 mt-1 tabular-nums">{p.pct}%</div>
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
            : "bg-white ring-1 ring-sky-300 text-sky-500"
        }`}
      >
        {isDone ? "✓" : isProg ? "◐" : locked ? "🔒" : idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[14px] leading-tight truncate ${
            locked ? "text-slate-400" : "text-gray-800"
          }`}
        >
          {n.title}
        </div>
        {isProg && (
          <div className="mt-0.5 h-0.5 w-full rounded-full bg-gray-100 overflow-hidden">
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
      aria-label="新規ノード"
    >
      ＋
    </motion.button>
  );
}
