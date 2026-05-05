"use client";
import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Node as RFNode,
  Edge as RFEdge,
  Handle,
  Position,
  NodeProps,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Node,
  Group,
  checklistProgress,
  isLocked,
} from "@/lib/store";
import { useLongPress } from "@/lib/useLongPress";

const GROUP_COLORS = [
  "ring-rose-300 bg-rose-50",
  "ring-orange-300 bg-orange-50",
  "ring-amber-300 bg-amber-50",
  "ring-lime-300 bg-lime-50",
  "ring-emerald-300 bg-emerald-50",
  "ring-cyan-300 bg-cyan-50",
  "ring-blue-300 bg-blue-50",
  "ring-violet-300 bg-violet-50",
  "ring-fuchsia-300 bg-fuchsia-50",
];

function colorForGroup(groupId: string | null): string {
  if (!groupId) return "ring-slate-300 bg-slate-50";
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0;
  }
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

function computeDepths(nodes: Node[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const memo = new Map<string, number>();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  function visit(id: string, stack: Set<string>): number {
    if (memo.has(id)) return memo.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    const n = byId.get(id);
    if (!n) return 0;
    const parentIds = (n.parents ?? []).filter((p) => ids.has(p));
    let d = 0;
    if (parentIds.length > 0) {
      d = Math.max(...parentIds.map((p) => visit(p, stack) + 1));
    }
    stack.delete(id);
    memo.set(id, d);
    return d;
  }

  for (const n of nodes) visit(n.id, new Set());
  return memo;
}

function layout(nodes: Node[]): Map<string, { x: number; y: number }> {
  const depths = computeDepths(nodes);
  const byDepth = new Map<number, Node[]>();
  for (const n of nodes) {
    const d = depths.get(n.id) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  }
  for (const arr of byDepth.values()) {
    arr.sort((a, b) => {
      const ag = a.groupId ?? "zz";
      const bg = b.groupId ?? "zz";
      const c = ag.localeCompare(bg);
      if (c !== 0) return c;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }
  const X_SP = 200;
  const Y_SP = 150;
  const positions = new Map<string, { x: number; y: number }>();
  const depthsSorted = [...byDepth.keys()].sort((a, b) => a - b);
  for (const d of depthsSorted) {
    const arr = byDepth.get(d)!;
    arr.forEach((n, i) => {
      const x = (i - (arr.length - 1) / 2) * X_SP;
      const y = d * Y_SP;
      positions.set(n.id, { x, y });
    });
  }
  return positions;
}

type CustomData = {
  node: Node;
  groupTitle: string;
  groupColor: string;
  locked: boolean;
  onTap: (n: Node) => void;
  onLongPress: (n: Node) => void;
};

function FieldNode({ data }: NodeProps<CustomData>) {
  const n = data.node;
  const cp = checklistProgress(n);
  const isDone = n.status === "done";
  const isProg = n.status === "in_progress";
  const locked = data.locked;

  const longPress = useLongPress({
    onTap: () => data.onTap(n),
    onLongPress: () => data.onLongPress(n),
  });

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-0 !w-1 !h-1"
      />
      <button
        {...longPress}
        className={`relative w-[150px] rounded-2xl ring-2 px-3 py-2.5 shadow-md text-left ${
          isDone
            ? "ring-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100"
            : isProg
            ? "ring-amber-400 bg-gradient-to-br from-amber-50 to-orange-100"
            : locked
            ? "ring-slate-200 bg-slate-50"
            : data.groupColor
        }`}
      >
        {data.groupTitle && (
          <div className="text-[9px] text-gray-400 truncate mb-1">
            {data.groupTitle}
          </div>
        )}
        <div
          className={`text-xs font-semibold leading-tight ${
            locked ? "text-slate-400" : "text-gray-900"
          }`}
        >
          {locked && <span className="mr-1">🔒</span>}
          {isDone && <span className="mr-1 text-emerald-500">✓</span>}
          {isProg && <span className="mr-1 text-amber-500">◐</span>}
          {n.title}
        </div>
        {(isProg || isDone) && (
          <div className="mt-1.5 h-1 w-full rounded-full bg-white/70 overflow-hidden">
            <div
              className={`h-full ${
                isDone ? "bg-emerald-400" : "bg-amber-400"
              }`}
              style={{ width: `${isDone ? 100 : cp.pct}%` }}
            />
          </div>
        )}
      </button>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-0 !w-1 !h-1"
      />
    </div>
  );
}

const nodeTypes = { field: FieldNode };

export default function UnifiedField({
  nodes,
  groups,
  onTap,
  onLongPress,
}: {
  nodes: Node[];
  groups: Group[];
  onTap: (n: Node) => void;
  onLongPress: (n: Node) => void;
}) {
  const groupTitle = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) m.set(g.id, g.title);
    return m;
  }, [groups]);

  const positions = useMemo(() => layout(nodes), [nodes]);

  const rfNodes: RFNode<CustomData>[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "field",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: {
          node: n,
          groupTitle: n.groupId ? groupTitle.get(n.groupId) ?? "" : "",
          groupColor: colorForGroup(n.groupId),
          locked: isLocked(n, nodes),
          onTap,
          onLongPress,
        },
        draggable: false,
        selectable: false,
      })),
    [nodes, groupTitle, positions, onTap, onLongPress]
  );

  const rfEdges: RFEdge[] = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    const result: RFEdge[] = [];
    for (const n of nodes) {
      for (const pid of n.parents ?? []) {
        if (!ids.has(pid)) continue;
        const parent = nodes.find((x) => x.id === pid)!;
        const active = parent.status === "done";
        result.push({
          id: `${pid}-${n.id}`,
          source: pid,
          target: n.id,
          type: "smoothstep",
          animated: active,
          style: {
            stroke: active ? "#22d3ee" : "#cbd5e1",
            strokeWidth: active ? 2.5 : 2,
            strokeDasharray: active ? undefined : "5 5",
          },
        });
      }
    }
    return result;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="px-6 pt-12 text-center text-sm text-gray-400">
        ノードがまだありません
      </div>
    );
  }

  return (
    <div
      className="mx-4 rounded-2xl bg-white ring-1 ring-gray-200 shadow-sm overflow-hidden"
      style={{ height: "calc(100vh - 220px)", minHeight: 400 }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag
          zoomOnPinch
          zoomOnScroll
        >
          <Background gap={20} color="#e5e7eb" />
          <Controls showInteractive={false} className="!shadow-md" />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
