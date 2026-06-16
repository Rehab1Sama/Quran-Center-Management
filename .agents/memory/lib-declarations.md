---
name: Lib declarations build
description: api-client-react and api-zod must have their .d.ts files generated before TS type-checking works in the frontend
---

The `lib/api-client-react` and `lib/api-zod` packages use `composite: true` with `emitDeclarationOnly: true` in their `tsconfig.json`. After a fresh clone or dependency install, run `npx tsc -p tsconfig.json` inside each package to generate `dist/index.d.ts`. Without this, the frontend reports TS6305 errors on every import from those packages.

**Why:** The packages export raw `.ts` source files (no build script), but TypeScript project references require pre-compiled `.d.ts` declaration files to resolve types across workspace boundaries.

**How to apply:** Run once after `pnpm install` on a fresh environment, or whenever the `src/` of either lib changes. The esbuild pipeline (used for actual builds) doesn't need this — it transpiles `.ts` directly. Only `tsc --noEmit` type-checking is affected.
