# whyme-apps

WHY ME website (Next.js) and mobile app (Expo) with shared TypeScript packages.
Architecture: `../docs/01-architecture.md`.

| Path | What |
|---|---|
| `apps/web` | Next.js public site + signed-in dashboards (deploys to Vercel) |
| `apps/mobile` | Expo app for Android and iOS (EAS builds) |
| `packages/sync` | Offline outbox engine shared by web (IndexedDB) and mobile (SQLite) |
| `packages/i18n` | English / Igbo catalogs |
| `packages/api-client` | Typed API client generated from `whyme-api/api.json` |
| `packages/schemas` | Form validation (phone, OTP, password) |
| `packages/tokens` | Brand tokens → Tailwind theme (web) and RN styles (mobile) |

## Commands

```bash
pnpm install          # once
pnpm dev:web          # http://localhost:3000
pnpm dev:mobile       # Expo dev server
pnpm test             # unit tests in every package
pnpm typecheck
pnpm i18n:check       # how many Igbo strings are still missing (--strict fails on any)
pnpm api:generate     # after API changes: regenerate packages/api-client
pnpm tokens:build     # after changing packages/tokens/src/index.ts
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/mobile/.env.example` to `apps/mobile/.env`.

## Rules

- Every user-facing string goes through `@whyme/i18n` (see its README).
- Writes that must work offline go through `@whyme/sync`, never straight `fetch`.
- In `apps/mobile`, add Expo packages with `npx expo install <pkg>` so versions match the SDK.
