import { describe, expect, it, vi } from 'vitest';
import { registerSocketHandlers } from '../src/socket/handlers';

type Handler = (...args: any[]) => void;

function createSocketStub() {
  const handlers = new Map<string, Handler>();

  return {
    id: 'socket-1',
    handlers,
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    join: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
  };
}

describe('registerSocketHandlers', () => {
  it('rejects invalid trophy targets before variant lookup or game creation', () => {
    let connectionHandler: Handler | undefined;
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
    };
    const gameManager = {
      hasVariant: vi.fn(),
      createGame: vi.fn(),
    };
    const socket = createSocketStub();
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const createGameHandler = socket.handlers.get('create-game');
    expect(createGameHandler).toBeDefined();

    createGameHandler?.({
      playerName: 'Anna',
      maxTrophies: 999,
      variant: 'base',
      extensions: [],
    }, ack);

    expect(ack).toHaveBeenCalledWith({ error: 'Ungueltiges Trophaenziel.' });
    expect(gameManager.hasVariant).not.toHaveBeenCalled();
    expect(gameManager.createGame).not.toHaveBeenCalled();
  });
});