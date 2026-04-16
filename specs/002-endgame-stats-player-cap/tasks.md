# Tasks: Erweiterte End-of-Game-Stats + Spielerlimit auf 10

**Input**: Design documents from `/specs/002-endgame-stats-player-cap/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests and Validation**: Include automated tests for the shared cap, lobby limit, endgame stats, and reset behavior. Finish with `pnpm lint`, `pnpm test`, `pnpm build`, and a manual two-browser gameplay smoke test.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared rule constants that all later work relies on

- [X] T001 [P] Update `packages/game-rules/src/index.ts` to raise `MAX_PLAYERS` to 10 and keep the full-variant helper functions derived from the shared constants

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Endgame stat data model and server bookkeeping needed before the GAME_OVER UI can be built

- [X] T002 [P] Add `ClientEndGameStats`, `ClientPlayerEndGameStats`, and `ClientEndGameHighlight` to `server/src/types.ts`, including `ClientGameState.endGameStats`
- [X] T003 [P] Mirror the new `ClientEndGameStats`, `ClientPlayerEndGameStats`, and `ClientEndGameHighlight` shapes in `client/src/types.ts`
- [X] T004 Add match-stat bookkeeping and endgame summary helpers to `server/src/game/GameState.ts` for boss rounds, submissions, swaps, streaks, and GAME_OVER-only summary assembly

**Checkpoint**: Shared payload shape and server state plumbing are ready for story-specific work.

---

## Phase 3: User Story 1 - Groessere Runden zulassen (Priority: P1) 🎯 MVP

**Goal**: Let up to 10 players join a lobby and show the updated cap in lobby and rules copy.

**Independent Test**: A lobby accepts the 10th player, rejects the 11th, and the lobby and rules screens both show the new 10-player cap.

### Tests for User Story 1

- [X] T005 [P] [US1] Update `server/test/GameRulesSkill.test.ts` to expect `MAX_PLAYERS = 10` and the recalculated 80-answer and 91-question full-variant minimums
- [X] T006 [P] [US1] Add join-limit coverage to `server/test/GameManager.test.ts` for the 10th player joining successfully and the 11th being rejected
- [X] T007 [P] [US1] Add lobby-cap rendering coverage in `client/src/pages/Lobby.test.tsx` for the 10-player display and player-count copy
- [X] T008 [P] [US1] Add rules-copy coverage in `client/src/components/RulesModal.test.tsx` for the updated 10-player lobby text

### Implementation for User Story 1

- [X] T009 [P] [US1] Update `client/src/pages/Lobby.tsx` so the player counter and related messaging use the shared 10-player cap
- [X] T010 [P] [US1] Update `client/src/components/RulesModal.tsx` to render the new lobby limit text from the shared rule constants

**Checkpoint**: The lobby cap and visible rules copy are independently testable.

---

## Phase 4: User Story 2 - Match-Verlauf am Ende verstehen (Priority: P2)

**Goal**: Show a structured GAME_OVER summary with highlights and per-player endgame statistics alongside the existing round recap.

**Independent Test**: Reaching GAME_OVER shows the winner banner, round recap, summary cards, highlight ties, and the per-player stats table, while zero-value highlights stay hidden.

### Tests for User Story 2

- [X] T011 [P] [US2] Add endgame-stat coverage in `server/test/GameState.endgame-stats.test.ts` for boss rounds, submissions, swaps, streaks, GAME_OVER-only visibility, ties, and zero-value highlights
- [X] T012 [P] [US2] Add endscreen rendering coverage in `client/src/components/GameOver.test.tsx` for summary cards, tied leaders, and the per-player stats table

### Implementation for User Story 2

- [X] T013 [US2] Update `server/src/game/GameState.ts` so `endGameStats` is assembled from the tracked match stats and exposed only at GAME_OVER while keeping `roundRecap` separate
- [X] T014 [P] [US2] Update `client/src/pages/Game.tsx` and `client/src/components/GameOver.tsx` to render `endGameStats` without removing the existing round recap and winner banner
- [X] T015 [P] [US2] Extend `client/src/styles/cards.css` with layout and styling for the highlight cards and per-player endgame statistics table

**Checkpoint**: The GAME_OVER summary works on its own and still preserves the historical round recap.

---

## Phase 5: User Story 3 - Match-Statistiken korrekt zuruecksetzen (Priority: P3)

**Goal**: Reset all match stats cleanly on rematch and for newly created games.

**Independent Test**: After a rematch or a fresh game, all match counters start at zero again and no previous-game values leak into the new match.

### Tests for User Story 3

- [X] T016 [P] [US3] Add reset coverage in `server/test/GameState.reset-stats.test.ts` for rematch and fresh-game stat resets
- [X] T017 [P] [US3] Add rematch broadcast coverage in `server/test/SocketHandlers.rematch.test.ts` to confirm the reset snapshot reaches connected clients

### Implementation for User Story 3

- [X] T018 [US3] Reset all match-stat counters in `server/src/game/GameState.ts` during `rematch()` and ensure a new `GameState` instance starts with zeroed counters

**Checkpoint**: Match statistics are now scoped to a single match and restart correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and final smoke testing

- [X] T019 [P] Update `README.md` with the 10-player cap, the 80/91 full-variant minimums, and the note that smaller sets remain startable
- [X] T020 [P] Update `.agents/skills/game-rules-and-content/SKILL.md` so the shared player cap and recalculated minimums are documented for future feature work
- [X] T021 Run `pnpm lint` from the repository root
- [X] T022 Run `pnpm test` from the repository root
- [X] T023 Run `pnpm build` from the repository root
- [ ] T024 Run a manual two-browser smoke test for lobby join limits, GAME_OVER summary rendering, highlight ties, and rematch reset behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks the endgame stats work
- **User Story 1 (Phase 3)**: Can start after Setup and does not depend on the endgame stats UI
- **User Story 2 (Phase 4)**: Depends on Setup + Foundational completion
- **User Story 3 (Phase 5)**: Depends on Setup + Foundational completion and on the stats model being available
- **Polish (Phase 6)**: Depends on the desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent lobby-cap increment and rules copy update
- **User Story 2 (P2)**: Needs the endgame stat payload and server bookkeeping from the foundational phase
- **User Story 3 (P3)**: Needs the endgame stat payload and server bookkeeping so rematch reset behavior can be verified

### Within Each User Story

- Tests should be added before implementation when they are the clearest proof of behavior
- Shared rule updates must land before client text or endscreen rendering that depends on them
- Server state changes must be in place before the client consumes new fields
- Keep `roundRecap` intact while adding the new endgame summary

### Parallel Opportunities

- `T002` and `T003` can run in parallel because they touch different type files
- `T005` through `T008` can run in parallel because they are separate test files
- `T009` and `T010` can run in parallel because they update different client UI files
- `T011` and `T012` can run in parallel because they add tests in different files
- `T014` and `T015` can run in parallel after `T013` because they touch different client files
- `T016` and `T017` can run in parallel because they add reset coverage in different server test files
- `T019` and `T020` can run in parallel because they update different documentation files

---

## Parallel Example: User Story 1

```bash
Task: "Update `server/test/GameManager.test.ts` for the 10th player join and 11th rejection"
Task: "Add lobby-cap rendering coverage in `client/src/pages/Lobby.test.tsx`"
Task: "Add rules-copy coverage in `client/src/components/RulesModal.test.tsx`"
Task: "Update `client/src/pages/Lobby.tsx` for the 10-player cap"
Task: "Update `client/src/components/RulesModal.tsx` for the shared lobby text"
```

---

## Parallel Example: User Story 2

```bash
Task: "Add endgame-stat coverage in `server/test/GameState.endgame-stats.test.ts`"
Task: "Add endscreen rendering coverage in `client/src/components/GameOver.test.tsx`"
Task: "Update `client/src/pages/Game.tsx` and `client/src/components/GameOver.tsx` to render `endGameStats`"
Task: "Extend `client/src/styles/game.css` for the endgame summary layout"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1
3. Validate the lobby cap and shared formula updates
4. Stop if you only need the player-limit change shipped first

### Incremental Delivery

1. Setup shared rules
2. Ship the 10-player cap and updated rules copy
3. Add GAME_OVER endgame stats and UI
4. Add rematch reset behavior for the stats
5. Finish with docs and full validation

### Parallel Team Strategy

With multiple developers:

1. One developer handles the shared cap update and lobby UI
2. Another developer implements the endgame summary and tests
3. A third developer hardens the rematch reset and writes the validation coverage
4. Finish with documentation and repository-wide checks
