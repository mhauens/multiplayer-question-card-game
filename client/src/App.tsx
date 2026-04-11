import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import { GamePhase } from './types';

function GameRouter() {
  const { gameState, error, toast, isConnected, isRestoringSession } = useGame();

  if (isRestoringSession) {
    return (
      <div className="connection-bar">
        Stelle Spielsession wieder her...
      </div>
    );
  }

  return (
    <>
      {/* Connection indicator */}
      {!isConnected && (
        <div className="connection-bar">
          Verbindung zum Server wird hergestellt...
        </div>
      )}

      {/* Toast notifications */}
      {toast && <div className="toast">{toast}</div>}

      {/* Error messages */}
      {error && <div className="error-bar">{error}</div>}

      <Routes>
        <Route path="/" element={
          gameState ? (
            gameState.phase === GamePhase.LOBBY
              ? <Navigate to="/lobby" replace />
              : <Navigate to="/game" replace />
          ) : (
            <Home />
          )
        } />
        <Route path="/join" element={<Home />} />
        <Route path="/join/:code" element={<Home />} />
        <Route path="/lobby" element={
          gameState && gameState.phase === GamePhase.LOBBY ? <Lobby /> : <Navigate to="/" replace />
        } />
        <Route path="/lobby/:code" element={<Navigate to="/lobby" replace />} />
        <Route path="/game" element={
          gameState && gameState.phase !== GamePhase.LOBBY ? <Game /> : <Navigate to="/" replace />
        } />
        <Route path="/game/:code" element={<Navigate to="/game" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <GameRouter />
      </GameProvider>
    </BrowserRouter>
  );
}
