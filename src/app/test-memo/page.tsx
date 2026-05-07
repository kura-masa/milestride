"use client";
import { useRef, useState } from "react";
import { MemoEditor, MemoEditorHandle } from "@/components/MemoEditor";

export default function TestMemoPage() {
  const editorRef = useRef<MemoEditorHandle>(null);
  const [memo, setMemo] = useState("");

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto bg-white">
      <h1 className="text-lg font-bold mb-4">MemoEditor 隔離検証</h1>
      <div className="mb-3 flex gap-2">
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
      <pre
        data-testid="serialized"
        className="mt-4 p-3 rounded bg-gray-100 text-xs whitespace-pre-wrap break-all"
      >
        {JSON.stringify(memo)}
      </pre>
    </main>
  );
}
