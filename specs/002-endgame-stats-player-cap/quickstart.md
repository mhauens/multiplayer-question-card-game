# Quickstart: Erweiterte End-of-Game-Stats + Spielerlimit auf 10

## Goal

Validate the endgame stats flow, the 10-player lobby cap, and the updated rule/documentation values.

## Automated Checks

Run the workspace checks from the repository root:

```bash
pnpm lint
pnpm test
pnpm build
```

## Manual Smoke Test

1. Start the app and create a lobby with a host.
2. Join with a second browser session until the lobby reaches 10 players.
3. Confirm that the 11th join attempt is rejected.
4. Open the rules modal and confirm the lobby limit shows 10 players.
5. Play a full match to GAME_OVER.
6. Verify that the endscreen still shows the winner banner and round recap.
7. Verify that the endscreen also shows total rounds, highlight cards, and the per-player statistics table.
8. Verify that tied highlights show multiple leaders and zero-valued highlight categories do not render.
9. Trigger a rematch and confirm all match stats start back at zero.

## Expected Outcomes

- Lobby and rules copy use 10 as the player cap.
- The shared full-variant minimums resolve to 80 answers and 91 questions.
- Endgame stats are visible only at GAME_OVER.
- Round recap remains present alongside the new summary.

## Related Files

- [spec.md](spec.md)
- [plan.md](plan.md)
- [data-model.md](data-model.md)
- [contracts/endgame-stats-client-state.md](contracts/endgame-stats-client-state.md)
- [contracts/shared-player-cap-rules.md](contracts/shared-player-cap-rules.md)