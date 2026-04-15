<!--
Sync Impact Report
- Version change: uninitialized template -> 1.0.0
- Modified principles:
	- Principle slot 1 -> I. Server-Authoritative Gameplay
	- Principle slot 2 -> II. Cross-Stack Rule Synchronization
	- Principle slot 3 -> III. Shared Rules As Contract
	- Principle slot 4 -> IV. Modular Card Catalog
	- Principle slot 5 -> V. Validation Before Merge
- Added sections:
	- Additional Constraints
	- Delivery Workflow
- Removed sections:
	- None
- Templates requiring updates:
	- ✅ .specify/templates/plan-template.md
	- ✅ .specify/templates/spec-template.md
	- ✅ .specify/templates/tasks-template.md
	- ✅ .specify/templates/commands/*.md (no files present; no updates required)
- Follow-up TODOs:
	- Review .specify/extensions/git/scripts/powershell/initialize-repo.ps1 for the broken pre-hook parse error.
-->

# Multiplayer Question Card Game Constitution

## Core Principles

### I. Server-Authoritative Gameplay
The server MUST remain the sole source of truth for gameplay state, permissions,
phase transitions, boss rotation, reconnect handling, and winner selection. The
client MUST mirror server state and MUST NOT invent or enforce gameplay rules on
its own beyond presentation affordances. Rationale: this project is a real-time
multiplayer game; rule drift between browser clients would create inconsistent
round outcomes and exploitable behavior.

### II. Cross-Stack Rule Synchronization
Any change to gameplay rules, phase flow, player permissions, reconnect behavior,
or boss behavior MUST be implemented consistently across all affected layers:
server rule logic, socket authorization and messaging, client affordances, and
user-facing rules/help copy when relevant. Rationale: partial updates create
desynchronization where the UI offers actions the backend rejects, or the backend
changes behavior without explaining it to players.

### III. Shared Rules As Contract
Shared gameplay constants and rule boundaries MUST live in
`packages/game-rules` when they are consumed by more than one package. Client,
server, tests, and supporting docs MUST reference that shared contract instead of
duplicating limits such as minimum players, hand size, reconnect windows, or
round timers. Rationale: centralizing rule boundaries prevents silent divergence
between runtime behavior, tests, and documentation.

### IV. Modular Card Catalog
Base cards, variants, and extensions MUST remain modular and data-driven.
Base content stays split into `server/data/base-questions.json` and
`server/data/base-answers.json`; every variant or extension MUST live in its own
subfolder with `questions.json` and `answers.json`, and variant compatibility
MUST be validated by the server. Client theming MAY vary by active variant, but
theme selection MUST derive from server-provided variant state rather than local
guesswork. Rationale: isolated content modules keep catalog growth maintainable
and prevent invalid variant-extension combinations from leaking into gameplay.

### V. Validation Before Merge
Every change that affects shipped code MUST pass `pnpm lint`, `pnpm test`, and
`pnpm build` before merge unless the user explicitly limits execution and that
limitation is recorded. Gameplay, socket, lobby, reconnect, or card-flow changes
MUST also complete a manual smoke test with two browser sessions covering lobby
creation, joining, game start, answer submission, reveal, winner selection, and
next round. Rationale: this codebase depends on cross-package and real-time
behavior that unit changes alone do not fully validate.

## Additional Constraints

This repository is a pnpm workspace. Workspace commands MUST use `pnpm`, not
`npm`. User-facing UI copy SHOULD remain in German unless a task explicitly
requires another language. Active leave behavior MUST remove a player
immediately, while unexpected disconnects MUST preserve the reconnect grace
window before removal. Feature work SHOULD stay focused and preserve the current
client/server/shared-package split unless there is a documented reason to change
the architecture.

## Delivery Workflow

Specifications, plans, and task lists MUST identify which layers are affected by
the proposed change. If gameplay rules or permissions change, the plan MUST call
out updates for `server/src/game/GameState.ts`, `server/src/socket/handlers.ts`,
relevant client pages or components, and any rules/help text that explains the
behavior. Implementation tasks MUST include the validation work required by
Principle V, and plans MUST fail the Constitution Check until those tasks and
affected layers are accounted for.

## Governance

This constitution supersedes ad hoc local practice for this repository. AGENTS,
README guidance, and Spec Kit templates MUST stay consistent with it. Amendments
MUST update this file and any dependent templates or runtime guidance in the same
change when those artifacts encode constitutional rules. Versioning follows
semantic versioning: MAJOR for removing or materially redefining a principle,
MINOR for adding a principle or materially expanding governance, and PATCH for
clarifications or wording-only refinements. Every plan, task list, and review
MUST verify compliance with the five core principles before implementation is
considered complete.

**Version**: 1.0.0 | **Ratified**: 2026-04-15 | **Last Amended**: 2026-04-15
