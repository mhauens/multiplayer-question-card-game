import { Server, Socket } from 'socket.io';
import { isValidTrophyTarget, MIN_PLAYERS_TO_START, RECONNECT_GRACE_SECONDS } from '@kgs/game-rules';
import { GameManager } from '../game/GameManager';
import {
  CardCatalogOption,
  CommunityVoteTogglePayload,
  CreateGamePayload,
  ExtensionCatalogOption,
  GamePhase,
  JoinGamePayload,
  KickPlayerPayload,
  SubmitAnswerPayload,
  PickWinnerPayload,
  RejoinPayload,
  TwitchConnectStartPayload,
} from '../types';
import { TwitchService } from '../twitch/TwitchService';

type Ack = ((response: any) => void) | undefined;

function respond(callback: Ack, response: any): void {
  if (typeof callback === 'function') {
    callback(response);
  }
}

function formatReconnectPlayerNames(gameState: any): string {
  const reconnectWindow = gameState.getReconnectWindow?.();
  if (!reconnectWindow?.players?.length) {
    return '';
  }

  return reconnectWindow.players.map((player: any) => player.playerName).join(', ');
}

function getReconnectPauseError(gameState: any): string | null {
  const reconnectWindow = gameState.getReconnectWindow?.();
  const playerNames = formatReconnectPlayerNames(gameState);
  if (!playerNames || !reconnectWindow?.players?.length) {
    return null;
  }

  return reconnectWindow.players.length === 1
    ? `${playerNames} hat noch Zeit für einen Reconnect. Das Spiel ist gerade pausiert.`
    : `${playerNames} haben noch Zeit für einen Reconnect. Das Spiel ist gerade pausiert.`;
}

function rejectIfReconnectPaused(gameState: any, callback: Ack): boolean {
  const error = getReconnectPauseError(gameState);
  if (!error) {
    return false;
  }

  respond(callback, { error });
  return true;
}

const noopTwitchService = {
  createOAuthUrl: async () => ({ error: 'Twitch-Integration ist gerade nicht verfuegbar.' }),
  disconnectPlayer: async () => undefined,
  cleanupPlayer: async () => undefined,
  cleanupGame: async () => undefined,
};

export function registerSocketHandlers(
  io: Server,
  gameManager: GameManager,
  twitchService: Pick<TwitchService, 'createOAuthUrl' | 'disconnectPlayer' | 'cleanupPlayer' | 'cleanupGame'> = noopTwitchService,
): void {
  const phaseTimers = new Map<string, ReturnType<typeof setTimeout>>();

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('get-variants', (callback?: (variants: CardCatalogOption[]) => void) => {
      if (typeof callback === 'function') {
        callback(gameManager.getAvailableVariants());
      }
    });

    socket.on('get-extensions', (callback?: (extensions: ExtensionCatalogOption[]) => void) => {
      if (typeof callback === 'function') {
        callback(gameManager.getAvailableExtensions());
      }
    });

    socket.on('get-state', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      respond(callback, { state: gameState.getClientState(player.id) });
    });

    socket.on('twitch-connect:start', async (payload: TwitchConnectStartPayload | undefined, callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      const response = await twitchService.createOAuthUrl({
        gameCode: gameState.game.code,
        playerId: player.id,
        clientOrigin: payload?.clientOrigin,
      });

      respond(callback, response);
    });

    socket.on('twitch-connect:disconnect', async (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      await twitchService.disconnectPlayer(gameState.game.code, player.id);
      respond(callback, { success: true });
    });

    socket.on('community-vote:set-enabled', (payload: CommunityVoteTogglePayload, callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      const success = gameState.setCommunityVotingEnabled(player.id, Boolean(payload?.enabled));
      if (!success) {
        respond(callback, { error: 'Twitch muss zuerst verbunden werden.' });
        return;
      }

      respond(callback, { success: true });
      io.to(socket.id).emit('game-state', gameState.getClientState(player.id));
    });

    socket.on('create-game', (payload: CreateGamePayload, callback?: (response: any) => void) => {
      const { playerName, maxTrophies, variant, extensions, password } = payload;

      if (!playerName || playerName.trim().length === 0) {
        respond(callback, { error: 'Name darf nicht leer sein.' });
        return;
      }

      if (!isValidTrophyTarget(maxTrophies)) {
        respond(callback, { error: 'Ungueltiges Trophaenziel.' });
        return;
      }

      const selectedVariant = typeof variant === 'string' && variant.trim().length > 0
        ? variant.trim()
        : 'base';

      if (!gameManager.hasVariant(selectedVariant)) {
        respond(callback, { error: 'Ausgewaehlte Variante ist nicht verfuegbar.' });
        return;
      }

      const selectedExtensions = Array.isArray(extensions) ? extensions : [];
      const sanitizedPassword = typeof password === 'string' && password.trim().length > 0
        ? password.trim().slice(0, 50)
        : undefined;

      const result = gameManager.createGame(playerName.trim(), maxTrophies, selectedVariant, selectedExtensions, sanitizedPassword);
      const { gameState, player } = result;

      player.socketId = socket.id;
      socket.join(gameState.game.code);

      respond(callback, {
        gameCode: gameState.game.code,
        playerId: player.id,
        state: gameState.getClientState(player.id),
      });
    });

    socket.on('join-game', (payload: JoinGamePayload, callback?: (response: any) => void) => {
      const { gameCode, playerName, password } = payload;

      if (!playerName || playerName.trim().length === 0) {
        respond(callback, { error: 'Name darf nicht leer sein.' });
        return;
      }

      if (!gameCode || gameCode.trim().length === 0) {
        respond(callback, { error: 'Spielcode darf nicht leer sein.' });
        return;
      }

      const result = gameManager.joinGame(gameCode.trim(), playerName.trim(), typeof password === 'string' ? password : undefined);
      if (result === 'wrong-password') {
        respond(callback, { error: 'Falsches Passwort.' });
        return;
      }
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden, bereits gestartet, voll oder Name bereits vergeben.' });
        return;
      }

      const { gameState, player } = result;
      player.socketId = socket.id;
      socket.join(gameState.game.code);

      respond(callback, {
        gameCode: gameState.game.code,
        playerId: player.id,
        state: gameState.getClientState(player.id),
      });

      // Notify other players
      socket.to(gameState.game.code).emit('player-joined', {
        playerName: player.name,
      });

      // Broadcast updated state to all players
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('rejoin-game', (payload: RejoinPayload, callback?: (response: any) => void) => {
      const { gameCode, playerId } = payload;
      const result = gameManager.rejoinGame(gameCode.trim(), playerId);

      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden oder Reconnect-Zeit abgelaufen.' });
        return;
      }

      const { gameState, player } = result;
      const reconnectWindow = gameState.getReconnectWindow?.();
      const isTrackedReconnect = reconnectWindow?.players?.some(
        (reconnectPlayer: any) => reconnectPlayer.playerId === player.id,
      );

      if (!isTrackedReconnect) {
        respond(callback, { error: 'Für diesen Spieler läuft gerade kein Reconnect-Fenster.' });
        return;
      }

      player.socketId = socket.id;

      if (!gameState.resumeAfterReconnect(player.id)) {
        respond(callback, { error: 'Reconnect konnte nicht abgeschlossen werden.' });
        return;
      }

      socket.join(gameState.game.code);

      respond(callback, {
        gameCode: gameState.game.code,
        playerId: player.id,
        state: gameState.getClientState(player.id),
      });

      socket.to(gameState.game.code).emit('player-reconnected', {
        playerName: player.name,
      });

      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('start-game', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;

      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      if (!player.isHost) {
        respond(callback, { error: 'Nur der Host kann das Spiel starten.' });
        return;
      }

      if (!gameState.canStart()) {
        respond(callback, { error: `Mindestens ${MIN_PLAYERS_TO_START} Spieler werden benötigt.` });
        return;
      }

      gameState.startGame();
      respond(callback, { success: true });
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('submit-answer', (payload: SubmitAnswerPayload, callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      const success = gameState.submitAnswer(player.id, payload.cardIds);

      if (!success) {
        respond(callback, { error: 'Antwort konnte nicht eingereicht werden.' });
        return;
      }

      respond(callback, { success: true });
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('swap-cards', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      const success = gameState.swapCards(player.id);

      if (!success) {
        respond(callback, { error: 'Kartentausch nicht möglich.' });
        return;
      }

      respond(callback, { success: true });
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('reveal-submission', (index: number, callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      const round = gameState.getCurrentRound();

      if (!round || round.bossId !== player.id) {
        respond(callback, { error: 'Nur der Rundenboss kann Karten aufdecken.' });
        return;
      }

      const success = gameState.revealSubmission(index);
      if (!success) {
        respond(callback, { error: 'Karte konnte nicht aufgedeckt werden.' });
        return;
      }

      respond(callback, { success: true });
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('reveal-all', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      const round = gameState.getCurrentRound();

      if (!round || round.bossId !== player.id) {
        respond(callback, { error: 'Nur der Rundenboss kann Karten aufdecken.' });
        return;
      }

      gameState.revealAllSubmissions();
      respond(callback, { success: true });
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('pick-winner', (payload: PickWinnerPayload, callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      const round = gameState.getCurrentRound();

      if (!round || round.bossId !== player.id) {
        respond(callback, { error: 'Nur der Rundenboss kann den Gewinner wählen.' });
        return;
      }

      const success = gameState.pickWinner(payload.playerId);
      if (!success) {
        respond(callback, { error: 'Gewinner konnte nicht gewählt werden.' });
        return;
      }

      respond(callback, { success: true });
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('next-round', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;

      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      if (gameState.game.phase !== GamePhase.ROUND_END) {
        respond(callback, { error: 'Die nächste Runde kann erst nach Rundenende gestartet werden.' });
        return;
      }

      if (gameState.getCurrentRound()?.bossId !== player.id) {
        respond(callback, { error: 'Nur der aktuelle Rundenboss kann die nächste Runde starten.' });
        return;
      }

      const autoRemovedPlayerNames = gameState.nextRound();
      if (autoRemovedPlayerNames.length > 0) {
        io.to(gameState.game.code).emit('players-auto-removed', { playerNames: autoRemovedPlayerNames });
      }

      respond(callback, { success: true });
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('rematch', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;

      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      if (!player.isHost) {
        respond(callback, { error: 'Nur der Host kann eine Revanche starten.' });
        return;
      }

      if (gameState.game.phase !== GamePhase.GAME_OVER) {
        respond(callback, { error: 'Eine Revanche ist erst nach Spielende möglich.' });
        return;
      }

      const removedPlayerNames = gameState.rematch();
      if (removedPlayerNames.length > 0) {
        io.to(gameState.game.code).emit('players-removed-for-rematch', { playerNames: removedPlayerNames });
      }

      respond(callback, { success: true });
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('kick-player', (payload: KickPlayerPayload, callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;

      if (rejectIfReconnectPaused(gameState, callback)) {
        return;
      }

      if (!player.isHost) {
        respond(callback, { error: 'Nur der Host darf Spieler entfernen.' });
        return;
      }

      if (gameState.game.phase !== GamePhase.LOBBY) {
        respond(callback, { error: 'Spieler können nur in der Lobby entfernt werden.' });
        return;
      }

      if (payload.playerId === player.id) {
        respond(callback, { error: 'Der Host kann sich nicht selbst entfernen.' });
        return;
      }

      const targetPlayer = gameState.getPlayer(payload.playerId);
      if (!targetPlayer) {
        respond(callback, { error: 'Spieler nicht gefunden.' });
        return;
      }

      const targetSocket = targetPlayer.socketId
        ? io.sockets.sockets.get(targetPlayer.socketId)
        : undefined;
      const gameCode = gameState.game.code;

      targetSocket?.leave(gameCode);
      gameState.removePlayer(targetPlayer.id);
      void twitchService.cleanupPlayer(gameCode, targetPlayer.id);

      targetSocket?.emit('kicked', { message: 'Du wurdest aus der Lobby entfernt.' });

      socket.to(gameCode).emit('player-kicked', { playerName: targetPlayer.name });

      respond(callback, { success: true });
      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('leave-game', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { success: true });
        return;
      }

      const { gameState, player } = result;
      const playerName = player.name;
      const gameCode = gameState.game.code;
      const phaseBeforeLeave = gameState.game.phase;

      socket.leave(gameCode);
      gameState.removePlayer(player.id);
      void twitchService.cleanupPlayer(gameCode, player.id);
      socket.to(gameCode).emit('player-left', { playerName });

      respond(callback, { success: true });

      if (gameState.game.players.length === 0) {
        clearPhaseTimer(phaseTimers, gameCode);
        void twitchService.cleanupGame(gameCode);
        gameManager.deleteGame(gameCode);
        return;
      }

      if (gameState.shouldAbortForTooFewPlayers?.(phaseBeforeLeave)) {
        clearPhaseTimer(phaseTimers, gameCode);
        io.to(gameCode).emit('game-aborted', {
          message: `Das Spiel wurde abgebrochen, weil weniger als ${MIN_PLAYERS_TO_START} Spieler übrig sind.`,
        });
        void twitchService.cleanupGame(gameCode);
        gameManager.deleteGame(gameCode);
        return;
      }

      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) return;

      const { gameState, player } = result;
      const playerName = player.name;
      const gameCode = gameState.game.code;

      if (gameState.startReconnectWindow(player.id)) {
        socket.to(gameCode).emit('player-disconnected', {
          playerName,
          reconnectSeconds: RECONNECT_GRACE_SECONDS,
        });
        broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
        return;
      }

      if (!player.isConnected) {
        return;
      }

      gameState.removePlayer(player.id);

      socket.to(gameCode).emit('player-left', {
        playerName,
      });

      if (gameState.game.players.length === 0) {
        clearPhaseTimer(phaseTimers, gameCode);
        void twitchService.cleanupGame(gameCode);
        gameManager.deleteGame(gameCode);
        console.log(`Game ${gameCode} deleted (no players).`);
        return;
      }

      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    });
  });
}

function clearPhaseTimer(phaseTimers: Map<string, ReturnType<typeof setTimeout>>, gameCode: string): void {
  const activeTimer = phaseTimers.get(gameCode);
  if (activeTimer) {
    clearTimeout(activeTimer);
    phaseTimers.delete(gameCode);
  }
}

function schedulePhaseTimer(
  io: Server,
  gameManager: GameManager,
  gameState: any,
  phaseTimers: Map<string, ReturnType<typeof setTimeout>>,
  twitchService: Pick<TwitchService, 'cleanupGame' | 'cleanupPlayer'>,
): void {
  const gameCode = gameState.game.code;
  clearPhaseTimer(phaseTimers, gameCode);

  const reconnectWindow = gameState.getReconnectWindow?.();
  if (reconnectWindow) {
    const expectedPlayerIds = reconnectWindow.players
      .map((player: any) => player.playerId)
      .sort()
      .join('|');
    const expectedDeadline = reconnectWindow.deadline;
    const pausedPhase = reconnectWindow.pausedPhase;
    const waitTime = Math.max(0, reconnectWindow.deadline - Date.now());

    const timer = setTimeout(() => {
      phaseTimers.delete(gameCode);

      const currentReconnectWindow = gameState.getReconnectWindow?.();
      if (!currentReconnectWindow) {
        schedulePhaseTimer(io, gameManager, gameState, phaseTimers, twitchService);
        return;
      }

      if (
        currentReconnectWindow.players
          .map((player: any) => player.playerId)
          .sort()
          .join('|') !== expectedPlayerIds
        || currentReconnectWindow.deadline !== expectedDeadline
      ) {
        schedulePhaseTimer(io, gameManager, gameState, phaseTimers, twitchService);
        return;
      }

      const removedPlayers = gameState.expireReconnectWindow();
      for (const removedPlayer of removedPlayers) {
        void twitchService.cleanupPlayer(gameCode, removedPlayer.playerId);
        io.to(gameCode).emit('player-left', { playerName: removedPlayer.playerName });
      }

      if (gameState.shouldAbortForTooFewPlayers?.(pausedPhase)) {
        io.to(gameCode).emit('game-aborted', {
          message: `Das Spiel wurde abgebrochen, weil nach dem Reconnect-Fenster weniger als ${MIN_PLAYERS_TO_START} Spieler übrig sind.`,
        });
        void twitchService.cleanupGame(gameCode);
        gameManager.deleteGame(gameCode);
        return;
      }

      if (gameState.game.players.length === 0) {
        void twitchService.cleanupGame(gameCode);
        gameManager.deleteGame(gameCode);
        return;
      }

      broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
    }, waitTime);

    phaseTimers.set(gameCode, timer);
    return;
  }

  const round = gameState.getCurrentRound?.();

  const deadline = round?.phaseDeadline;
  if (!deadline) {
    return;
  }

  const expectedPhase = gameState.game.phase;
  const expectedRound = gameState.game.currentRound;
  const waitTime = Math.max(0, deadline - Date.now());

  const timer = setTimeout(() => {
    phaseTimers.delete(gameCode);

    if (gameState.game.phase !== expectedPhase || gameState.game.currentRound !== expectedRound) {
      schedulePhaseTimer(io, gameManager, gameState, phaseTimers, twitchService);
      return;
    }

    const { expiredPhase } = gameState.expireCurrentPhase();
    if (!expiredPhase) {
      return;
    }

    io.to(gameCode).emit('phase-expired', {
      phase: expectedPhase,
      toPhase: gameState.game.phase,
    });
    broadcastState(io, gameManager, gameState, phaseTimers, twitchService);
  }, waitTime);

  phaseTimers.set(gameCode, timer);
}

function broadcastState(
  io: Server,
  gameManager: GameManager,
  gameState: any,
  phaseTimers: Map<string, ReturnType<typeof setTimeout>>,
  twitchService: Pick<TwitchService, 'cleanupGame' | 'cleanupPlayer'>,
): void {
  for (const player of gameState.game.players) {
    if (player.socketId) {
      io.to(player.socketId).emit('game-state', gameState.getClientState(player.id));
    }
  }

  schedulePhaseTimer(io, gameManager, gameState, phaseTimers, twitchService);
}
