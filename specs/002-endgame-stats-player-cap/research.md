# Research: Erweiterte End-of-Game-Stats + Spielerlimit auf 10

## 1. Match stats should live in `GameState`

- Decision: Track match statistics incrementally in the server-side `GameState` alongside the existing round lifecycle.
- Rationale: The server already owns phase transitions, round progression, trophy assignment, rematch resets, and reconnect behavior. Keeping the stats there avoids recomputing them from the historical round log and keeps the data in the same authoritative layer as the rest of the gameplay state.
- Alternatives considered: Derive stats from `game.rounds` only at GAME_OVER. Rejected because some counters are easier and safer to update at the event boundary, and the feature explicitly requires reset semantics on rematch/new games.

## 2. Expose endgame data through `ClientGameState`

- Decision: Extend the sanitized client state with `endGameStats: ClientEndGameStats | null` and keep it `null` outside `GAME_OVER`.
- Rationale: The client already consumes a single state object for all gameplay rendering. Adding a nullable field preserves the current data flow and keeps the endscreen feature aligned with the existing server-to-client contract.
- Alternatives considered: A separate socket event or a separate fetch on GAME_OVER. Rejected because it adds a second data path for a state that is already naturally available in the main game snapshot.

## 3. Model highlight ties as leader lists

- Decision: Represent each highlight as `{ key, title, value, leaders[] }` and treat `leaders` as a list so ties can be rendered together.
- Rationale: The spec requires shared leaders for ties and hides categories with value 0. A list preserves that rule without special-casing ties in the UI.
- Alternatives considered: Single winner plus tie flag. Rejected because it complicates rendering and does not express multiple leaders cleanly.

## 4. Keep the existing round recap and add the new stats beside it

- Decision: Preserve `roundRecap` exactly as the historical round log and render the new endgame stats as an additional summary block.
- Rationale: The spec explicitly says the recap must remain intact, not be replaced. Keeping the two outputs separate avoids accidental regressions in the round history UI.
- Alternatives considered: Fold the new stats into the recap entries. Rejected because recap is round-by-round history while the new stats are aggregated match metadata.

## 5. Update the shared player cap and formula helpers in `@kgs/game-rules`

- Decision: Raise `MAX_PLAYERS` to 10 and let the existing helper formulas recalculate the full-variant thresholds to 80 answers and 91 questions.
- Rationale: The project already treats these values as shared contract boundaries. Centralizing the new cap prevents client/server drift and keeps the repo-wide tests and docs aligned.
- Alternatives considered: Duplicate a new 10-player constant in the server only. Rejected because the repository architecture explicitly prefers shared contract values for cross-stack rules.

## 6. Do not add hard blocking for smaller sets

- Decision: Leave the existing set compatibility checks permissive for smaller catalogs, even though the full-variant thresholds change.
- Rationale: The feature brief explicitly says smaller sets must remain startable and no new hard blocking should be introduced.
- Alternatives considered: Add a stricter deck-size gate based on the new formula. Rejected because it would change the current product behavior and was explicitly ruled out.

## 7. Update documentation that hard-codes the old cap

- Decision: Refresh README text and the game-rules skill/documentation so the new 10-player cap and 80/91 minimums are discoverable in both product docs and developer guidance.
- Rationale: The spec requires all visible rule references to match the new values; documentation drift would undermine the shared-rule contract.
- Alternatives considered: Leave docs untouched and rely on tests. Rejected because the user-facing rules and developer guidance would remain incorrect.