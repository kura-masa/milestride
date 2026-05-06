"use client";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useState,
} from "react";

const INLINE_RE = /\[( |x|X)\]/g;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function checkboxStyle(done: boolean) {
  const bg = done ? "#34d399" : "transparent";
  const border = done ? "#34d399" : "#d1d5db";
  const color = done ? "#fff" : "transparent";
  return (
    "display:inline-flex;align-items:center;justify-content:center;" +
    "width:1.15em;height:1.15em;border:2px solid " +
    border +
    ";border-radius:9999px;font-size:0.7em;line-height:1;" +
    "vertical-align:-3px;margin:0 3px;background:" +
    bg +
    ";color:" +
    color +
    ";user-select:none;padding:0;cursor:pointer;font-weight:bold;"
  );
}

function checkboxHtml(done: boolean) {
  return (
    `<span data-checkbox="" data-done="${done}" contenteditable="false" ` +
    `style="${checkboxStyle(done)}">${done ? "✓" : ""}</span>`
  );
}

function applyCheckboxStyle(el: HTMLElement, done: boolean) {
  el.setAttribute("style", checkboxStyle(done));
  el.textContent = done ? "✓" : "";
}

function memoToHtml(memo: string): string {
  if (!memo) return "";
  return memo
    .split("\n")
    .map((line) => {
      let html = "";
      let last = 0;
      const re = new RegExp(INLINE_RE.source, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        html += escapeHtml(line.slice(last, m.index));
        html += checkboxHtml(m[1].toLowerCase() === "x");
        last = m.index + m[0].length;
      }
      html += escapeHtml(line.slice(last));
      return html === "" ? "<br>" : html;
    })
    .join("<br>");
}

function serialize(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      out += "\n";
      return;
    }
    if (el.hasAttribute("data-checkbox")) {
      out += `[${el.getAttribute("data-done") === "true" ? "x" : " "}]`;
      return;
    }
    const isBlock = el.tagName === "DIV" || el.tagName === "P";
    if (isBlock && out.length > 0 && !out.endsWith("\n")) out += "\n";
    for (const child of Array.from(el.childNodes)) walk(child);
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return out.replace(/\n+$/, "");
}

export type MemoEditorHandle = { addItem: () => void };

export const MemoEditor = forwardRef<
  MemoEditorHandle,
  {
    initialValue: string;
    resetKey: string | number;
    onChange: (memo: string) => void;
    placeholder?: string;
  }
>(function MemoEditor({ initialValue, resetKey, onChange, placeholder }, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [isEmpty, setIsEmpty] = useState(!initialValue);

  const notifyChange = () => {
    if (!editorRef.current) return;
    const memo = serialize(editorRef.current);
    setIsEmpty(memo === "");
    onChangeRef.current(memo);
  };

  // Reset content on resetKey change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = memoToHtml(initialValue);
      setIsEmpty(!initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Toggle checkbox on click (event delegation)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(
        "[data-checkbox]"
      ) as HTMLElement | null;
      if (!target || !editor.contains(target)) return;
      e.preventDefault();
      e.stopPropagation();
      const done = target.getAttribute("data-done") === "true";
      const next = !done;
      target.setAttribute("data-done", String(next));
      applyCheckboxStyle(target, next);
      notifyChange();
    };
    editor.addEventListener("click", handler);
    return () => editor.removeEventListener("click", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertCheckbox = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    let range: Range;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();
    const tmp = document.createElement("div");
    tmp.innerHTML = checkboxHtml(false);
    const node = tmp.firstChild as HTMLElement;
    range.insertNode(node);
    // Trailing space so caret has somewhere to sit
    const space = document.createTextNode(" ");
    node.parentNode?.insertBefore(space, node.nextSibling);
    const newRange = document.createRange();
    newRange.setStartAfter(space);
    newRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(newRange);
    notifyChange();
  };

  useImperativeHandle(ref, () => ({ addItem: insertCheckbox }));

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={notifyChange}
        className="min-h-[88px] w-full px-3 py-2.5 rounded-xl bg-gray-50 ring-1 ring-gray-200 focus:ring-sky-400 outline-none text-sm leading-relaxed whitespace-pre-wrap"
      />
      {isEmpty && (
        <div className="absolute top-2.5 left-3 text-sm text-gray-400 pointer-events-none">
          {placeholder ?? "メモ・チェックリスト"}
        </div>
      )}
    </div>
  );
});
