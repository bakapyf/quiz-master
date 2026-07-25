# Quiz Master — AGENTS.md

**Single-package React 18 + TypeScript 5.6 + Vite 6 PWA** (Chinese, zh-CN). Offline-first quiz practice with IndexedDB, GitHub Gist sync, and import from MD/JSON/CSV/XLSX.

## Commands

| Action | Command | Notes |
|---|---|---|
| Dev server | `npm run dev` | `http://localhost:5173`, host `0.0.0.0` |
| Build & typecheck | `npm run build` | Runs `tsc -b && vite build` — **both** steps |
| Preview build | `npm run preview` | Serves `dist/` |
| Scripts | `node scripts/<name>.mjs` | All scripts are ESM (`.mjs`) |

- **No tests, no linter, no formatter.** The only verification is `npm run build`.
- `tsconfig.json` has `noEmit: true`, `noUnusedLocals: false`, `noUnusedParameters: false`.

## Architecture

- **Entry:** `index.html` → `src/main.tsx` → `src/App.tsx` (uses `HashRouter` — URLs like `/#/banks/1/quiz`).
- **Pages:** `src/pages/` — Dashboard, Banks, BankDetail, Quiz, Exam, Browse, WrongAnswers, Favorites, Settings.
- **Data layer:** Dexie.js (IndexedDB) in `src/lib/db.ts` — 5 tables: `questionBanks`, `questions`, `quizRecords`, `examSessions`, `favorites`.
- **Question parsing:** `src/lib/parsers/` — `parseFile()` dispatches by extension to MD/JSON/CSV/XLSX parsers.
- **Sync:** `src/lib/sync.ts` — GitHub Gist (OAuth token) or local folder (File System Access API).
- **No external state management.** React state + IndexedDB + `localStorage("theme")` for dark mode. Cross-tab sync via `quiz-data-changed` custom events.
- **Types:** `src/types/index.ts` — all shared interfaces.

## Quirks

- Imports use `.ts` file extensions (`allowImportingTsExtensions: true`).
- Dark mode uses `class` strategy on `<html>`.
- PWA service worker auto-registers (`vite-plugin-pwa`), caches external URLs with `NetworkFirst`.
- `.md` files at repo root are question bank content (Chinese power-grid quiz banks), not documentation.
- `sharp` is dev-only (icon generation script), not part of build.
- Deploy targets: Vercel and Netlify (both configured).

## Verification workflow

```bash
npm run build   # typecheck + bundle — must pass before any submission
```

No other CI/gate exists.
