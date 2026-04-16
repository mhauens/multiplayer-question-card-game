# Contract: `ClientGameState.endGameStats`

## Purpose

Describes the end-of-game summary exposed to the browser only when the match reaches GAME_OVER.

## Shape

```ts
interface ClientEndGameStats {
  totalRounds: number;
  players: ClientPlayerEndGameStats[];
  highlights: ClientEndGameHighlight[];
}

interface ClientPlayerEndGameStats {
  playerId: string;
  playerName: string;
  trophies: number;
  bossRounds: number;
  submittedRounds: number;
  swappedRounds: number;
  currentWinStreak: number;
  longestWinStreak: number;
}

interface ClientEndGameHighlight {
  key: 'longest-win-streak' | 'most-boss-rounds' | 'most-submitted-rounds' | 'most-swapped-rounds';
  title: string;
  value: number;
  leaders: ClientPlayerEndGameStats[];
}
```

## Semantics

- `endGameStats` must be `null` in all phases except `GAME_OVER`.
- `totalRounds` is the number of completed rounds in the match.
- `players` must include only the players still part of the game at GAME_OVER.
- `players` must follow the final ranking order: trophies descending, then stable name order for ties.
- `highlights` must always include the total-round summary elsewhere in the UI, but highlight entries with value 0 must not be emitted.
- `leaders` must include every player tied for the top value of that highlight.

## Visibility Rule

The payload is visible only to the active browser client through the standard game snapshot. It must not appear in lower phases or in separate player-specific side channels.