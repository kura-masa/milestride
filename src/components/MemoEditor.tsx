"use client";
import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { flushSync } from "react-dom";

type Item = { id: string; label: string; done: boolean };

const CHECK_RE = /^(\s*)- \[( |x|X)\] (.*)$/;
let __memoIdCounter = 0;
const newId = () => `m${Date.now().toString(36)}_${(__memoIdCounter++).toString(36)}`;

function parse(memo: string): { prose: string; items: Item[] } {
  const lines = memo.split("\n");
  const proseLines: string[] = [];
  const items: Item[] = [];
  for (const line of lines) {
    const m = CHECK_RE.exec(line);
    if (m)
      items.push({
        id: newId(),
        label: m[3],
        done: m[2].toLowerCase() === "x",
      });
    else proseLines.push(line);
  }
  while (proseLines.length > 0 && proseLines[proseLines.length - 1].trim() === "")
    proseLines.pop();
  return { prose: proseLines.join("\n"), items };
}

function compose(prose: string, items: Item[]): string {
  const itemLines = items
    .map((i) => `- [${i.done ? "x" : " "}] ${i.label}`)
    .join("\n");
  if (!prose && !itemLines) return "";
  if (!prose) return itemLines;
  if (!itemLines) return prose;
  return prose + "\n\n" + itemLines;
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
  const [prose, setProse] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const itemInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialize / reset on resetKey change
  useEffect(() => {
    const parsed = parse(initialValue);
    setProse(parsed.prose);
    setItems(parsed.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Notify parent on any change
  useEffect(() => {
    onChangeRef.current(compose(prose, items));
  }, [prose, items]);

  const addItem = () => {
    const id = newId();
    flushSync(() => {
      setItems((arr) => [...arr, { id, label: "", done: false }]);
    });
    itemInputRefs.current.get(id)?.focus();
  };

  useImperativeHandle(ref, () => ({ addItem }));

  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) =>
    setItems((arr) => arr.filter((i) => i.id !== id));

  return (
    <div className="space-y-2.5">
      <textarea
        className="w-full px-3 py-2.5 rounded-xl bg-gray-50 ring-1 ring-gray-200 focus:ring-sky-400 outline-none text-sm min-h-[88px] resize-y leading-relaxed"
        value={prose}
        onChange={(e) => setProse(e.target.value)}
        placeholder={placeholder ?? "メモを書く"}
      />
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateItem(it.id, { done: !it.done })}
                className={`flex-none w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] transition ${
                  it.done
                    ? "bg-emerald-400 border-emerald-400 text-white"
                    : "border-gray-300"
                }`}
              >
                {it.done && "✓"}
              </button>
              <input
                ref={(el) => {
                  if (el) itemInputRefs.current.set(it.id, el);
                  else itemInputRefs.current.delete(it.id);
                }}
                className={`flex-1 px-2.5 py-1.5 rounded-lg bg-gray-50 ring-1 ring-gray-200 focus:ring-sky-400 outline-none text-sm ${
                  it.done ? "line-through text-gray-400" : ""
                }`}
                value={it.label}
                onChange={(e) => updateItem(it.id, { label: e.target.value })}
                placeholder="項目"
              />
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="flex-none w-7 h-7 rounded-full text-gray-400 active:bg-gray-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
