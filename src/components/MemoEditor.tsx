"use client";
import { useEffect, useImperativeHandle, forwardRef } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
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
  return (
    <NodeViewWrapper
      as="span"
      className={`inline-check ${checked ? "is-checked" : ""}`}
      data-checked={checked}
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

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { $from } = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "inlineCheck") {
            const after = $from.after(d);
            return this.editor
              .chain()
              .focus()
              .setTextSelection(after)
              .run();
          }
        }
        return false;
      },
      ArrowRight: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "inlineCheck") {
            const end = $from.end(d);
            // Account for trailing ZWS placeholder so a single press escapes
            const node = $from.node(d);
            const trailingZws = node.textContent.endsWith("​") ? 1 : 0;
            if ($from.pos >= end - trailingZws) {
              const after = $from.after(d);
              return this.editor
                .chain()
                .focus()
                .setTextSelection(after)
                .run();
            }
            break;
          }
        }
        return false;
      },
      ArrowLeft: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "inlineCheck") {
            const start = $from.start(d);
            if ($from.pos === start) {
              const before = $from.before(d);
              return this.editor
                .chain()
                .focus()
                .setTextSelection(before)
                .run();
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
          "tiptap min-h-[88px] w-full px-3 py-2.5 rounded-xl bg-gray-50 ring-1 ring-gray-200 focus:ring-sky-400 outline-none text-sm leading-relaxed",
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
        // Insert with a zero-width space inside so mobile WebKit has an
        // actual text node to anchor the caret on — empty inline nodes are
        // unreliable for caret placement.
        const node = state.schema.nodes.inlineCheck.create(
          { checked: false },
          state.schema.text("​")
        );
        const pos = state.selection.from;
        const tr = state.tr.insert(pos, node);
        // pos+1 = inside, before the ZWS. Typing inserts here.
        tr.setSelection(TextSelection.create(tr.doc, pos + 1));
        view.dispatch(tr);
        view.focus();
      },
    }),
    [editor]
  );

  return <EditorContent editor={editor} />;
});
