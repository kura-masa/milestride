"use client";
import { useRef, useState, useEffect } from "react";
import { MemoEditor, MemoEditorHandle } from "@/components/MemoEditor";

export default function TestMemoPage() {
  const editorRef = useRef<MemoEditorHandle>(null);
  const [memo, setMemo] = useState("");
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const editor = document.querySelector(".tiptap") as HTMLElement | null;
    if (!editor) return;
    const log = (kind: string, detail: string) =>
      setEvents((prev) => [`${kind} ${detail}`, ...prev].slice(0, 30));

    const onKeyDown = (e: KeyboardEvent) => {
      log("keydown", `key=${e.key} code=${e.code} composing=${e.isComposing}`);
    };
    const onBeforeInput = (e: Event) => {
      const ev = e as InputEvent;
      log("beforeinput", `type=${ev.inputType} data=${JSON.stringify(ev.data)}`);
    };
    const onInput = (e: Event) => {
      const ev = e as InputEvent;
      log("input", `type=${ev.inputType}`);
    };
    editor.addEventListener("keydown", onKeyDown, true);
    editor.addEventListener("beforeinput", onBeforeInput, true);
    editor.addEventListener("input", onInput, true);
    return () => {
      editor.removeEventListener("keydown", onKeyDown, true);
      editor.removeEventListener("beforeinput", onBeforeInput, true);
      editor.removeEventListener("input", onInput, true);
    };
  }, []);

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto bg-white">
      <h1 className="text-base font-bold mb-3">MemoEditor 検証</h1>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          data-testid="add-item"
          onPointerDown={(e) => {
            e.preventDefault();
            editorRef.current?.addItem();
          }}
          onClick={(e) => e.preventDefault()}
          className="px-3 py-1 rounded-full text-xs font-semibold text-sky-600 ring-1 ring-sky-200 active:bg-sky-50"
        >
          ＋ 項目を追加
        </button>
        <button
          type="button"
          onClick={() => setEvents([])}
          className="px-3 py-1 rounded-full text-xs text-gray-600 ring-1 ring-gray-200"
        >
          ログ消去
        </button>
      </div>
      <div data-testid="editor-wrapper">
        <MemoEditor
          ref={editorRef}
          initialValue=""
          resetKey="test"
          onChange={setMemo}
          placeholder="ここにメモ"
        />
      </div>
      <div className="mt-3">
        <div className="text-[10px] font-bold text-gray-500">memo:</div>
        <pre
          data-testid="serialized"
          className="p-2 rounded bg-gray-100 text-[11px] whitespace-pre-wrap break-all"
        >
          {JSON.stringify(memo)}
        </pre>
      </div>
      <div className="mt-3">
        <div className="text-[10px] font-bold text-gray-500">events:</div>
        <div className="p-2 rounded bg-gray-50 text-[10px] font-mono leading-tight max-h-[260px] overflow-y-auto ring-1 ring-gray-200">
          {events.length === 0 ? (
            <div className="text-gray-400">(まだイベントなし)</div>
          ) : (
            events.map((e, i) => <div key={i}>{e}</div>)
          )}
        </div>
      </div>
    </main>
  );
}
