"use client";
import { useEffect, useImperativeHandle, forwardRef } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection, Plugin } from "@tiptap/pm/state";
import {
  useEditor,
  EditorContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const INLINE_CHECK_RE = /\[( |x|X)\](.*?)\[\/\]/g;
const OLD_LINE_CHECK_RE = /^[ \t]*(?:- )?\[( |x|X)\][ \t]?(.*)$/;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// React NodeView for the inline check chip
function InlineCheckView({ node, updateAttributes }: NodeViewProps) {
  const checked = Boolean(node.attrs.checked);
  const text = node.textContent.replace(/​/g, "");
  const isEmpty = text === "";
  return (
    <NodeViewWrapper
      as="span"
      className={`inline-check ${checked ? "is-checked" : ""} ${
        isEmpty ? "is-empty" : ""
      }`}
      data-checked={checked}
      data-empty={isEmpty}
    >
      <span
        contentEditable={false}
        className="inline-check-box"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          updateAttributes({ checked: !checked });
        }}
      >
        {checked ? "✓" : ""}
      </span>
      {/* `as="span"` is valid at runtime but Tiptap's React types narrow it to "div" */}
      {/* @ts-expect-error tiptap NodeViewContent `as` typing is too strict */}
      <NodeViewContent as="span" className="inline-check-label" />
    </NodeViewWrapper>
  );
}

const InlineCheck = Node.create({
  name: "inlineCheck",
  group: "inline",
  inline: true,
  content: "text*",
  selectable: false,

  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute("data-checked") === "true",
        renderHTML: (attrs) => ({
          "data-checked": attrs.checked ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-inline-check]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({ "data-inline-check": "" }, HTMLAttributes),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineCheckView);
  },

  addProseMirrorPlugins() {
    const ext = this;
    return [
      // Maintain the invariant that every inlineCheck contains either:
      //   (a) a single ZWS placeholder (visually empty, but the browser can
      //       anchor the caret inside), OR
      //   (b) only real user-typed characters (no ZWS).
      // This means: as soon as the user types something, the ZWS is dropped;
      // as soon as the chip becomes truly empty, a ZWS is re-inserted so the
      // caret stays inside instead of escaping to the surrounding paragraph.
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((t) => t.docChanged)) return null;
          let tr = newState.tr;
          let modified = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "inlineCheck") return;
            const text = node.textContent;

            if (text === "") {
              // Empty chip — re-insert ZWS so caret has a valid anchor
              const insertAt = tr.mapping.map(pos + 1);
              tr = tr.insert(insertAt, newState.schema.text("​"));
              modified = true;
              return;
            }

            if (text.length > 1 && text.includes("​")) {
              // Has ZWS plus real content — strip ZWS char(s)
              for (let i = 0; i < text.length; i++) {
                if (text[i] === "​") {
                  const charPos = pos + 1 + i;
                  tr = tr.delete(
                    tr.mapping.map(charPos),
                    tr.mapping.map(charPos + 1)
                  );
                  modified = true;
                }
              }
            }
          });
          return modified ? tr : null;
        },
      }),
      // Android Chrome dispatches Enter inside an IME composition as a
      // beforeinput "insertParagraph" event (not keydown). Intercept those
      // to escape the inline check instead of replacing its content.
      new Plugin({
        props: {
          handleDOMEvents: {
            beforeinput: (view, e: Event) => {
              const ev = e as InputEvent;
              const { $from, empty } = view.state.selection;
              if (!empty) return false;

              // Find enclosing inlineCheck
              let chipDepth = -1;
              for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type.name === "inlineCheck") {
                  chipDepth = d;
                  break;
                }
              }

              // ── Enter inside chip → escape + split (Android IME) ──
              if (
                ev.inputType === "insertParagraph" ||
                ev.inputType === "insertLineBreak"
              ) {
                if (chipDepth === -1) return false;
                ev.preventDefault();
                const after = $from.after(chipDepth);
                ext.editor
                  .chain()
                  .setTextSelection(after)
                  .splitBlock()
                  .focus()
                  .run();
                return true;
              }

              // ── Backspace progressive removal ──
              if (ev.inputType === "deleteContentBackward") {
                if (chipDepth !== -1) {
                  const node = $from.node(chipDepth);
                  const start = $from.start(chipDepth);
                  const text = node.textContent;
                  const effectivelyEmpty = text === "" || text === "​";

                  // Effectively empty chip + caret anywhere inside → delete
                  // the chip itself (this is the "second backspace" case).
                  if (effectivelyEmpty) {
                    ev.preventDefault();
                    const before = $from.before(chipDepth);
                    const after = $from.after(chipDepth);
                    const tr = view.state.tr.delete(before, after);
                    tr.setSelection(TextSelection.create(tr.doc, before));
                    view.dispatch(tr);
                    return true;
                  }

                  // Chip has real content + caret has chars to its left →
                  // delete one char and KEEP caret inside (the appendTrans
                  // will re-insert a ZWS if this empties the chip).
                  if ($from.pos > start) {
                    ev.preventDefault();
                    const tr = view.state.tr.delete(
                      $from.pos - 1,
                      $from.pos
                    );
                    view.dispatch(tr);
                    return true;
                  }
                  return false;
                }
                // Caret directly after an effectively-empty chip → delete it
                const nodeBefore = $from.nodeBefore;
                if (
                  nodeBefore &&
                  nodeBefore.type.name === "inlineCheck" &&
                  (nodeBefore.textContent === "" ||
                    nodeBefore.textContent === "​")
                ) {
                  ev.preventDefault();
                  const before = $from.pos - nodeBefore.nodeSize;
                  const tr = view.state.tr.delete(before, $from.pos);
                  tr.setSelection(TextSelection.create(tr.doc, before));
                  view.dispatch(tr);
                  return true;
                }
              }

              return false;
            },
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Note: Enter is handled exclusively via the beforeinput plugin
      // (insertParagraph / insertLineBreak) so that desktop, iOS and
      // Android all flow through one handler. A keydown handler here
      // would cause a double dispatch on platforms that fire both.
      //
      // Backspace: handled here (keydown) for desktop/iOS so that returning
      // true calls preventDefault on keydown, which suppresses the subsequent
      // beforeinput event and prevents double-delete. Android soft-keyboard
      // never fires a "Backspace" keydown, so the beforeinput plugin covers it.
      Backspace: () => {
        const { state, view } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;

        let chipDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "inlineCheck") {
            chipDepth = d;
            break;
          }
        }

        if (chipDepth !== -1) {
          const node = $from.node(chipDepth);
          const start = $from.start(chipDepth);
          const text = node.textContent;
          const effectivelyEmpty = text === "" || text === "​";

          if (effectivelyEmpty) {
            const before = $from.before(chipDepth);
            const after = $from.after(chipDepth);
            const tr = state.tr.delete(before, after);
            tr.setSelection(TextSelection.create(tr.doc, before));
            view.dispatch(tr);
            return true;
          }

          if ($from.pos > start) {
            const tr = state.tr.delete($from.pos - 1, $from.pos);
            view.dispatch(tr);
            return true;
          }
          return false;
        }

        const nodeBefore = $from.nodeBefore;
        if (
          nodeBefore &&
          nodeBefore.type.name === "inlineCheck" &&
          (nodeBefore.textContent === "" || nodeBefore.textContent === "​")
        ) {
          const before = $from.pos - nodeBefore.nodeSize;
          const tr = state.tr.delete(before, $from.pos);
          tr.setSelection(TextSelection.create(tr.doc, before));
          view.dispatch(tr);
          return true;
        }

        return false;
      },
      ArrowRight: () => {
        const { state, view } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "inlineCheck") {
            const end = $from.end(d);
            const node = $from.node(d);
            const trailingZws = node.textContent.endsWith("​") ? 1 : 0;
            if ($from.pos >= end - trailingZws) {
              const after = $from.after(d);
              const tr = state.tr.setSelection(
                TextSelection.create(state.doc, after)
              );
              view.dispatch(tr);
              view.focus();
              return true;
            }
            break;
          }
        }
        return false;
      },
      // Note: Backspace is handled exclusively via the beforeinput plugin
      // (deleteContentBackward) so that keymap + beforeinput don't both
      // fire and cause double deletes (e.g. 1-char chip → empty chip → gone
      // in a single key press).
      ArrowLeft: () => {
        const { state, view } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "inlineCheck") {
            const start = $from.start(d);
            if ($from.pos === start) {
              const before = $from.before(d);
              const tr = state.tr.setSelection(
                TextSelection.create(state.doc, before)
              );
              view.dispatch(tr);
              view.focus();
              return true;
            }
            break;
          }
        }
        return false;
      },
    };
  },
});

function inlineCheckHtml(checked: boolean, label: string) {
  return (
    `<span data-inline-check data-checked="${checked}">` +
    escapeHtml(label) +
    `</span>`
  );
}

function lineToInnerHtml(line: string): string {
  // First pass: replace `[ ]label[/]` markers with inline check spans
  let html = "";
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(INLINE_CHECK_RE.source, "g");
  let foundInline = false;
  while ((m = re.exec(line)) !== null) {
    foundInline = true;
    html += escapeHtml(line.slice(last, m.index));
    html += inlineCheckHtml(m[1].toLowerCase() === "x", m[2]);
    last = m.index + m[0].length;
  }
  if (foundInline) {
    html += escapeHtml(line.slice(last));
    return html;
  }
  // Old whole-line form: `[ ] foo` → one inline check
  const om = OLD_LINE_CHECK_RE.exec(line);
  if (om) {
    return inlineCheckHtml(om[1].toLowerCase() === "x", om[2]);
  }
  // Plain text line
  return escapeHtml(line);
}

function memoToHtml(memo: string): string {
  if (!memo) return "<p></p>";
  return memo
    .split("\n")
    .map((line) => {
      const inner = lineToInnerHtml(line);
      return `<p>${inner === "" ? "<br>" : inner}</p>`;
    })
    .join("");
}

type JSONNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
};

function nodeText(node: JSONNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return (node.text ?? "").replace(/​/g, "");
  if (node.content) return node.content.map(nodeText).join("");
  return "";
}

function paragraphToString(node: JSONNode): string {
  if (!node.content) return "";
  let out = "";
  for (const c of node.content) {
    if (c.type === "text") out += (c.text ?? "").replace(/​/g, "");
    else if (c.type === "inlineCheck") {
      const checked = Boolean(c.attrs?.checked);
      const label = nodeText(c);
      out += `[${checked ? "x" : " "}]${label}[/]`;
    } else {
      out += nodeText(c);
    }
  }
  return out;
}

function jsonToMemo(doc: JSONNode | null): string {
  if (!doc || !doc.content) return "";
  const lines: string[] = [];
  for (const node of doc.content) {
    if (node.type === "paragraph") {
      lines.push(paragraphToString(node));
    } else {
      lines.push(nodeText(node));
    }
  }
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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      InlineCheck,
    ],
    content: memoToHtml(initialValue),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-[88px] w-full px-3 py-2.5 rounded-xl bg-[var(--bg-panel-soft)] ring-1 ring-[var(--ring-soft)] focus:ring-sky-400 outline-none text-sm leading-relaxed text-[var(--text-primary)]",
        "data-placeholder": placeholder ?? "メモ・チェックリスト",
      },
    },
    onUpdate: ({ editor }) => {
      const memo = jsonToMemo(editor.getJSON() as unknown as JSONNode);
      onChange(memo);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(memoToHtml(initialValue), { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, editor]);

  useImperativeHandle(
    ref,
    () => ({
      addItem: () => {
        if (!editor) return;
        const { state, view } = editor;
        // If the caret is inside an existing inline check, place the new chip
        // immediately AFTER it (don't split the existing chip).
        const $from = state.selection.$from;
        let pos = state.selection.from;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "inlineCheck") {
            pos = $from.after(d);
            break;
          }
        }
        // Insert with a zero-width space inside so mobile WebKit has an
        // actual text node to anchor the caret on — empty inline nodes are
        // unreliable for caret placement.
        const node = state.schema.nodes.inlineCheck.create(
          { checked: false },
          state.schema.text("​")
        );
        const tr = state.tr.insert(pos, node);
        // pos+1 = inside the new chip, before the ZWS. Typing inserts here.
        tr.setSelection(TextSelection.create(tr.doc, pos + 1));
        view.dispatch(tr);
        view.focus();
      },
    }),
    [editor]
  );

  return <EditorContent editor={editor} />;
});
