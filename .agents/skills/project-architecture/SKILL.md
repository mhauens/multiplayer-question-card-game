---
name: project-architecture
description: 'Understand the kampf-gegen-das-spiesertum architecture, client/server boundaries, socket event flow, variant catalog and theme flow, state ownership, and where to make changes. Use for onboarding, codebase navigation, feature placement, or debugging cross-stack behavior.'
argument-hint: 'Optional focus area, for example: lobby sync, game flow, socket events, or frontend structure'
user-invocable: true
---

# Project Architecture

## When To Use

- You are new to the repository and need a fast mental model.
- You need to know where a feature belongs before editing.
- A bug spans frontend, backend, and websocket synchronization.
- You need to trace how state moves from server game logic into the UI.

## Architecture Map

### Frontend

- `client/src/App.tsx`: top-level routing
- `client/src/context/GameContext.tsx`: shared client-side game state, variant catalog loading, and active-theme syncing
- `client/src/hooks/useSocket.ts`: Socket.IO connection, reconnect, ACK-based emits
- `client/src/pages/Home.tsx`: host flow with variant and extension selection
- `client/src/pages/Lobby.tsx`: lobby state including active variant and enabled extensions
- `client/src/pages/Game.tsx`: gameplay screen using the active server state
- `client/src/components/`: reusable UI like cards, scoreboard, rules modal, submissions
- `client/src/styles/`: global layout, card styling, and game layout
- `client/src/theme.ts`: maps variant IDs to client themes; unknown variants fall back to `base`

### Backend

- `server/src/index.ts`: Express bootstrap, CORS, HTTP server, Socket.IO server
- `server/src/socket/handlers.ts`: all socket events, permissions, and broadcast wiring
- `server/src/game/GameManager.ts`: manages multiple active games
- `server/src/game/GameState.ts`: the gameplay state machine and phase transitions; exposes `activeVariant` and `activeExtensions` to clients
- `server/src/game/CardDeck.ts`: builds the base set, loads variant and extension catalogs, maps extensions to variants, and creates filtered decks
- `server/src/types.ts`: gameplay, payload, and client-state types

## Source Of Truth

- The backend owns gameplay rules.
- The frontend reflects server state and should only expose actions the server allows.
- Variant themes are a frontend presentation concern and are derived from the active variant, not from local gameplay logic.
- If a feature changes phases, permissions, or boss behavior, inspect `GameState.ts` and `handlers.ts` first.

## Typical Request Routing

### UI-only changes

- Start in `client/src/pages/`, `client/src/components/`, and `client/src/styles/`.
- If the UI change is variant-specific, also inspect `client/src/theme.ts`.

### Rule changes

- Start in `server/src/game/GameState.ts`.
- Then align authorization and error messages in `server/src/socket/handlers.ts`.
- Finally align affordances and explanatory UI in the client.

### Sync or reconnect bugs

- Check `client/src/hooks/useSocket.ts`.
- Check `client/src/context/GameContext.tsx`.
- Check broadcasts and ACK responses in `server/src/socket/handlers.ts`.

### Variant, extension, or theme work

- Variant and extension data loading starts in `server/src/game/CardDeck.ts`.
- Host-facing catalog data is fetched via `get-variants` in `GameContext.tsx`.
- Active variant and extensions are visible in `Lobby.tsx` and used to set the current theme via `theme.ts`.
- Theme styling lives in `client/src/styles/global.css`, `client/src/styles/game.css`, and `client/src/styles/cards.css`.

## Catalog Flow

1. `CardDeck.ts` synthesizes the `base` variant from the base question and answer JSON files.
2. Additional variants are loaded from `server/data/variants/*.json`.
3. Extensions are loaded from `server/data/extensions/*.json` and attached to one or more variants via the optional `variants` field.
4. `get-variants` returns a variant catalog where each variant already includes its compatible extensions.
5. `create-game` validates the selected variant and filters extensions so only variant-compatible entries remain.
6. `GameState.getClientState()` exposes `activeVariant` and `activeExtensions` back to the client.
7. `GameContext.tsx` applies the matching client theme based on `activeVariant`.

## Validation

1. Run `pnpm build`.
2. If the change affects live gameplay, run `pnpm dev`.
3. Use two browser sessions to verify lobby join, start, submit, reveal, pick-winner, and next-round flow.
4. For variant or theme changes, also verify variant switching on the host screen and that lobby/game pick up the expected theme.