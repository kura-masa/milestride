"use client";
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
} from "react";

type TextBlock = { id: string; kind: "text"; text: string };
type CheckBlock = { id: string; kind: "check"; text: string; done: boolean };
type Block = TextBlock | CheckBlock;

const CHECK_RE = /^(\s*)- \[( |x|X)\] (.*)$/;
let __memoIdCounter = 0;
const newId = () =>
  `b${Date.now().toString(36)}_${(__memoIdCounter++).toString(36)}`;

function parse(memo: string): Block[] {
  if (!memo) return [{ id: newId(), kind: "text", text: "" }];
  const lines = memo.split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flushBuf = () => {
    if (buf.length > 0) {
      blocks.push({ id: newId(), kind: "text", text: buf.join("\n") });
      buf = [];
    }
  };
  for (const line of lines) {
    const m = CHECK_RE.exec(line);
    if (m) {
      flushBuf();
      blocks.push({
        id: newId(),
        kind: "check",
        text: m[3],
        done: m[2].toLowerCase() === "x",
      });
    } else {
      buf.push(line);
    }
  }
  flushBuf();
  if (blocks.length === 0) blocks.push({ id: newId(), kind: "text", text: "" });
  return blocks;
}

function compose(blocks: Block[]): string {
  return blocks
    .map((b) =>
      b.kind === "text" ? b.text : `- [${b.done ? "x" : " "}] ${b.text}`
    )
    .join("\n");
}

export type MemoEditorHandle = {
  addItem: () => void;
};

export const MemoEditor = forwardRef<
  MemoEditorHandle,
  {
    initialValue: string;
    resetKey: string | number;
    onChange: (memo: string) => void;
    placeholder?: string;
  }
>(function MemoEditor({ initialValue, resetKey, onChange, placeholder }, ref) {
  const [blocks, setBlocks] = useState<Block[]>(() => parse(initialValue));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const textRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const checkRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Reset on resetKey change
  useEffect(() => {
    setBlocks(parse(initialValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Notify parent on any change
  useEffect(() => {
    onChangeRef.current(compose(blocks));
  }, [blocks]);

  // Auto-resize text areas after each render
  useLayoutEffect(() => {
    textRefs.current.forEach((ta) => {
      if (ta) {
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
      }
    });
  }, [blocks]);

  const updateBlock = (id: string, patch: Partial<Block>) =>
    setBlocks((arr) =>
      arr.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b))
    );

  const removeBlock = (id: string) =>
    setBlocks((arr) => {
      const next = arr.filter((b) => b.id !== id);
      if (next.length === 0)
        return [{ id: newId(), kind: "text", text: "" }];
      return next;
    });

  const addCheckAtFocus = () => {
    const newCheckId = newId();
    let focusTarget: string = newCheckId;
    setBlocks((arr) => {
      const idx = focusedId
        ? arr.findIndex((b) => b.id === focusedId)
        : arr.length - 1;
      if (idx === -1) {
        return [...arr, { id: newCheckId, kind: "check", text: "", done: false }];
      }
      const target = arr[idx];
      if (target.kind === "text") {
        const ta = textRefs.current.get(target.id);
        const pos = ta?.selectionStart ?? target.text.length;
        const before = target.text.slice(0, pos);
        const after = target.text.slice(pos);
        const next: Block[] = [];
        for (let i = 0; i < arr.length; i++) {
          if (i === idx) {
            next.push({ ...target, text: before });
            next.push({
              id: newCheckId,
              kind: "check",
              text: "",
              done: false,
            });
            if (after.length > 0)
              next.push({ id: newId(), kind: "text", text: after });
          } else {
            next.push(arr[i]);
          }
        }
        return next;
      } else {
        const next: Block[] = [...arr];
        next.splice(idx + 1, 0, {
          id: newCheckId,
          kind: "check",
          text: "",
          done: false,
        });
        // Ensure a trailing text block so user can keep writing after the check
        if (idx + 2 >= next.length || next[idx + 2].kind !== "text") {
          next.splice(idx + 2, 0, { id: newId(), kind: "text", text: "" });
        }
        return next;
      }
    });
    setTimeout(() => {
      checkRefs.current.get(focusTarget)?.focus();
    }, 0);
  };

  useImperativeHandle(ref, () => ({ addItem: addCheckAtFocus }));

  return (
    <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 focus-within:ring-sky-400 px-3 py-2.5 space-y-1 transition">
      {blocks.length === 1 &&
        blocks[0].kind === "text" &&
        blocks[0].text === "" && (
          <div className="absolute pointer-events-none text-sm text-gray-400 select-none">
            {placeholder ?? "メモ・チェックリスト"}
          </div>
        )}
      {blocks.map((b) => {
        if (b.kind === "text") {
          return (
            <textarea
              key={b.id}
              ref={(el) => {
                if (el) textRefs.current.set(b.id, el);
                else textRefs.current.delete(b.id);
              }}
              rows={1}
              value={b.text}
              onChange={(e) => updateBlock(b.id, { text: e.target.value })}
              onFocus={() => setFocusedId(b.id)}
              className="w-full bg-transparent border-0 outline-none resize-none text-sm leading-relaxed py-0.5 placeholder:text-gray-400"
              placeholder={blocks.length === 1 ? placeholder : ""}
            />
          );
        }
        return (
          <div key={b.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateBlock(b.id, { done: !b.done })}
              className={`flex-none w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] transition ${
                b.done
                  ? "bg-emerald-400 border-emerald-400 text-white"
                  : "border-gray-300"
              }`}
            >
              {b.done && "✓"}
            </button>
            <input
              ref={(el) => {
                if (el) checkRefs.current.set(b.id, el);
                else checkRefs.current.delete(b.id);
              }}
              value={b.text}
              onChange={(e) => updateBlock(b.id, { text: e.target.value })}
              onFocus={() => setFocusedId(b.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCheckAtFocus();
                } else if (
                  e.key === "Backspace" &&
                  b.text === "" &&
                  e.currentTarget.selectionStart === 0
                ) {
                  e.preventDefault();
                  removeBlock(b.id);
                }
              }}
              className={`flex-1 bg-transparent border-0 outline-none text-sm py-0.5 ${
                b.done ? "line-through text-gray-400" : ""
              }`}
              placeholder="項目"
            />
            <button
              type="button"
              onClick={() => removeBlock(b.id)}
              className="flex-none w-7 h-7 rounded-full text-gray-400 active:bg-gray-100"
              aria-label="項目を削除"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
});
