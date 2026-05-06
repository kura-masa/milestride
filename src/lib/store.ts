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

export type Group = {
  id: string;
  title: string;
  color?: string;
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
      addGroup: async (title: string, order = Date.now()) => {
        const ref = await addDoc(groupsCol, {
          title,
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

const INLINE_CHECK_RE = /\[( |x|X)\]/g;

export type MemoChecklistItem = {
  markerStart: number;
  label: string;
  done: boolean;
};

export function parseMemoChecklist(memo: string | undefined): MemoChecklistItem[] {
  if (!memo) return [];
  const items: MemoChecklistItem[] = [];
  const re = new RegExp(INLINE_CHECK_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(memo)) !== null) {
    const done = m[1].toLowerCase() === "x";
    const labelStart = m.index + m[0].length;
    // Label: from after marker until next marker or newline
    const remaining = memo.slice(labelStart);
    const nlIdx = remaining.indexOf("\n");
    const nextRel = remaining.search(/\[( |x|X)\]/);
    let labelEnd = remaining.length;
    if (nlIdx !== -1) labelEnd = Math.min(labelEnd, nlIdx);
    if (nextRel !== -1) labelEnd = Math.min(labelEnd, nextRel);
    const label = remaining.slice(0, labelEnd).trim();
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

