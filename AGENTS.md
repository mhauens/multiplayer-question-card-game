# AGENTS.md

This repository is a pnpm workspace for an online version of "Kampf gegen das Spiessertum".

Use this file as the project-wide default guidance for any coding agent or LLM. It is written to stay useful across different tools and model vendors.

## Start Here

- Read [README.md](README.md) first for setup, architecture, and current card-data counts.
- Client entry points: `client/src/App.tsx`, `client/src/context/GameContext.tsx`, `client/src/hooks/useSocket.ts`
- Server entry points: `server/src/index.ts`, `server/src/socket/handlers.ts`, `server/src/game/GameState.ts`
- Card content lives in `server/data/base-questions.json`, `server/data/base-answers.json`, `server/data/variants/*/questions.json`, `server/data/variants/*/answers.json`, `server/data/extensions/*/questions.json`, and `server/data/extensions/*/answers.json`

## Core Architecture

- `client/` contains the React frontend, routing, pages, UI components, and CSS.
- `server/` contains the Express/Socket.IO backend and the full gameplay state machine.
- The server is the source of truth for rules, permissions, and phase transitions.
- The client mirrors server state and should not invent gameplay rules on its own.

## Working Agreements

- Use `pnpm`, not `npm`, for installs and workspace commands.
- Keep user-facing UI copy in German unless a task explicitly asks for another language.
- Prefer focused changes over large refactors.
- If a gameplay permission or round-flow rule changes, update all of these together:
  - server rule logic in `server/src/game/GameState.ts`
  - server authorization in `server/src/socket/handlers.ts`
  - client affordances and messaging in `client/src/pages/` and `client/src/components/`
  - rules/help text shown in the UI when relevant
- Client session recovery currently depends on `sessionStorage`; do not switch it back to `localStorage` for player sessions without a clear reason.

## Build And Validation

- Install: `pnpm install`
- Run full dev stack: `pnpm dev`
- Build everything: `pnpm build`
- Start production server build: `pnpm start`

For most code changes, at minimum run:

- `pnpm build`

For gameplay, socket, lobby, reconnect, or card-flow changes, also do a manual smoke test with two browser sessions:

1. create a lobby
2. join from a second session
3. start a game
4. submit answers
5. reveal answers
6. pick a winner
7. start the next round

## Project Conventions

- Base card data is split across two files:
  - `server/data/base-questions.json`
  - `server/data/base-answers.json`
- Additional variants and extensions should each live in their own subfolder with `questions.json` and `answers.json`.
- Question entries use objects with `text` and `blanks`.
- Answer entries are plain strings.
- Optional expansions live under `server/data/extensions/` in their own subfolders and follow the same split JSON schema.
- The Vite dev server runs on `5173` and proxies `/socket.io` to the backend on `3001`.

## Skills

Project-specific skills are kept under this folder:

- `.agents/skills/`

Current skills:

- `project-architecture`
- `game-rules-and-content`

Use them when a tool supports skill loading and needs targeted repo context beyond this root guide.
