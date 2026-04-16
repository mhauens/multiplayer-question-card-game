import { useSyncExternalStore } from 'react';

function subscribeToClock(onStoreChange: () => void) {
  let timer: ReturnType<typeof window.setTimeout> | null = null;

  const scheduleNextTick = () => {
    const remainder = Date.now() % 1000;
    const delay = remainder === 0 ? 1000 : 1000 - remainder;

    timer = window.setTimeout(() => {
      onStoreChange();
      scheduleNextTick();
    }, delay);
  };

  scheduleNextTick();

  return () => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  };
}

function readCurrentTime() {
  return Date.now();
}

export function getRemainingSeconds(deadline: number, currentTime: number) {
  return Math.max(0, Math.ceil((deadline - currentTime) / 1000));
}

export function useCurrentTime(enabled = true) {
  return useSyncExternalStore(
    enabled ? subscribeToClock : () => () => undefined,
    enabled ? readCurrentTime : () => 0,
    () => 0,
  );
}
