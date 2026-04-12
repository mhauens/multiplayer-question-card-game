---
name: code-review
description: 'Review local code changes and provide actionable feedback. Use when: reviewing uncommitted changes, analyzing diffs, finding bugs, checking security, clean code issues, code simplification opportunities, readability, code quality, performance, accessibility, test risks, or maintainability in this repository.'
argument-hint: 'Optional focus area, for example: gameplay flow, socket sync, accessibility, or variants and extensions'
user-invocable: true
---

# Code Review

## 1. Scope

- Default scope: review the current staged and unstaged changes in the working tree.
- Only change the scope when the user explicitly asks for a different target, for example:
  - current branch vs `main`
  - a specific file or selection
  - a staged-only review
- This skill is for local development workflows, not PR comment threading or GitHub review submission.

## 2. Collect Evidence

- Start from the changed files, not from a broad repository scan.
- Prefer local git-aware tooling available in the environment.
- Use `git status --short` first so staged, unstaged, and untracked files are all in scope.
- Use workspace diff tooling such as `get_changed_files` when available and `git diff -U3` or equivalent with at least 3 lines of context to inspect the actual hunks for tracked files.
- For untracked files, read the files directly instead of relying on `git diff`, since they are outside the normal diff output.
- Read additional code only when the changed lines require nearby symbols, helpers, components, hooks, or server modules for correct evaluation.
- Keep the review source-bound to:
  - changed hunks
  - immediate surrounding code needed to understand behavior
  - directly referenced helpers, components, hooks, or server modules when the diff depends on them
- Do not turn the review into a general architecture audit.
- When the diff touches gameplay permissions, round flow, or winner selection, verify the change across the full rule path:
  - `server/src/game/GameState.ts`
  - `server/src/socket/handlers.ts`
  - relevant client pages or components under `client/src/pages/` and `client/src/components/`
  - `client/src/components/RulesModal.tsx` when player-facing rules changed
- When the diff touches reconnect, lobby sync, or socket payload handling, inspect the client/server handshake path:
  - `client/src/hooks/useSocket.ts`
  - `client/src/context/GameContext.tsx`
  - `server/src/socket/handlers.ts`
- When the diff touches variants, extensions, or themes, inspect the catalog path:
  - `server/src/game/CardDeck.ts`
  - `server/data/`
  - `client/src/pages/Home.tsx`
  - `client/src/pages/Lobby.tsx`
  - `client/src/theme.ts`
  - relevant files in `client/src/styles/`

## 3. Select Review Aspects

- Start from the aspects defined in [aspects.md](references/aspects.md), then keep only the ones with a credible evidence path in the current diff.
- Always include the `Clean Code & Simplification` aspect for non-trivial changed code, TSX structure, or styles, even when the user emphasizes other review goals.
- Skip aspects with no credible evidence path in the changed files.
- Typical relevance rules:
  - gameplay, lobby, or socket changes: Clean Code & Simplification, Gameplay & Sync Integrity, Bugs, Race Conditions, Security, Maintainability, Testing & Documentation
  - client UI changes: Clean Code & Simplification, Accessibility, Bugs, Maintainability, Code Quality, Performance, Testing & Documentation
  - variant, extension, theme, or card-data changes: Clean Code & Simplification, Content & Catalog Integrity, Bugs, Maintainability, Accessibility, Testing & Documentation
  - test-only changes: Clean Code & Simplification, Bugs, Test Flakiness, Maintainability
- If the user asks to emphasize a focus area, keep the other relevant aspects active but review the requested focus first.

## 4. Fan Out by Aspect

- If the user explicitly asks for delegation or parallel agent work and subagents are available, run one read-only, aspect-specific subanalysis per active review aspect.
- Otherwise, do clearly separated aspect passes in the current agent so findings do not collapse into one broad review too early.
- The `Clean Code & Simplification` pass is mandatory for non-trivial diffs that change logic, markup structure, selectors, naming, control flow, helper usage, or non-trivial styles, and should usually run before the broader maintainability pass.
- For this repository, prioritize `Gameplay & Sync Integrity` before generic maintainability whenever the diff can affect who may act, when phases advance, how reconnect works, or how lobby/game state is mirrored into the UI.
- Run `Content & Catalog Integrity` whenever the diff changes variant metadata, extension wiring, card JSON, host catalog UI, or theme selection.
- Each aspect pass should:
  - use the changed hunks as its primary evidence
  - inspect only the minimum nearby code needed to confirm a finding
  - return zero or more findings plus short supporting reasoning
  - explicitly say when no issue was found for that aspect

## 5. Merge and De-duplicate

- Merge the aspect results into one final review using [output-format.md](references/output-format.md).
- List each finding only once at the highest applicable severity.
- Keep behavior-preserving simplification ideas under suggestions unless the current structure hides a concrete defect, accessibility issue, or other higher-severity problem.
- Prefer concrete, actionable feedback over generic style commentary.
- If a finding depends on repo conventions, use [repo-checklist.md](references/repo-checklist.md) as a quick repo summary and cite the underlying canonical source when authority matters.
- Prefer findings about broken gameplay behavior, missing server-side enforcement, stale client affordances, variant/theme drift, or inadequate validation over purely cosmetic observations.
- Keep praise selective; do not pad the review when the diff is trivial.

## 6. Severity Rules

- Critical issues: must fix before merging or shipping; likely functional, security, accessibility, or data-integrity risk.
- Suggestions: worthwhile improvement, defect risk, maintainability problem, or missing validation that should be considered soon.
- Good practices: explicit strengths in the changed code that are visible in the diff.
- If nothing actionable is found, say so clearly and mention any residual validation gaps.

## 7. Validation and Commands

- When useful, recommend or run repo-native validation commands referenced in [repo-checklist.md](references/repo-checklist.md), especially `pnpm lint`, `pnpm test`, and `pnpm build`.
- Do not invent tests or CI steps that do not exist in the repository.
- If gameplay, socket, reconnect, lobby, or card-flow behavior changed, call out the two-browser manual smoke test from `AGENTS.md`.
- If variant, extension, or theme behavior changed, call out variant switching and extension compatibility checks on the host flow.
- If no relevant automated check exists for the changed files, say that explicitly.

## 8. Output Language

- Follow the language rules in [output-format.md](references/output-format.md).
- Keep file references and technical terms precise even when the prose language changes.
- Unless the user asks otherwise, prefer German because the repository documentation and most user-facing copy are German.

## 9. After the Review

- If the review contains actionable findings, explicitly offer to fix them directly after the RISK line.
- If the user agrees, address critical issues first and then suggestions.
- When fixing clean-code findings, keep the scope tightly limited to the touched code and preserve exact behavior.
- Prefer simplifications that reduce nesting, duplication, misleading names, brittle conditionals, redundant comments, or unnecessary abstraction.
- Do not rewrite unaffected modules or perform style-only churn in the name of simplification.
- Keep the fix pass minimal and focused on the reviewed findings, then rerun the relevant validation.

## 10. Example Prompts

- `Review my current changes with this skill.`
- `Review my uncommitted changes and focus on accessibility first.`
- `Review my current changes with extra focus on clean code and simplification.`
- `Review only the staged diff in English.`
- `Review this branch against main and focus on security and bugs.`
- `Review my current changes and then fix the findings.`

## References

- Review aspects: [references/aspects.md](references/aspects.md)
- Output format: [references/output-format.md](references/output-format.md)
- Repo checklist: [references/repo-checklist.md](references/repo-checklist.md)
