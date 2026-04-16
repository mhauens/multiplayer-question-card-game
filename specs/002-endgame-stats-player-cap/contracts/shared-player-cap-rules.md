# Contract: `@kgs/game-rules` player cap and full-variant thresholds

## Purpose

Defines the shared gameplay boundaries used by client, server, tests, and documentation.

## Shape

```ts
export const MAX_PLAYERS: number;
export function getMinimumFullVariantAnswerCount(): number;
export function getMinimumFullVariantQuestionCount(): number;
```

## Semantics

- `MAX_PLAYERS` is 10.
- `getMinimumFullVariantAnswerCount()` returns 80 with the current shared hand size.
- `getMinimumFullVariantQuestionCount()` returns 91 with the current trophy targets and player cap.
- These values are shared contract boundaries, not local UI hints.
- Smaller card sets below those thresholds remain startable and must not be hard-blocked solely because they do not meet the full-variant formula.

## Consumers

- Lobby and rules UI text.
- Server join-limit checks.
- Shared-rule tests and documentation.
- Any future full-variant compatibility guidance.