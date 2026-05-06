"use client";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useState,
} from "react";

const CHECK_LINE_RE = /^[ \t]*(?:- )?\[( |x|X)\][ \t]?(.*)$/;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const CHIP_STYLE =
  "display:flex;align-items:center;gap:8px;background:#ecfdf5;" +
  "border:1px solid #a7f3d0;border-radius:10px;padding:6px 10px;" +
  "margin:4px 0;";

const CHIP_DONE_STYLE =
  "display:flex;align-items:center;gap:8px;background:#f0fdf4;" +
  "border:1px solid #bbf7d0;border-radius:10px;padding:6px 10px;" +
  "margin:4px 0;opacity:0.7;";

function checkboxStyle(done: boolean) {
  const bg = done ? "#10b981" : "#fff";
  const border = done ? "#10b981" : "#cbd5e1";
  const color = done ? "#fff" : "transparent";
  return (
    "flex:none;display:inline-flex;align-items:center;justify-content:center;" +
    "width:18px;height:18px;border:2px solid " +
    border +
    ";border-radius:9999px;font-size:11px;line-height:1;" +
    "background:" +
    bg +
    ";color:" +
    color +
    ";user-select:none;padding:0;cursor:pointer;font-weight:bold;"
  );
}

function checkItemHtml(done: boolean, label: string): string {
  const labelStyle = done
    ? "flex:1;outline:none;text-decoration:line-through;color:#6b7280;"
    : "flex:1;outline:none;color:#065f46;font-weight:500;";
  return (
    `<div data-check-item="" style="${done ? CHIP_DONE_STYLE : CHIP_STYLE}">` +
    `<span data-checkbox="" data-done="${done}" contenteditable="false" style="${checkboxStyle(
      done
    )}">${done ? "✓" : ""}</span>` +
    `<span data-check-label="" style="${labelStyle}">${
      escapeHtml(label) || "&#8203;"
    }</span>` +
    `</div>`
  );
}

function applyChipStyle(wrapper: HTMLElement, done: boolean) {
  wrapper.setAttribute("style", done ? CHIP_DONE_STYLE : CHIP_STYLE);
  const cb = wrapper.querySelector("[data-checkbox]") as HTMLElement | null;
  const lbl = wrapper.querySelector("[data-check-label]") as HTMLElement | null;
  if (cb) {
    cb.setAttribute("style", checkboxStyle(done));
    cb.setAttribute("data-done", String(done));
    cb.textContent = done ? "✓" : "";
  }
  if (lbl) {
    lbl.setAttribute(
      "style",
      done
        ? "flex:1;outline:none;text-decoration:line-through;color:#6b7280;"
        : "flex:1;outline:none;color:#065f46;font-weight:500;"
    );
  }
}

function memoToHtml(memo: string): string {
  if (!memo) return "<div><br></div>";
  return memo
    .split("\n")
    .map((line) => {
      const m = CHECK_LINE_RE.exec(line);
      if (m) return checkItemHtml(m[1].toLowerCase() === "x", m[2]);
      return `<div>${line === "" ? "<br>" : escapeHtml(line)}</div>`;
    })
    .join("");
}

function serialize(root: HTMLElement): string {
  const lines: string[] = [];
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (el.hasAttribute("data-check-item")) {
        const cb = el.querySelector("[data-checkbox]") as HTMLElement | null;
        const lbl = el.querySelector("[data-check-label]") as HTMLElement | null;
        const done = cb?.getAttribute("data-done") === "true";
        const labelText = (lbl?.textContent ?? "").replace(/​/g, "");
        lines.push(`[${done ? "x" : " "}] ${labelText}`);
      } else if (el.tagName === "BR") {
        lines.push("");
      } else {
        // DIV / P / SPAN-as-block (rare). Use textContent, treat as one line
        const t = (el.textContent ?? "").replace(/​/g, "");
        lines.push(t);
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      const t = (child.textContent ?? "").replace(/​/g, "");
      // Loose text at top level — split by newline if any
      for (const part of t.split("\n")) lines.push(part);
    }
  }
  // Trim trailing empties
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
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

  // Reset content when resetKey changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = memoToHtml(initialValue);
      setIsEmpty(!initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Click delegation: toggle checkboxes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const handler = (e: MouseEvent) => {
      const cb = (e.target as HTMLElement).closest(
        "[data-checkbox]"
      ) as HTMLElement | null;
      if (!cb || !editor.contains(cb)) return;
      e.preventDefault();
      e.stopPropagation();
      const wrapper = cb.closest("[data-check-item]") as HTMLElement | null;
      if (!wrapper) return;
      const done = cb.getAttribute("data-done") === "true";
      applyChipStyle(wrapper, !done);
      notifyChange();
    };
    editor.addEventListener("click", handler);
    return () => editor.removeEventListener("click", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: Enter inside check item escapes to new prose div below
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const handler = (e: KeyboardEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const wrapper = (range.startContainer.parentElement || null)?.closest(
        "[data-check-item]"
      ) as HTMLElement | null;
      if (!wrapper) return;
      if (e.key === "Enter") {
        e.preventDefault();
        const newDiv = document.createElement("div");
        newDiv.innerHTML = "<br>";
        wrapper.parentNode?.insertBefore(newDiv, wrapper.nextSibling);
        const r = document.createRange();
        r.setStart(newDiv, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        notifyChange();
      } else if (e.key === "Backspace") {
        const lbl = wrapper.querySelector(
          "[data-check-label]"
        ) as HTMLElement | null;
        if (
          lbl &&
          (lbl.textContent ?? "").replace(/​/g, "") === "" &&
          range.startOffset === 0
        ) {
          e.preventDefault();
          const next =
            wrapper.previousElementSibling || wrapper.nextElementSibling;
          wrapper.remove();
          if (next) {
            const r = document.createRange();
            r.selectNodeContents(next);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
          }
          notifyChange();
        }
      }
    };
    editor.addEventListener("keydown", handler);
    return () => editor.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Insert a new check item at the caret position. Splits the surrounding
  // prose block if needed so the chip lands exactly between the text before
  // and after the cursor.
  const insertCheckItem = () => {
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
    // Find the enclosing top-level child (DIV) of the editor, if any
    let topNode: Node | null = range.startContainer;
    while (topNode && topNode.parentNode !== editor) {
      topNode = topNode.parentNode;
    }

    const tmp = document.createElement("div");
    tmp.innerHTML = checkItemHtml(false, "");
    const chip = tmp.firstChild as HTMLElement;

    if (topNode && (topNode as HTMLElement).tagName === "DIV") {
      const block = topNode as HTMLElement;
      // Split text node at caret within this div
      // Build "before" and "after" content using Range
      const beforeRange = document.createRange();
      beforeRange.setStartBefore(block.firstChild ?? block);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      const beforeFrag = beforeRange.cloneContents();

      const afterRange = document.createRange();
      afterRange.setStart(range.startContainer, range.startOffset);
      afterRange.setEndAfter(block.lastChild ?? block);
      const afterFrag = afterRange.cloneContents();

      const beforeDiv = document.createElement("div");
      beforeDiv.appendChild(beforeFrag);
      if (!beforeDiv.textContent) beforeDiv.innerHTML = "<br>";

      const afterDiv = document.createElement("div");
      afterDiv.appendChild(afterFrag);
      if (!afterDiv.textContent) afterDiv.innerHTML = "<br>";

      block.replaceWith(beforeDiv, chip, afterDiv);
    } else {
      // Fallback: insert at caret
      range.deleteContents();
      range.insertNode(chip);
    }

    // Move caret into the chip's label
    const label = chip.querySelector(
      "[data-check-label]"
    ) as HTMLElement | null;
    if (label) {
      // Clear zero-width placeholder so caret sits at start
      label.textContent = "";
      const r = document.createRange();
      r.setStart(label, 0);
      r.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
    notifyChange();
  };

  useImperativeHandle(ref, () => ({ addItem: insertCheckItem }));

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={notifyChange}
        className="min-h-[88px] w-full px-3 py-2.5 rounded-xl bg-gray-50 ring-1 ring-gray-200 focus:ring-sky-400 outline-none text-sm leading-relaxed"
      />
      {isEmpty && (
        <div className="absolute top-2.5 left-3 text-sm text-gray-400 pointer-events-none">
          {placeholder ?? "メモ・チェックリスト"}
        </div>
      )}
    </div>
  );
});
