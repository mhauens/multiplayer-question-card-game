# Repository Review Checklist

Use this file as a quick repo-specific review summary. The canonical rules remain in `AGENTS.md` and `README.md`.

## Canonical Sources

- `AGENTS.md`
- `README.md`
- `.agents/skills/project-architecture/SKILL.md`
- `.agents/skills/game-rules-and-content/SKILL.md`

## How to Use This Checklist

- Prefer citing `AGENTS.md` for repo-wide rules that already exist there.
- Use this file for repo-specific review shortcuts and validation context.
- If this file and a canonical source disagree, follow the canonical source.

## General Review Anchors

- The repository is a `pnpm` workspace with a React/Vite client and an Express/Socket.IO server.
- The server is the source of truth for gameplay rules, permissions, and phase transitions.
- The client should mirror server state and should not invent gameplay rules locally.
- Keep user-facing UI copy in German unless the task explicitly requires another language.
- Client session recovery depends on `sessionStorage`; flag regressions that switch player sessions back to `localStorage` without a clear reason.

## Cross-Stack Review Notes

- If a gameplay permission or round-flow rule changes, verify all of these stay aligned:
  - `server/src/game/GameState.ts`
  - `server/src/socket/handlers.ts`
  - relevant client pages and components under `client/src/pages/` and `client/src/components/`
  - `client/src/components/RulesModal.tsx` when the player-facing explanation changes
- If reconnect, lobby sync, or socket payload handling changes, inspect:
  - `client/src/hooks/useSocket.ts`
  - `client/src/context/GameContext.tsx`
  - `server/src/socket/handlers.ts`
- If variants, extensions, or themes change, inspect:
  - `server/src/game/CardDeck.ts`
  - `server/data/base-questions.json`
  - `server/data/base-answers.json`
  - `server/data/variants/*`
  - `server/data/extensions/*`
  - `client/src/pages/Home.tsx`
  - `client/src/pages/Lobby.tsx`
  - `client/src/theme.ts`
  - relevant files in `client/src/styles/`

## TypeScript, React, And Socket Review Notes

- Prefer server-enforced permissions over UI-only gating.
- Watch for ACK-based socket flows that stop handling errors, duplicate emits, or desynchronize local state from server state.
- React StrictMode can cause mount and effect paths to run more than once during development; flag socket lifecycle code that is not idempotent.
- Theme selection is driven by variant IDs in `client/src/theme.ts`; a new variant may require both mapping and CSS coverage.

## Validation Commands

- `pnpm lint` validates the TypeScript sources and tests across client and server.
- `pnpm test` runs both Vitest suites.
- `pnpm lint`, `pnpm test`, and `pnpm build` are the minimum recommended validation after most code changes.
- `pnpm --filter client test` and `pnpm --filter server test` are useful when only one side changed.
- When reviewing changes that affect gameplay, sockets, lobby, reconnect, variants, extensions, or themes, call out manual validation in addition to automated commands.

## Manual Validation Context

- `pnpm dev` runs the local dev build.
- Gameplay, socket, lobby, reconnect, or card-flow changes should be smoke-tested with two browser sessions:
  1. create a lobby
  2. join from a second session
  3. start a game
  4. submit answers
  5. reveal answers
  6. pick a winner
  7. start the next round
- Variant, extension, or theme changes should also be checked on the host flow:
  1. switch between all relevant variants
  2. verify only compatible extensions are shown and toggleable
  3. verify lobby and game reflect the expected active variant, active extensions, and theme
