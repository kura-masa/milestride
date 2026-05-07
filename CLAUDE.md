@AGENTS.md

# Milestride – Codebase Guide for AI Assistants

## What this app is

Milestride is a mobile-first roadmap/milestone tracker. Users sign in with Google, create groups of nodes, connect nodes as a DAG (directed acyclic graph), and track progress via memos and checklists. The UI is Japanese-localized and optimized for iPhone.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| UI | React 19, Tailwind CSS v4, Framer Motion 12 |
| Rich text | Tiptap 3 with a custom `inlineCheck` node extension |
| Graph view | ReactFlow 11 (UnifiedField component) |
| Backend/DB | Firebase Firestore (real-time, NoSQL) |
| Auth | Firebase Authentication (Google Sign-In only) |
| Deployment | Firebase App Hosting (`apphosting.yaml`) |
| E2E tests | Playwright 1.59 (iPhone 13/WebKit profile) |
| Linting | ESLint 9 (flat config, Next.js rules) |
| Types | TypeScript 5, strict mode |

---

## Directory layout

```
src/
  app/
    page.tsx        # Entire app UI (App, FocusView, OverviewView, etc.)
    layout.tsx      # Root layout – wraps everything in AuthProvider
    globals.css     # Tailwind v4 base + tiptap editor CSS
  components/
    ActionMenu.tsx      # Bottom sheet action menu (edit / delete group)
    AuthGate.tsx        # Google sign-in screen shown when logged out
    ConfirmDialog.tsx   # Generic yes/no dialog
    MemoEditor.tsx      # Tiptap editor – memo ↔ plain-text serialization
    NodeEditor.tsx      # Bottom sheet form for creating / editing nodes
    NodeSheet.tsx       # Detail view sheet for a node
    RenameDialog.tsx    # Text input dialog for renaming
    UnifiedField.tsx    # ReactFlow canvas (unified overview mode)
  lib/
    auth.tsx        # AuthProvider context + useAuth() hook
    firebase.ts     # Firebase app init (singleton)
    store.ts        # Data hooks + pure business-logic functions
    useLongPress.ts # Touch/mouse long-press hook
e2e/                # Playwright tests (currently empty)
```

---

## Data model (Firestore)

```
users/{uid}/
  nodes/{nodeId}
    title       string
    status      "todo" | "in_progress" | "done"
    detail      string
    groupId     string | null
    parents     string[]          ← IDs of prerequisite nodes (DAG edges)
    order       number            ← used for sorting
    position    {x, y} | null    ← ReactFlow canvas position
    checklist   ChecklistItem[]
    memo        string            ← plain text with [x]…[/] markers
    createdAt   Timestamp
    updatedAt   Timestamp

  groups/{groupId}
    title       string
    color       string?
    order       number
    createdAt   Timestamp
    updatedAt   Timestamp
```

Security rules: each user can only read/write under `users/{their own uid}`.

---

## Key conventions

### Path alias

`@/` maps to `src/`. Always use `@/lib/...` and `@/components/...` — never relative paths from `src/`.

### All UI components are client components

Every file in `src/components/` and `src/app/page.tsx` starts with `"use client"`. There are no server components below the root layout.

### Memo format (plain text)

The canonical storage format for memos is a plain-text string with custom checkbox markers:

- Inline form: `[ ]label text[/]` or `[x]label text[/]`
- Line form (legacy): `[ ] label text` or `[x] label text`

`parseMemoChecklist()`, `toggleMemoChecklistAt()`, and `deriveStatusFromMemo()` in `store.ts` are the authoritative parsers. `MemoEditor.tsx` converts this format to/from Tiptap's JSON document model — do not duplicate that logic.

### Status is always derived, never set directly by the user

A node's `status` field is computed from its checklist or memo state:
- All items done → `"done"`
- Some done → `"in_progress"`
- None done (or no items) → `"todo"`

`deriveStatusFromMemo()` and `toggleChecklist()` enforce this invariant. Do not allow UI to set `status` directly.

### Node locking (`isLocked`)

A node is locked (greyed out, 🔒 shown) when its status is `"todo"` AND at least one parent node is not `"done"`. See `isLocked()` in `store.ts`.

### Topological sort

`topoSort()` in `page.tsx` orders nodes for the FocusView graph. It handles cycles by appending remaining nodes rather than throwing.

### Firestore operations

- All mutations go through `useMutations()` in `store.ts`. Do not call Firestore directly from components.
- `deleteGroup` handles two modes: delete contained nodes, or orphan them (unset `groupId`).
- `removeFromAllParents` must be called before `deleteNode` to clean up DAG edges.

---

## Development workflow

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint
npx playwright test   # Run E2E tests (starts dev server automatically)
```

### Required environment variables

Create a `.env.local` file (gitignored) with your Firebase project credentials:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

There is no `.env.example` — refer to `SETUP.md` (Japanese) or `apphosting.yaml` for the full variable list.

### Seeding

On first login with an empty account, `page.tsx` automatically seeds three sample nodes in a "はじめてのロードマップ" group. The seed flag is stored in `localStorage` keyed by `milestride_seeded_{uid}`.

---

## Testing setup

**Playwright** is configured in `playwright.config.ts`:
- Test directory: `./e2e/` (currently empty — no tests written yet)
- Device: iPhone 13 / WebKit (mobile-first)
- Base URL: `http://localhost:3000`
- Dev server is auto-started when running tests

**No unit test framework** (Jest/Vitest) is installed. The pure functions in `store.ts` and `MemoEditor.tsx` are the highest-priority candidates for unit tests.

---

## Things to watch out for

1. **Next.js 16.2.4 has breaking changes** – read `node_modules/next/dist/docs/` before using any Next.js API. Do not assume behavior from older versions.
2. **No Prettier config** – formatting is ESLint-only. Do not introduce a `prettier` dependency without discussion.
3. **Firebase credentials in `apphosting.yaml`** – production credentials are committed. Do not add new secrets here; prefer environment variables.
4. **Mobile-first, WebKit-only tests** – all UI decisions should consider iPhone Safari/WebKit behavior.
5. **`deleteNode` does not call `removeFromAllParents`** – callers must do both. See `handleDelete` in `page.tsx`.
