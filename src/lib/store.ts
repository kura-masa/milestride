"use client";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { useAuth } from "./auth";

export type Status = "done" | "in_progress" | "todo";
export type ChecklistItem = { id: string; label: string; done: boolean };

export type Node = {
  id: string;
  title: string;
  status: Status;
  detail: string;
  groupId: string | null;
  parents: string[];
  order: number;
  position?: { x: number; y: number };
  checklist: ChecklistItem[];
  memo?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type Group = {
  id: string;
  title: string;
  color?: string;
  /** 1=見習い 5=伝説. Determines emblem icon and EXP multiplier. */
  difficulty?: Difficulty;
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export const difficultyMeta: Record<
  Difficulty,
  { name: string; emoji: string; color: string; expMul: number }
> = {
  1: { name: "見習い", emoji: "🛡", color: "#a37854", expMul: 1 },
  2: { name: "熟練", emoji: "⚔", color: "#c0c0c0", expMul: 1.5 },
  3: { name: "達人", emoji: "👑", color: "#ffd166", expMul: 2 },
  4: { name: "英雄", emoji: "✦", color: "#a4a4ff", expMul: 3 },
  5: { name: "伝説", emoji: "♛", color: "#ff5577", expMul: 5 },
};

function userPath(uid: string, ...rest: string[]) {
  return ["users", uid, ...rest].join("/");
}

export function useUserData() {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setNodes([]);
      setGroups([]);
      setReady(false);
      return;
    }
    const { db } = getFirebase();
    const nodesQ = query(
      collection(db, userPath(user.uid, "nodes")),
      orderBy("order", "asc")
    );
    const groupsQ = query(
      collection(db, userPath(user.uid, "groups")),
      orderBy("order", "asc")
    );
    let nReady = false;
    let gReady = false;
    const tryReady = () => {
      if (nReady && gReady) setReady(true);
    };
    const unsubN = onSnapshot(nodesQ, (snap) => {
      setNodes(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Node, "id">) }))
      );
      nReady = true;
      tryReady();
    });
    const unsubG = onSnapshot(groupsQ, (snap) => {
      setGroups(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, "id">) }))
      );
      gReady = true;
      tryReady();
    });
    return () => {
      unsubN();
      unsubG();
    };
  }, [user]);

  return { nodes, groups, ready };
}

export function useMutations() {
  const { user } = useAuth();
  const ops = useMemo(() => {
    if (!user) return null;
    const { db } = getFirebase();
    const uid = user.uid;
    const nodesCol = collection(db, userPath(uid, "nodes"));
    const groupsCol = collection(db, userPath(uid, "groups"));

    const newId = () => Math.random().toString(36).slice(2, 11);

    return {
      addNode: async (
        input: Partial<Omit<Node, "id" | "createdAt" | "updatedAt">> & { title: string }
      ) => {
        const ref = await addDoc(nodesCol, {
          title: input.title,
          status: input.status ?? "todo",
          detail: input.detail ?? "",
          groupId: input.groupId ?? null,
          parents: input.parents ?? [],
          order: input.order ?? Date.now(),
          position: input.position ?? null,
          checklist: input.checklist ?? [],
          memo: input.memo ?? "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return ref.id;
      },
      updateNode: async (id: string, patch: Partial<Node>) => {
        const ref = doc(db, userPath(uid, "nodes", id));
        const data: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
        delete data.id;
        delete data.createdAt;
        await updateDoc(ref, data);
      },
      deleteNode: async (id: string) => {
        const batch = writeBatch(db);
        batch.delete(doc(db, userPath(uid, "nodes", id)));
        batch.commit();
      },
      removeFromAllParents: async (id: string, allNodes: Node[]) => {
        const batch = writeBatch(db);
        for (const n of allNodes) {
          if (n.parents?.includes(id)) {
            batch.update(doc(db, userPath(uid, "nodes", n.id)), {
              parents: arrayRemove(id),
              updatedAt: serverTimestamp(),
            });
          }
        }
        await batch.commit();
      },
      addEdge: async (childId: string, parentId: string) => {
        await updateDoc(doc(db, userPath(uid, "nodes", childId)), {
          parents: arrayUnion(parentId),
          updatedAt: serverTimestamp(),
        });
      },
      removeEdge: async (childId: string, parentId: string) => {
        await updateDoc(doc(db, userPath(uid, "nodes", childId)), {
          parents: arrayRemove(parentId),
          updatedAt: serverTimestamp(),
        });
      },
      toggleChecklist: async (node: Node, itemId: string) => {
        const next = node.checklist.map((c) =>
          c.id === itemId ? { ...c, done: !c.done } : c
        );
        const total = next.length;
        const doneCount = next.filter((c) => c.done).length;
        const status: Status =
          total > 0 && doneCount === total
            ? "done"
            : doneCount > 0
            ? "in_progress"
            : "todo";
        await updateDoc(doc(db, userPath(uid, "nodes", node.id)), {
          checklist: next,
          status,
          updatedAt: serverTimestamp(),
        });
      },
      replaceChecklist: async (nodeId: string, items: ChecklistItem[]) => {
        const total = items.length;
        const doneCount = items.filter((c) => c.done).length;
        const status: Status =
          total > 0 && doneCount === total
            ? "done"
            : doneCount > 0
            ? "in_progress"
            : "todo";
        await updateDoc(doc(db, userPath(uid, "nodes", nodeId)), {
          checklist: items,
          status,
          updatedAt: serverTimestamp(),
        });
      },
      saveMemo: async (nodeId: string, memo: string) => {
        const status = deriveStatusFromMemo(memo);
        await updateDoc(doc(db, userPath(uid, "nodes", nodeId)), {
          memo,
          status,
          updatedAt: serverTimestamp(),
        });
      },
      addGroup: async (
        title: string,
        difficulty: Difficulty = 1,
        order = Date.now()
      ) => {
        const ref = await addDoc(groupsCol, {
          title,
          difficulty,
          order,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return ref.id;
      },
      updateGroup: async (id: string, patch: Partial<Group>) => {
        const data: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
        delete data.id;
        delete data.createdAt;
        await updateDoc(doc(db, userPath(uid, "groups", id)), data);
      },
      deleteGroup: async (
        id: string,
        allNodes: Node[],
        deleteNodes = false
      ) => {
        const batch = writeBatch(db);
        batch.delete(doc(db, userPath(uid, "groups", id)));
        if (deleteNodes) {
          const removedIds = new Set(
            allNodes.filter((n) => n.groupId === id).map((n) => n.id)
          );
          for (const n of allNodes) {
            if (removedIds.has(n.id)) {
              batch.delete(doc(db, userPath(uid, "nodes", n.id)));
            } else if ((n.parents ?? []).some((p) => removedIds.has(p))) {
              batch.update(doc(db, userPath(uid, "nodes", n.id)), {
                parents: (n.parents ?? []).filter((p) => !removedIds.has(p)),
                updatedAt: serverTimestamp(),
              });
            }
          }
        } else {
          for (const n of allNodes) {
            if (n.groupId === id) {
              batch.update(doc(db, userPath(uid, "nodes", n.id)), {
                groupId: null,
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
        await batch.commit();
      },
      newChecklistId: newId,
    };
  }, [user]);

  return ops;
}

// Marker pattern: matches every `[ ]` or `[x]` anywhere in the memo
const MARKER_RE = /\[( |x|X)\]/g;

export type MemoChecklistItem = {
  markerStart: number;
  label: string;
  done: boolean;
};

export function parseMemoChecklist(memo: string | undefined): MemoChecklistItem[] {
  if (!memo) return [];
  const items: MemoChecklistItem[] = [];
  const re = new RegExp(MARKER_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(memo)) !== null) {
    const done = m[1].toLowerCase() === "x";
    // Try to extract a label for display purposes:
    //   * Inline form `[ ]label[/]` → text up to `[/]`
    //   * Line form (rest of line) → text up to next marker / `[/]` / newline
    const start = m.index + m[0].length;
    const rest = memo.slice(start);
    const closeIdx = rest.indexOf("[/]");
    const nlIdx = rest.indexOf("\n");
    const nextMarker = (() => {
      const r = new RegExp(MARKER_RE.source);
      const mm = r.exec(rest);
      return mm ? mm.index : -1;
    })();
    const candidates = [closeIdx, nlIdx, nextMarker].filter((i) => i >= 0);
    const end = candidates.length > 0 ? Math.min(...candidates) : rest.length;
    const label = rest.slice(0, end).replace(/^\s+/, "").replace(/\s+$/, "");
    items.push({ markerStart: m.index, label, done });
  }
  return items;
}

export function toggleMemoChecklistAt(memo: string, markerStart: number): string {
  if (markerStart < 0 || markerStart + 2 >= memo.length) return memo;
  if (memo[markerStart] !== "[" || memo[markerStart + 2] !== "]") return memo;
  const ch = memo[markerStart + 1];
  if (ch !== " " && ch !== "x" && ch !== "X") return memo;
  const newCh = ch === " " ? "x" : " ";
  return memo.slice(0, markerStart + 1) + newCh + memo.slice(markerStart + 2);
}

export function deriveStatusFromMemo(
  memo: string | undefined,
  fallback: Status = "todo"
): Status {
  const items = parseMemoChecklist(memo);
  if (items.length === 0) return fallback;
  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return "done";
  if (doneCount > 0) return "in_progress";
  return "todo";
}

export function nodeProgress(n: Node): number {
  if (n.status === "done") return 1;
  const items = parseMemoChecklist(n.memo);
  if (items.length > 0) {
    return items.filter((i) => i.done).length / items.length;
  }
  return n.status === "in_progress" ? 0.5 : 0;
}

/** Compute the adventurer's level + EXP from completed quests.
 *  Each completed node = 10 EXP. Cumulative thresholds form a quadratic
 *  curve: Lv 2 needs 30 EXP, Lv 3 needs 90, Lv 4 needs 180, Lv 5 needs 300.
 *  Going from Lv L to L+1 always costs 30 * L EXP. */
/** Compute the adventurer's level + EXP. Base 10 EXP per done quest,
 *  multiplied by the quest's area difficulty (1-5x). */
export function levelInfo(ns: Node[], gs: Group[] = []) {
  const diffById = new Map<string | null, Difficulty>();
  for (const g of gs) diffById.set(g.id, (g.difficulty ?? 1) as Difficulty);
  let exp = 0;
  let done = 0;
  for (const n of ns) {
    if (n.status !== "done") continue;
    done++;
    const d: Difficulty = diffById.get(n.groupId) ?? 1;
    exp += Math.round(10 * difficultyMeta[d].expMul);
  }
  let lv = 1;
  while (15 * (lv + 1) * lv <= exp) lv++;
  const cur = exp - 15 * lv * (lv - 1);
  const need = 30 * lv;
  const pct = need === 0 ? 0 : Math.min(100, Math.round((cur / need) * 100));
  return { lv, exp, cur, need, pct, doneCount: done };
}

export function progress(ns: Node[]) {
  const total = ns.length;
  const done = ns.filter((n) => n.status === "done").length;
  const inProg = ns.filter((n) => n.status === "in_progress").length;
  const sum = ns.reduce((s, n) => s + nodeProgress(n), 0);
  const pct = total === 0 ? 0 : Math.round((sum / total) * 100);
  return { total, done, inProg, pct };
}

export function checklistProgress(n: Node) {
  const items = parseMemoChecklist(n.memo);
  const t = items.length;
  const d = items.filter((i) => i.done).length;
  return { total: t, done: d, pct: t === 0 ? 0 : Math.round((d / t) * 100) };
}

export function isLocked(n: Node, all: Node[]): boolean {
  if (n.status !== "todo") return false;
  if (!n.parents || n.parents.length === 0) return false;
  return !n.parents.every((pid) => all.find((x) => x.id === pid)?.status === "done");
}

