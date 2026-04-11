import { Server, Socket } from 'socket.io';
import { GameManager } from '../game/GameManager';
import {
  CardCatalogOption,
  CreateGamePayload,
  ExtensionCatalogOption,
  JoinGamePayload,
  SubmitAnswerPayload,
  PickWinnerPayload,
  RejoinPayload,
} from '../types';

type Ack = ((response: any) => void) | undefined;

function respond(callback: Ack, response: any): void {
  if (typeof callback === 'function') {
    callback(response);
  }
}

export function registerSocketHandlers(io: Server, gameManager: GameManager): void {
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

    socket.on('create-game', (payload: CreateGamePayload, callback?: (response: any) => void) => {
      const { playerName, maxTrophies, variant, extensions } = payload;

      if (!playerName || playerName.trim().length === 0) {
        respond(callback, { error: 'Name darf nicht leer sein.' });
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

      const result = gameManager.createGame(playerName.trim(), maxTrophies, selectedVariant, selectedExtensions);
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
      const { gameCode, playerName } = payload;

      if (!playerName || playerName.trim().length === 0) {
        respond(callback, { error: 'Name darf nicht leer sein.' });
        return;
      }

      if (!gameCode || gameCode.trim().length === 0) {
        respond(callback, { error: 'Spielcode darf nicht leer sein.' });
        return;
      }

      const result = gameManager.joinGame(gameCode.trim(), playerName.trim());
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
      broadcastState(io, gameState);
    });

    socket.on('rejoin-game', (payload: RejoinPayload, callback?: (response: any) => void) => {
      const { gameCode, playerId } = payload;
      const result = gameManager.rejoinGame(gameCode, playerId);

      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden oder Spieler nicht vorhanden.' });
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

      socket.to(gameState.game.code).emit('player-reconnected', {
        playerName: player.name,
      });

      broadcastState(io, gameState);
    });

    socket.on('start-game', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;

      if (!player.isHost) {
        respond(callback, { error: 'Nur der Host kann das Spiel starten.' });
        return;
      }

      if (!gameState.canStart()) {
        respond(callback, { error: 'Mindestens 3 Spieler werden benötigt.' });
        return;
      }

      gameState.startGame();
      respond(callback, { success: true });
      broadcastState(io, gameState);
    });

    socket.on('submit-answer', (payload: SubmitAnswerPayload, callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      const success = gameState.submitAnswer(player.id, payload.cardIds);

      if (!success) {
        respond(callback, { error: 'Antwort konnte nicht eingereicht werden.' });
        return;
      }

      respond(callback, { success: true });
      broadcastState(io, gameState);
    });

    socket.on('swap-cards', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      const success = gameState.swapCards(player.id);

      if (!success) {
        respond(callback, { error: 'Kartentausch nicht möglich.' });
        return;
      }

      respond(callback, { success: true });
      broadcastState(io, gameState);
    });

    socket.on('reveal-submission', (index: number, callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
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
      broadcastState(io, gameState);
    });

    socket.on('reveal-all', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
      const round = gameState.getCurrentRound();

      if (!round || round.bossId !== player.id) {
        respond(callback, { error: 'Nur der Rundenboss kann Karten aufdecken.' });
        return;
      }

      gameState.revealAllSubmissions();
      respond(callback, { success: true });
      broadcastState(io, gameState);
    });

    socket.on('pick-winner', (payload: PickWinnerPayload, callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;
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
      broadcastState(io, gameState);
    });

    socket.on('next-round', (callback?: (response: any) => void) => {
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) {
        respond(callback, { error: 'Spiel nicht gefunden.' });
        return;
      }

      const { gameState, player } = result;

      if (gameState.getCurrentRound()?.bossId !== player.id) {
        respond(callback, { error: 'Nur der aktuelle Rundenboss kann die nächste Runde starten.' });
        return;
      }

      gameState.nextRound();
      respond(callback, { success: true });
      broadcastState(io, gameState);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      const result = gameManager.findGameBySocketId(socket.id);
      if (!result) return;

      const { gameState, player } = result;
      player.isConnected = false;
      player.socketId = null;

      socket.to(gameState.game.code).emit('player-disconnected', {
        playerName: player.name,
      });

      broadcastState(io, gameState);

      // If all players disconnected, start cleanup timer
      if (gameState.getConnectedPlayerCount() === 0) {
        setTimeout(() => {
          if (gameState.getConnectedPlayerCount() === 0) {
            gameManager.deleteGame(gameState.game.code);
            console.log(`Game ${gameState.game.code} deleted (no players).`);
          }
        }, 60 * 60 * 1000); // 1 hour
      }
    });
  });
}

function broadcastState(io: Server, gameState: any): void {
  for (const player of gameState.game.players) {
    if (player.socketId) {
      io.to(player.socketId).emit('game-state', gameState.getClientState(player.id));
    }
  }
}
