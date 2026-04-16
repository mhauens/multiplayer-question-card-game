# Data Model: Erweiterte End-of-Game-Stats + Spielerlimit auf 10

## Entities

### EndGameStats

- `totalRounds`: number
- `players`: `PlayerEndGameStats[]`
- `highlights`: `EndGameHighlight[]`

Represents the full match summary shown only at GAME_OVER.

### PlayerEndGameStats

- `playerId`: string
- `playerName`: string
- `trophies`: number
- `bossRounds`: number
- `submittedRounds`: number
- `swappedRounds`: number
- `currentWinStreak`: number
- `longestWinStreak`: number

Represents the per-player match record that feeds the endscreen table.

### EndGameHighlight

- `key`: string
- `title`: string
- `value`: number
- `leaders`: `PlayerEndGameStats[]`

Represents a top-line match insight such as longest win streak or most boss rounds.

### RoundRecapEntry

Existing entity kept as the historical per-round log.

## Relationships

- `GameState` owns the transient endgame stats for the active match.
- `ClientGameState.endGameStats` mirrors the server summary only when the game is over.
- `RoundRecapEntry` remains separate and continues to reflect round-by-round history.

## Validation Rules

- `endGameStats` must be `null` for every phase except `GAME_OVER`.
- `players` must include only players still part of the game at `GAME_OVER`.
- `players` must be sorted the same way as the final ranking: trophies descending, then stable name order for ties.
- `highlights` must always include total rounds and must omit categories whose value is 0.
- `leaders` must list every tied leader for the winning value of that highlight.

## State Transitions

- `bossRounds` increments when a new round starts and a player becomes the active boss.
- `submittedRounds` increments when a submission is accepted successfully.
- `swappedRounds` increments when a hand swap is accepted successfully.
- `currentWinStreak` increments for the winning player on `pickWinner` and resets to 0 for all others.
- `longestWinStreak` updates whenever `currentWinStreak` exceeds the previous maximum.
- All match stats reset to zero on `rematch()` and when a brand-new game is created.