import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { GamePhase } from '../types';
import QuestionCard from '../components/QuestionCard';
import PlayerHand from '../components/PlayerHand';
import SubmittedAnswers from '../components/SubmittedAnswers';
import Scoreboard from '../components/Scoreboard';
import GameOver from '../components/GameOver';
import RulesModal from '../components/RulesModal';
import ShareAccessPanel from '../components/ShareAccessPanel';
import '../styles/game.css';

export default function Game() {
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const navigate = useNavigate();
  const {
    gameState,
    submitAnswer,
    swapCards,
    revealSubmission,
    revealAll,
    pickWinner,
    nextRound,
    leaveGame,
  } = useGame();

  if (!gameState) return null;

  const isBoss = gameState.myId === gameState.bossId;
  const me = gameState.players.find(p => p.id === gameState.myId);
  const boss = gameState.players.find(p => p.id === gameState.bossId);
  const blanksNeeded = gameState.currentQuestion?.blanks || 1;

  const handleLeave = () => {
    leaveGame();
    navigate('/');
  };

  if (gameState.phase === GamePhase.GAME_OVER) {
    return (
      <GameOver
        players={gameState.players}
        winnerId={gameState.winnerId}
        winnerName={gameState.winnerName}
        myId={gameState.myId}
        onLeave={handleLeave}
      />
    );
  }

  const submittedCount = gameState.submissions.length;
  const expectedCount = gameState.players.filter(
    p => p.id !== gameState.bossId && p.isConnected && !p.swappedThisRound
  ).length;

  const isRoundEnd = gameState.phase === GamePhase.ROUND_END;
  const canStartNextRound = isRoundEnd && isBoss;

  const phaseLabel = () => {
    switch (gameState.phase) {
      case GamePhase.SUBMITTING:
        return isBoss
          ? `Warte auf Antworten (${submittedCount}/${expectedCount})`
          : 'Wähle deine Antwort!';
      case GamePhase.REVEALING:
        return isBoss ? 'Decke die Antworten auf!' : 'Antworten werden aufgedeckt...';
      case GamePhase.JUDGING:
        return isBoss ? 'Wähle die beste Antwort!' : 'Der Rundenboss entscheidet...';
      case GamePhase.ROUND_END:
        return gameState.winnerName
          ? `${gameState.winnerName} gewinnt die Runde!`
          : 'Runde beendet!';
      default:
        return '';
    }
  };

  return (
    <div className="game-page">
      <div className="game-header">
        <div className="game-header-left">
          <span className="game-round">Runde {gameState.currentRound}</span>
          <span className="game-phase">{phaseLabel()}</span>
        </div>
        <div className="game-header-right">
          <button className="btn btn-text game-header-link" onClick={() => setIsRulesOpen(true)}>
            Regeln
          </button>
          <span className="boss-label">
            👑 Boss: <strong>{boss?.name || '?'}</strong>
          </span>
        </div>
      </div>

      <div className="game-layout">
        <div className="game-main">
          {/* Question card */}
          {gameState.currentQuestion && (
            <div className="question-section">
              <QuestionCard
                card={gameState.currentQuestion}
                submittedAnswers={
                  isRoundEnd && gameState.winnerId
                    ? gameState.submissions
                        .find(s => s.playerId === gameState.winnerId)
                        ?.cards
                    : undefined
                }
              />
            </div>
          )}

          {/* Submitted answers (visible during revealing/judging/round-end) */}
          {(gameState.phase === GamePhase.REVEALING ||
            gameState.phase === GamePhase.JUDGING ||
            gameState.phase === GamePhase.ROUND_END) && (
            <SubmittedAnswers
              submissions={gameState.submissions}
              isBoss={isBoss}
              phase={gameState.phase}
              onReveal={revealSubmission}
              onRevealAll={revealAll}
              onPickWinner={pickWinner}
            />
          )}

          {/* Next round button */}
          {canStartNextRound && (
            <div className="next-round-section">
              <button className="btn btn-primary btn-large" onClick={nextRound}>
                Nächste Runde →
              </button>
            </div>
          )}

          {isRoundEnd && !isBoss && (
            <div className="next-round-section">
              <div className="round-waiting-info">
                Warte auf den Rundenboss, damit die nächste Runde gestartet wird.
              </div>
            </div>
          )}

          {/* Player hand (during submitting phase) */}
          {gameState.phase === GamePhase.SUBMITTING && (
            <PlayerHand
              cards={gameState.myHand}
              blanksNeeded={blanksNeeded}
              onSubmit={submitAnswer}
              onSwap={swapCards}
              disabled={false}
              hasSubmitted={me?.hasSubmitted || false}
              isBoss={isBoss}
              swappedThisRound={me?.swappedThisRound || false}
            />
          )}
        </div>

        <div className="game-sidebar">
          <Scoreboard
            players={gameState.players}
            myId={gameState.myId}
            bossId={gameState.bossId}
            maxTrophies={gameState.maxTrophies}
          />
          <ShareAccessPanel code={gameState.code} className="game-share-panel" />
          <button className="btn btn-text btn-small game-leave" onClick={handleLeave}>
            Spiel verlassen
          </button>
        </div>
      </div>

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}
