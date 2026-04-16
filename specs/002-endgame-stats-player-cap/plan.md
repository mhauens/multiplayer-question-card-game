# Implementation Plan: Erweiterte End-of-Game-Stats + Spielerlimit auf 10

**Branch**: `002-endgame-stats-player-cap` | **Date**: 2026-04-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-endgame-stats-player-cap/spec.md`

## Summary

Add server-owned match statistics that are accumulated during play and exposed only at GAME_OVER, while increasing the shared lobby/player cap to 10 and updating the derived full-variant minimums to 80 answers and 91 questions. The implementation keeps the existing round recap, does not add time-based metrics, and does not introduce new deck-size blocking for smaller sets.

## Technical Context

**Language/Version**: TypeScript 6, Node.js 22+, React 19  
**Primary Dependencies**: Express 5, Socket.IO 4, Vite 8, React Router 7, Vitest 3, `@kgs/game-rules`  
**Storage**: In-memory game state on the server; no new persistent storage  
**Testing**: ESLint, Vitest, workspace build scripts, manual two-browser gameplay smoke test  
**Target Platform**: Browser client plus Node.js server in a pnpm workspace  
**Project Type**: Web application with client/server/shared package split  
**Performance Goals**: Endgame stats computed incrementally with no extra round-trip or endscreen delay visible to players  
**Constraints**: Server remains authoritative; shared rule limits live in `packages/game-rules`; smaller card sets remain startable; existing round recap stays intact  
**Scale/Scope**: One gameplay feature spanning client, server, shared rules, tests, and user-facing copy

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Server authority preserved: the server remains the source of truth for game state, match stats, phase flow, winner selection, and rematch/reset behavior.
- Cross-stack impact mapped: update `server/src/game/GameState.ts`, `server/src/game/GameManager.ts`, `server/src/socket/handlers.ts`, `server/src/types.ts`, `client/src/types.ts`, `client/src/pages/Game.tsx`, `client/src/components/GameOver.tsx`, `client/src/pages/Lobby.tsx`, `client/src/components/RulesModal.tsx`, `client/src/context/GameContext.tsx`, README, and the shared rules skill/documentation.
- Shared contract respected: move the player cap and derived minimum-card formulas to `packages/game-rules/src/index.ts` so client, server, tests, and docs use the same constants.
- Content model preserved: no new card content, no new variant/extension structure, and no new hard validation for smaller sets below the full-variant thresholds.
- Validation planned: include `pnpm lint`, `pnpm test`, and `pnpm build`, plus a manual two-browser smoke test and a lobby-cap test for the 10th and 11th join attempts.

## Project Structure

### Documentation (this feature)

```text
specs/002-endgame-stats-player-cap/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
client/
├── src/
│   ├── components/
│   │   └── GameOver.tsx
│   ├── context/
│   │   └── GameContext.tsx
│   ├── pages/
│   │   ├── Game.tsx
│   │   └── Lobby.tsx
│   ├── styles/
│   └── types.ts
packages/
└── game-rules/
    └── src/
        └── index.ts
server/
├── src/
│   ├── game/
│   │   ├── GameManager.ts
│   │   └── GameState.ts
│   ├── socket/
│   │   └── handlers.ts
│   └── types.ts
└── test/
    ├── GameRulesSkill.test.ts
    ├── GameState.test.ts
    └── SocketHandlers.test.ts
```

**Structure Decision**: Keep the feature inside the existing client/server/shared-package layout. Shared rule changes belong in `packages/game-rules`, runtime statistics belong in `server/src/game/GameState.ts` and the server-facing types, and the client only renders the new endscreen state and updated limits.

## Implementation Order

1. Update shared rule constants and derived full-variant formulas in `packages/game-rules`.
2. Extend server and client types with the new endgame stats payload, then track and reset match stats in `GameState` and `GameManager`.
3. Update socket/game-state broadcasts and client rendering for the endscreen, lobby, and rules copy.
4. Refresh tests, README, and the skill documentation so the new player cap and formula numbers are consistently documented.

## Complexity Tracking

No constitution violations require special justification.
