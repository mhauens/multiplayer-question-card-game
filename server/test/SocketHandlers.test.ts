import { describe, expect, it, vi } from 'vitest';
import { registerSocketHandlers } from '../src/socket/handlers';

type Handler = (...args: any[]) => void;

function createSocketStub() {
  const handlers = new Map<string, Handler>();
  const roomEmitter = { emit: vi.fn() };

  return {
    id: 'socket-1',
    handlers,
    roomEmitter,
    emit: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    join: vi.fn(),
    leave: vi.fn(),
    disconnect: vi.fn(),
    to: vi.fn(() => roomEmitter),
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

  it('rejects self-kicks from the host', () => {
    let connectionHandler: Handler | undefined;
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map() },
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({
        player: { id: 'host-1', isHost: true },
        gameState: {
          game: { code: 'ABCD', phase: 'LOBBY' },
          getPlayer: vi.fn(),
        },
      })),
    };
    const socket = createSocketStub();
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const kickHandler = socket.handlers.get('kick-player');
    expect(kickHandler).toBeDefined();

    kickHandler?.({ playerId: 'host-1' }, ack);

    expect(ack).toHaveBeenCalledWith({ error: 'Der Host kann sich nicht selbst entfernen.' });
  });

  it('kicks a lobby player without disconnecting their base socket', () => {
    let connectionHandler: Handler | undefined;
    const targetSocket = {
      emit: vi.fn(),
      leave: vi.fn(),
      disconnect: vi.fn(),
    };
    const hostPlayer = { id: 'host-1', name: 'Anna', socketId: 'socket-1' };
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map([['socket-2', targetSocket]]) },
    };
    const targetPlayer = { id: 'p2', name: 'Bert', socketId: 'socket-2' };
    const gameState = {
      game: { code: 'ABCD', phase: 'LOBBY', players: [hostPlayer, targetPlayer] },
      getPlayer: vi.fn(() => targetPlayer),
      removePlayer: vi.fn(() => {
        gameState.game.players = [hostPlayer];
      }),
      getClientState: vi.fn(() => ({ code: 'ABCD' })),
      getCurrentRound: vi.fn(() => undefined),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({
        player: { ...hostPlayer, isHost: true },
        gameState,
      })),
    };
    const socket = createSocketStub();
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const kickHandler = socket.handlers.get('kick-player');
    expect(kickHandler).toBeDefined();

    kickHandler?.({ playerId: 'p2' }, ack);

    expect(targetSocket.leave).toHaveBeenCalledWith('ABCD');
    expect(gameState.removePlayer).toHaveBeenCalledWith('p2');
    expect(targetSocket.emit).toHaveBeenCalledWith('kicked', {
      message: 'Du wurdest aus der Lobby entfernt.',
    });
    expect(targetSocket.disconnect).not.toHaveBeenCalled();
    expect(socket.roomEmitter.emit).toHaveBeenCalledWith('player-kicked', { playerName: 'Bert' });
    expect(ack).toHaveBeenCalledWith({ success: true });
  });

  it('removes a player when they actively leave the game', () => {
    let connectionHandler: Handler | undefined;
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map() },
    };
    const player = { id: 'p2', name: 'Bert', socketId: 'socket-1', isConnected: true };
    const gameState = {
      game: { code: 'ABCD', players: [player] },
      removePlayer: vi.fn(() => {
        gameState.game.players = [];
      }),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({ gameState, player })),
      deleteGame: vi.fn(),
    };
    const socket = createSocketStub();
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const leaveHandler = socket.handlers.get('leave-game');
    expect(leaveHandler).toBeDefined();

    leaveHandler?.(ack);

    expect(socket.leave).toHaveBeenCalledWith('ABCD');
    expect(gameState.removePlayer).toHaveBeenCalledWith('p2');
    expect(gameManager.deleteGame).toHaveBeenCalledWith('ABCD');
    expect(ack).toHaveBeenCalledWith({ success: true });
  });

  it('aborts the running game when an active leave drops the lobby below three players', () => {
    let connectionHandler: Handler | undefined;
    const ioEmit = vi.fn();
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: ioEmit })),
      sockets: { sockets: new Map() },
    };
    const remainingPlayers = [
      { id: 'p1', name: 'Anna', socketId: 'socket-a', isConnected: true },
      { id: 'p2', name: 'Bert', socketId: 'socket-b', isConnected: true },
    ];
    const leavingPlayer = { id: 'p3', name: 'Chris', socketId: 'socket-1', isConnected: true };
    const gameState = {
      game: { code: 'ABCD', players: [...remainingPlayers, leavingPlayer], phase: 'SUBMITTING' },
      removePlayer: vi.fn(() => {
        gameState.game.players = remainingPlayers;
        gameState.game.phase = 'GAME_OVER';
      }),
      shouldAbortForTooFewPlayers: vi.fn((phase?: string) => phase === 'SUBMITTING'),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({ gameState, player: leavingPlayer })),
      deleteGame: vi.fn(),
    };
    const socket = createSocketStub();
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const leaveHandler = socket.handlers.get('leave-game');
    expect(leaveHandler).toBeDefined();

    leaveHandler?.(ack);

    expect(gameState.removePlayer).toHaveBeenCalledWith('p3');
    expect(gameState.shouldAbortForTooFewPlayers).toHaveBeenCalledWith('SUBMITTING');
    expect(ioEmit).toHaveBeenCalledWith('game-aborted', {
      message: 'Das Spiel wurde abgebrochen, weil weniger als 3 Spieler übrig sind.',
    });
    expect(gameManager.deleteGame).toHaveBeenCalledWith('ABCD');
    expect(ack).toHaveBeenCalledWith({ success: true });
  });

  it('starts a reconnect pause when the socket disconnects', () => {
    let connectionHandler: Handler | undefined;
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map() },
    };
    const player = { id: 'p2', name: 'Bert', socketId: 'socket-1', isConnected: true };
    const gameState = {
      game: { code: 'ABCD', players: [player], phase: 'SUBMITTING' },
      startReconnectWindow: vi.fn(() => true),
      getReconnectWindow: vi.fn(() => ({
        players: [{ playerId: 'p2', playerName: 'Bert' }],
        deadline: Date.now() + 30_000,
      })),
      getCurrentRound: vi.fn(() => ({ phaseDeadline: null })),
      getClientState: vi.fn(() => ({ code: 'ABCD' })),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({ gameState, player })),
      deleteGame: vi.fn(),
    };
    const socket = createSocketStub();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const disconnectHandler = socket.handlers.get('disconnect');
    expect(disconnectHandler).toBeDefined();

    disconnectHandler?.();

    expect(gameState.startReconnectWindow).toHaveBeenCalledWith('p2');
    expect(socket.roomEmitter.emit).toHaveBeenCalledWith('player-disconnected', {
      playerName: 'Bert',
      reconnectSeconds: 30,
    });
    expect(gameManager.deleteGame).not.toHaveBeenCalled();
  });

  it('removes a player immediately when they disconnect in the lobby', () => {
    let connectionHandler: Handler | undefined;
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map() },
    };
    const player = { id: 'p2', name: 'Bert', socketId: 'socket-1', isConnected: true };
    const gameState = {
      game: { code: 'ABCD', players: [player], phase: 'LOBBY' },
      startReconnectWindow: vi.fn(() => false),
      removePlayer: vi.fn(() => {
        gameState.game.players = [];
      }),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({ gameState, player })),
      deleteGame: vi.fn(),
    };
    const socket = createSocketStub();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const disconnectHandler = socket.handlers.get('disconnect');
    expect(disconnectHandler).toBeDefined();

    disconnectHandler?.();

    expect(gameState.startReconnectWindow).toHaveBeenCalledWith('p2');
    expect(gameState.removePlayer).toHaveBeenCalledWith('p2');
    expect(socket.roomEmitter.emit).toHaveBeenCalledWith('player-left', {
      playerName: 'Bert',
    });
    expect(gameManager.deleteGame).toHaveBeenCalledWith('ABCD');
  });

  it('rejoins a paused game inside the reconnect window', () => {
    let connectionHandler: Handler | undefined;
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map() },
    };
    const player = { id: 'p2', name: 'Bert', socketId: null };
    const gameState = {
      game: { code: 'ABCD', players: [player] },
      getReconnectWindow: vi.fn(() => ({
        players: [{ playerId: 'p2', playerName: 'Bert' }],
        deadline: Date.now() + 30_000,
      })),
      resumeAfterReconnect: vi.fn(() => true),
      getClientState: vi.fn(() => ({ code: 'ABCD', myId: 'p2' })),
    };
    const gameManager = {
      rejoinGame: vi.fn(() => ({ gameState, player })),
    };
    const socket = createSocketStub();
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const rejoinHandler = socket.handlers.get('rejoin-game');
    expect(rejoinHandler).toBeDefined();

    rejoinHandler?.({ gameCode: 'ABCD', playerId: 'p2' }, ack);

    expect(gameManager.rejoinGame).toHaveBeenCalledWith('ABCD', 'p2');
    expect(gameState.resumeAfterReconnect).toHaveBeenCalledWith('p2');
    expect(socket.join).toHaveBeenCalledWith('ABCD');
    expect(ack).toHaveBeenCalledWith({
      gameCode: 'ABCD',
      playerId: 'p2',
      state: { code: 'ABCD', myId: 'p2' },
    });
  });

  it('rejects twitch connect start while the game is paused for reconnect', async () => {
    let connectionHandler: Handler | undefined;
    const twitchService = {
      createOAuthUrl: vi.fn(),
    };
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map() },
    };
    const gameState = {
      game: { code: 'ABCD' },
      getReconnectWindow: vi.fn(() => ({
        players: [{ playerId: 'p2', playerName: 'Bert' }],
        deadline: Date.now() + 30_000,
      })),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({
        player: { id: 'p2' },
        gameState,
      })),
    };
    const socket = createSocketStub();
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any, twitchService as any);
    connectionHandler?.(socket);

    const handler = socket.handlers.get('twitch-connect:start');
    expect(handler).toBeDefined();

    await handler?.({ clientOrigin: 'http://localhost:5173' }, ack);

    expect(twitchService.createOAuthUrl).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ error: 'Bert hat noch Zeit für einen Reconnect. Das Spiel ist gerade pausiert.' });
  });

  it('rejects community-vote toggles while the game is paused for reconnect', () => {
    let connectionHandler: Handler | undefined;
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map() },
    };
    const gameState = {
      getReconnectWindow: vi.fn(() => ({
        players: [{ playerId: 'p2', playerName: 'Bert' }],
        deadline: Date.now() + 30_000,
      })),
      setCommunityVotingEnabled: vi.fn(),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({
        player: { id: 'p2' },
        gameState,
      })),
    };
    const socket = createSocketStub();
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const handler = socket.handlers.get('community-vote:set-enabled');
    expect(handler).toBeDefined();

    handler?.({ enabled: true }, ack);

    expect(gameState.setCommunityVotingEnabled).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ error: 'Bert hat noch Zeit für einen Reconnect. Das Spiel ist gerade pausiert.' });
  });

  it('does not remove an already-disconnected player again while another reconnect pause is active', () => {
    let connectionHandler: Handler | undefined;
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map() },
    };
    const player = { id: 'p3', name: 'Chris', socketId: 'socket-1', isConnected: false };
    const gameState = {
      game: { code: 'ABCD', players: [player], phase: 'SUBMITTING' },
      startReconnectWindow: vi.fn(() => false),
      removePlayer: vi.fn(),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({ gameState, player })),
      deleteGame: vi.fn(),
    };
    const socket = createSocketStub();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const disconnectHandler = socket.handlers.get('disconnect');
    expect(disconnectHandler).toBeDefined();

    disconnectHandler?.();

    expect(gameState.removePlayer).not.toHaveBeenCalled();
    expect(gameManager.deleteGame).not.toHaveBeenCalled();
  });

  it('rejects next-round while the round is still in progress', () => {
    let connectionHandler: Handler | undefined;
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: vi.fn() })),
      sockets: { sockets: new Map() },
    };
    const gameState = {
      game: { code: 'ABCD', phase: 'SUBMITTING' },
      getCurrentRound: vi.fn(() => ({ bossId: 'host-1' })),
      nextRound: vi.fn(),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({
        player: { id: 'host-1', isHost: true },
        gameState,
      })),
    };
    const socket = createSocketStub();
    const ack = vi.fn();

    registerSocketHandlers(io as any, gameManager as any);
    connectionHandler?.(socket);

    const nextRoundHandler = socket.handlers.get('next-round');
    expect(nextRoundHandler).toBeDefined();

    nextRoundHandler?.(ack);

    expect(gameState.nextRound).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ error: 'Die nächste Runde kann erst nach Rundenende gestartet werden.' });
  });

  it('aborts the game after reconnect timeout when fewer than three players remain', () => {
    vi.useFakeTimers();

    let connectionHandler: Handler | undefined;
    const ioEmit = vi.fn();
    const twitchService = {
      cleanupPlayer: vi.fn(async () => undefined),
      cleanupGame: vi.fn(async () => undefined),
    };
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: ioEmit })),
      sockets: { sockets: new Map() },
    };

    const reconnectWindow = {
      players: [{ playerId: 'p3', playerName: 'Chris' }],
      deadline: Date.now() + 30_000,
      pausedPhase: 'SUBMITTING',
    };
    let reconnectActive = true;
    const remainingPlayers = [
      { id: 'p1', name: 'Anna', socketId: 'socket-a' },
      { id: 'p2', name: 'Bert', socketId: 'socket-b' },
    ];
    const disconnectedPlayer = { id: 'p3', name: 'Chris', socketId: 'socket-1' };
    const gameState = {
      game: { code: 'ABCD', players: [...remainingPlayers, disconnectedPlayer] },
      startReconnectWindow: vi.fn(() => true),
      getReconnectWindow: vi.fn(() => (reconnectActive ? reconnectWindow : null)),
      getClientState: vi.fn(() => ({ code: 'ABCD' })),
      expireReconnectWindow: vi.fn(() => {
        reconnectActive = false;
        gameState.game.players = remainingPlayers;
        return [{ playerId: 'p3', playerName: 'Chris' }];
      }),
      shouldAbortForTooFewPlayers: vi.fn(() => true),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({ gameState, player: disconnectedPlayer })),
      deleteGame: vi.fn(),
    };
    const socket = createSocketStub();

    registerSocketHandlers(io as any, gameManager as any, twitchService as any);
    connectionHandler?.(socket);

    const disconnectHandler = socket.handlers.get('disconnect');
    expect(disconnectHandler).toBeDefined();

    disconnectHandler?.();
    vi.advanceTimersByTime(30_000);

    expect(gameState.expireReconnectWindow).toHaveBeenCalled();
    expect(twitchService.cleanupPlayer).toHaveBeenCalledWith('ABCD', 'p3');
    expect(ioEmit).toHaveBeenCalledWith('game-aborted', {
      message: 'Das Spiel wurde abgebrochen, weil nach dem Reconnect-Fenster weniger als 3 Spieler übrig sind.',
    });
    expect(gameManager.deleteGame).toHaveBeenCalledWith('ABCD');

    vi.useRealTimers();
  });

  it('cleans up community voting connections for players removed after reconnect timeout', () => {
    vi.useFakeTimers();

    let connectionHandler: Handler | undefined;
    const ioEmit = vi.fn();
    const twitchService = {
      cleanupPlayer: vi.fn(async () => undefined),
      cleanupGame: vi.fn(async () => undefined),
    };
    const io = {
      on: vi.fn((event: string, handler: Handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      to: vi.fn(() => ({ emit: ioEmit })),
      sockets: { sockets: new Map() },
    };

    const reconnectWindow = {
      players: [{ playerId: 'p3', playerName: 'Chris' }],
      deadline: Date.now() + 30_000,
      pausedPhase: 'SUBMITTING',
    };
    let reconnectActive = true;
    const remainingPlayers = [
      { id: 'p1', name: 'Anna', socketId: 'socket-a' },
      { id: 'p2', name: 'Bert', socketId: 'socket-b' },
      { id: 'p4', name: 'Dana', socketId: 'socket-c' },
    ];
    const disconnectedPlayer = { id: 'p3', name: 'Chris', socketId: 'socket-1' };
    const gameState = {
      game: { code: 'ABCD', players: [...remainingPlayers, disconnectedPlayer] },
      startReconnectWindow: vi.fn(() => true),
      getReconnectWindow: vi.fn(() => (reconnectActive ? reconnectWindow : null)),
      getClientState: vi.fn(() => ({ code: 'ABCD' })),
      expireReconnectWindow: vi.fn(() => {
        reconnectActive = false;
        gameState.game.players = remainingPlayers;
        return [{ playerId: 'p3', playerName: 'Chris' }];
      }),
      shouldAbortForTooFewPlayers: vi.fn(() => false),
    };
    const gameManager = {
      findGameBySocketId: vi.fn(() => ({ gameState, player: disconnectedPlayer })),
      deleteGame: vi.fn(),
    };
    const socket = createSocketStub();

    registerSocketHandlers(io as any, gameManager as any, twitchService as any);
    connectionHandler?.(socket);

    const disconnectHandler = socket.handlers.get('disconnect');
    expect(disconnectHandler).toBeDefined();

    disconnectHandler?.();
    vi.advanceTimersByTime(30_000);

    expect(twitchService.cleanupPlayer).toHaveBeenCalledWith('ABCD', 'p3');
    expect(gameManager.deleteGame).not.toHaveBeenCalled();
    expect(ioEmit).toHaveBeenCalledWith('player-left', { playerName: 'Chris' });

    vi.useRealTimers();
  });
});
