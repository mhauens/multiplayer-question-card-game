# Review Aspects

Use this reference to decide which aspect-specific review passes should run for the current diff.

## General Rules

- Only report issues that are credibly supported by the changed hunks plus the minimum surrounding code needed for confirmation.
- Skip an aspect when the changed files do not provide a realistic evidence path for that kind of issue.
- Do not duplicate the same finding across multiple aspects. Keep it under the most specific aspect or the highest applicable severity.

## Gameplay & Sync Integrity

- Look for: client behavior that can drift from server rules, missing server-side permission checks, broken phase transitions, boss-only actions exposed to non-boss players, stale lobby or game state, reconnect regressions, ACK handling gaps, or mismatches between state transitions and UI affordances.
- Relevant when: the diff touches `GameState.ts`, `handlers.ts`, `useSocket.ts`, `GameContext.tsx`, `Lobby.tsx`, `Game.tsx`, `Home.tsx`, or components that gate gameplay actions.
- Skip when: the diff is clearly isolated to presentation details with no effect on actions, state ownership, or data flow.
- Review goal: confirm that the server remains the source of truth, the client mirrors that truth correctly, and multi-step flows still work across lobby, round, reveal, winner-pick, next-round, and reconnect scenarios.

## Content & Catalog Integrity

- Look for: invalid card schema, `blanks` mismatches, variant-extension compatibility drift, catalog metadata inconsistencies, missing theme handling for a new variant, broken host selection flows, or lobby/game displays that no longer match the selected variant and extensions.
- Relevant when: the diff touches `server/data/`, `CardDeck.ts`, `theme.ts`, `Home.tsx`, `Lobby.tsx`, `GameContext.tsx`, or theme-related CSS.
- Skip when: the diff does not affect card data, catalogs, themes, or host variant selection.
- Review goal: confirm that data remains structurally valid, variant and extension wiring stays coherent end-to-end, and presentation still matches the selected game content.

## Clean Code & Simplification

- Look for: unnecessary nesting, redundant abstractions, duplicate branches, nested ternaries, overly dense expressions, misleading names, dead comments, magic values introduced without context, or local structure that is harder to follow than necessary.
- Relevant when: the diff changes logic, markup structure, selectors, naming, control flow, helper usage, or non-trivial styles.
- Skip when: the diff is purely generated, comment-only, content-only, or otherwise too mechanical to support a meaningful clean-code judgment.
- Review goal: find behavior-preserving simplifications that improve clarity, consistency, and maintainability without expanding scope beyond the touched code.

## Security

- Look for: permission weakening in socket handlers, client-only enforcement of gameplay rules, unsafe share-link handling, exposed secrets, over-trusting lobby or session identifiers, or rendering paths that could inject untrusted content.
- Relevant when: JS/TS, config, share/join flows, session handling, routing, or content-rendering changes affect inputs, outputs, permissions, or external links.
- Skip when: the diff is purely cosmetic and does not alter data handling, navigation, or rendering behavior.

## Code Quality

- Look for: weak cohesion, brittle boundaries between client and server responsibilities, duplicated rule logic across layers, or structural choices that make future gameplay or variant changes error-prone.
- Relevant when: the diff introduces new logic, abstractions, or structural changes.
- Skip when: the change is purely mechanical and leaves the code shape effectively unchanged.

## Bugs

- Look for: incorrect conditions, missing null handling, phase-specific edge cases, reconnect holes, mismatched state and UI, broken join/start restrictions, or behavior that clearly differs from the intended game flow.
- Relevant when: logic, rendering, DOM structure, or data flow changes.
- Skip when: there is no behavioral change and the diff is purely formatting or comment-only.

## Race Conditions

- Look for: order-dependent socket flows, duplicate emits, timing assumptions around ACKs, reconnect timing issues, StrictMode-sensitive side effects, or async state that can produce inconsistent behavior between players.
- Relevant when: JS/TS changes affect socket events, async flows, initialization, reconnect, shared mutable state, or React effects.
- Skip when: the diff touches only static text content or styles with no behavioral surface.

## Test Flakiness

- Look for: timing-sensitive assertions, socket-order assumptions, unstable selectors, theme-dependent assertions, or tests that rely on incidental state shape or DOM structure.
- Relevant when: the diff changes tests, async UI behavior, selectors, socket timing, or other timing-sensitive behavior.
- Skip when: no test surface or timing-sensitive behavior is touched.

## Maintainability

- Look for: hidden coupling across `GameState`, socket handlers, client state, rules copy, theme mapping, or card catalogs; also watch for brittle assumptions that will break the next rule or content change.
- Relevant when: the diff introduces new conventions, wrappers, helper usage, or cross-file dependencies.
- Skip when: the change is trivial and does not increase long-term complexity.

## Performance

- Look for: repeated expensive derived-state work, unnecessary rerenders in large game state updates, avoidable socket chatter, or rendering loops that scale poorly with player count or hand size.
- Relevant when: JS/TS changes affect runtime work, socket traffic, or when UI changes can obviously bloat DOM or layout cost.
- Skip when: the diff has no realistic performance impact.

## Accessibility

- Look for: semantic misuse, missing labels, keyboard traps, broken focus behavior, invalid ARIA, weak theme contrast, or interactions that become harder to understand in lobby/game flows.
- Relevant when: HTML, JS, TSX, or CSS changes affect interactive elements, structure, visibility, focus states, or theme styling.
- Skip when: the change cannot plausibly affect interaction, semantics, or perceivability.

## Testing & Documentation

- Look for: missing validation notes for changed behavior, missing Vitest coverage where a realistic test path exists, outdated README or rules copy, or cases where the required gameplay smoke test should be called out explicitly.
- Relevant when: behavior, public interfaces, socket flows, client UI behavior, card data, or workflow-facing changes are introduced.
- Skip when: the changed area has no real automated test path and the diff is too small to justify additional manual validation or documentation notes.
