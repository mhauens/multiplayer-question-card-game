---
name: game-rules-and-content
description: 'Understand the online game rules, lobby lifecycle, round boss permissions, card JSON format, variant-specific extensions, and where gameplay copy must stay in sync. Use for rule changes, adding questions or answers, updating rules modal text, or working on card data.'
argument-hint: 'Optional focus area, for example: card data, boss rules, lobby flow, or rules modal'
user-invocable: true
---

# Game Rules And Content

## When To Use

- You need to change gameplay rules.
- You are adding or editing question and answer cards.
- You are updating the in-app rules modal or other gameplay copy.
- You need to verify how the online variant differs from the physical card game.

## Online Variant Rules In This Repo

- The host creates the lobby and starts the game.
- A game needs at least 3 players to start.
- Each player gets 8 answer cards.
- Non-boss players submit answers.
- Players may swap their hand during submit phase and skip that round.
- Only the current round boss can reveal submissions, pick the winner, and start the next round.
- The next boss rotates to the next connected player.
- Unexpected disconnects pause the game for up to 30 seconds so the affected player can reconnect via the saved browser session.
- Active leave still removes the player immediately.

## Rule Sources

- Rule engine: `server/src/game/GameState.ts`
- Event permissions and responses: `server/src/socket/handlers.ts`
- Player-facing rule copy: `client/src/components/RulesModal.tsx`
- Lobby and game affordances: `client/src/pages/Lobby.tsx` and `client/src/pages/Game.tsx`
- Host-side variant and extension selection: `client/src/pages/Home.tsx`

## Card Data Model

### Base sets

- `server/data/base-questions.json`
- `server/data/base-answers.json`

The `base` variant is synthesized from these two files in `server/src/game/CardDeck.ts`.

### Full variants

- `server/data/variants/<variant-id>/questions.json`
- `server/data/variants/<variant-id>/answers.json`

### Extensions

- `server/data/extensions/<extension-id>/questions.json`
- `server/data/extensions/<extension-id>/answers.json`

### Question schema

```json
{ "text": "Die Todesursache: ________.", "blanks": 1 }
```

### Answer schema

```json
"Ein peinlicher Arztbesuch."
```

### Extension schema

```json
{
  "name": "beispiel-erweiterung",
  "title": "Beispiel-Erweiterung",
  "description": "Zusaetzliche Karten fuer das Basis-Set.",
  "variants": ["base"],
  "questions": [
    { "text": "Das schlimmste Weihnachtsgeschenk aller Zeiten: ________.", "blanks": 1 }
  ]
}
```

```json
{
  "name": "beispiel-erweiterung",
  "title": "Beispiel-Erweiterung",
  "description": "Zusaetzliche Karten fuer das Basis-Set.",
  "variants": ["base"],
  "answers": [
    "Ein selbstgestrickter Pullover."
  ]
}
```

### Variant schema

```json
{
  "name": "peppa-wutz",
  "title": "Peppa Wutz",
  "description": "Matschepfuetzen, Dorfchaos und Familienalltag fuer Erwachsene.",
  "questions": [
    { "text": "Papa Wutz versucht das Teammeeting zu retten mit ________.", "blanks": 1 }
  ]
}
```

```json
{
  "name": "peppa-wutz",
  "title": "Peppa Wutz",
  "description": "Matschepfuetzen, Dorfchaos und Familienalltag fuer Erwachsene.",
  "answers": [
    "ein passiv-aggressiver Elternbrief"
  ]
}
```

## Variant And Extension Rules

- The host can always choose from all loaded variants.
- `base` is the default variant in the host UI.
- The host UI shows only the extensions that belong to the currently displayed variant.
- The server filters selected extensions again when creating a game, so incompatible extensions are ignored.
- The chosen `activeVariant` and `activeExtensions` are reflected in lobby and gameplay state.
- Variant themes are handled in the client via `client/src/theme.ts`; if you add a themed variant, keep theme styling aligned with the chosen content.

## Minimum Card Count For New Variants

- These minimum card counts apply to new full variants, not to extensions.
- Extensions are only played together with a compatible full variant and therefore do not need to meet the full variant minimums on their own.
- New full variants must satisfy the minimum card count for the current game rules.
- The game supports up to 10 players, and each player starts with 8 answer cards.
- Therefore a new full variant must include at least 80 unique answers so 10 players can all receive unique visible answer texts at the same time without duplicates.
- The current UI allows up to 10 trophies as the victory target.
- Only one trophy is awarded per round, and the game ends immediately when a player reaches the selected trophy target.
- To fully cover the current maximum lobby size and trophy target even for the longest possible game, a new full variant should include at least 91 questions.
- Use this formula for the question minimum: `max players * (highest selectable maxTrophies - 1) + 1`.
- With the current repo limits that means `10 * (10 - 1) + 1 = 91` questions.
- If the maximum player count changes later, both the minimum question count and the minimum answer count must be recalculated and updated as well.
- If the hand size changes later, the minimum answer count must be recalculated and updated as well.
- If the highest selectable trophy target changes later, the minimum question count must be recalculated and updated as well.
- Technically fewer questions can still start a game, but anything below this threshold should be treated as a smaller or intentionally limited variant rather than a normal full variant.
- If you are creating a smaller experimental variant on purpose, document the limitation clearly instead of treating it as a normal full variant.

## Change Checklist

If you change rules:

1. Update server logic in `GameState.ts`.
2. Update socket permissions and messages in `handlers.ts`.
3. Update client affordances in the relevant page or component.
4. Update the rules modal if the player-facing explanation changed.

If you change card content:

1. Edit the correct JSON file.
2. Preserve valid JSON structure.
3. Keep `blanks` aligned with the number of expected answer cards.
4. Keep every non-base variant and every extension in its own subfolder with one `questions.json` file and one `answers.json` file.
5. `questions.json` should contain only question data, and `answers.json` should contain only answer data.
6. If you add an extension, set `variants` when it should not belong only to `base`.
7. If you add a new full variant, make sure it meets the minimum card-count requirement for variants, especially at least 80 unique answers and at least 91 questions for the current 10-player and 10-trophy limits.
8. If you change the maximum player count, update the documented minimum question and answer requirements for full variants accordingly.
9. If you change the hand size, update the documented minimum answer requirement for full variants accordingly.
10. If you change the highest selectable trophy target, update the documented minimum question requirement for full variants accordingly.
11. If you add a new full variant, consider whether it also needs a client theme in `client/src/theme.ts` and CSS overrides.
12. Run `pnpm build` after changes.

If you change player-facing variant selection or variant labels:

1. Update the host UI in `client/src/pages/Home.tsx`.
2. Update the lobby summary in `client/src/pages/Lobby.tsx` if the selected data shown to players changes.
3. Keep the rules modal copy in sync if the behavior visible to players changed.

## Validation

- Build: `pnpm build`
- For gameplay-rule changes: run `pnpm dev` and play through at least one full round using two browser sessions.
- For variant or extension changes: verify the host can switch variants, sees the correct extension toggles, and that the created lobby shows the expected active variant and extensions.
