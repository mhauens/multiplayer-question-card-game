import { useEffect } from 'react';
import {
  BOSS_PHASE_TIMER_SECONDS,
  HAND_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  RECONNECT_GRACE_SECONDS,
  SUBMIT_TIMER_SECONDS,
} from '@kgs/game-rules';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const rulesSections = [
  {
    title: 'Lobby und Start',
    items: [
      'Eine Person erstellt als Host die Lobby und teilt Code oder Einladungslink.',
      `Gespielt wird online mit ${MIN_PLAYERS_TO_START} bis ${MAX_PLAYERS} Personen.`,
      'Der Host legt beim Erstellen fest, wie viele Trophäen zum Sieg nötig sind.',
      `Sobald mindestens ${MIN_PLAYERS_TO_START} Spieler in der Lobby sind, kann der Host das Spiel starten.`,
    ],
  },
  {
    title: 'Rundenablauf',
    items: [
      `Zu Beginn erhält jeder automatisch ${HAND_SIZE} Antwortkarten auf die Hand.`,
      'Der aktuelle Rundenboss bekommt die Fragekarte, alle anderen wählen digital ihre passende Antwort.',
      'Bei mehreren Lücken müssen genau so viele Antwortkarten ausgewählt werden wie die Frage verlangt.',
      `Sobald alle aktiven Nicht-Bosse abgegeben haben oder ${SUBMIT_TIMER_SECONDS} Sekunden vorbei sind, wechselt die Runde automatisch ins Aufdecken.`,
    ],
  },
  {
    title: 'Aufdecken und Werten',
    items: [
      `Nur der Rundenboss darf Antworten aufdecken, einzeln oder gesammelt. Dafür bleiben ${BOSS_PHASE_TIMER_SECONDS} Sekunden Zeit.`,
      `Erst nach dem vollständigen Aufdecken darf der Rundenboss die beste Antwort auswählen. Auch dafür bleiben ${BOSS_PHASE_TIMER_SECONDS} Sekunden Zeit.`,
      'Die Antworten bleiben bis zur Entscheidung anonym und die Reihenfolge wird gemischt.',
      'Der Gewinner der Runde erhält 1 Trophäe.',
    ],
  },
  {
    title: 'Nächste Runde',
    items: [
      `Nach jeder Runde werden die Hände automatisch wieder auf ${HAND_SIZE} Karten aufgefüllt.`,
      'Nur der aktuelle Rundenboss kann die nächste Runde starten.',
      'Der Boss wechselt dann automatisch zum nächsten verbundenen Spieler.',
      'Nach Spielende kann der Host direkt eine Revanche mit denselben verbundenen Spielern starten.',
    ],
  },
  {
    title: 'Karten tauschen und Verbindungen',
    items: [
      'Wer mit seiner Hand unzufrieden ist, kann in der Antwortphase alle Karten tauschen und setzt diese Runde aus.',
      'Getauschte Spieler nehmen erst in der nächsten Runde wieder normal teil.',
      `Wenn jemand im laufenden Spiel die Verbindung verliert, pausiert die Partie bis zu ${RECONNECT_GRACE_SECONDS} Sekunden für einen Reconnect.`,
      'Wenn der Reconnect in dieser Zeit nicht klappt oder jemand aktiv das Spiel verlässt, wird die Person aus der Partie entfernt.',
      `Fallen danach im laufenden Spiel weniger als ${MIN_PLAYERS_TO_START} Spieler an, wird die Partie für alle abgebrochen.`,
      'In der Lobby kann der Host andere Spieler aus der Runde entfernen.',
    ],
  },
  {
    title: 'Twitch Community-Voting',
    items: [
      'Community-Voting ist optional, pro Spieler getrennt und immer nur eine Empfehlung.',
      'Vor dem Twitch-OAuth erscheint ein Privacy-Hinweis, damit der Login nicht versehentlich im Stream sichtbar ist.',
      'Es wird nur der minimale Twitch-Zugriff zum Lesen von Chat-Nachrichten des eigenen Kanals angefordert.',
      'Nur Stimmen im Format !card <nummer> zählen, und bei Shared Chat werden nur Stimmen aus der eigenen Community gewertet.',
      'Während einer Reconnect-Pause bleiben bestehende Tallies eingefroren und es werden keine neuen Stimmen ausgewertet.',
    ],
  },
  {
    title: 'Sieg',
    items: [
      'Sobald jemand die vorher festgelegte Zahl an Trophäen erreicht, endet das Spiel sofort.',
      'Falls keine Fragekarten mehr übrig sind, endet das Spiel ebenfalls.',
    ],
  },
];

export default function RulesModal({ isOpen, onClose }: RulesModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="rules-modal-overlay" onClick={onClose}>
      <div
        className="rules-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rules-modal-header">
          <div>
            <p className="rules-modal-eyebrow">Kurzfassung</p>
            <h2 id="rules-modal-title">Spielregeln</h2>
          </div>
          <button className="btn btn-text rules-modal-close" onClick={onClose} aria-label="Regeln schließen">
            ✕
          </button>
        </div>

        <div className="rules-modal-content">
          <p className="rules-modal-intro">
            Diese Kurzfassung beschreibt die Online-Variante in dieser App.
          </p>

          <div className="rules-sections">
            {rulesSections.map((section) => (
              <section key={section.title} className="rules-section">
                <h3>{section.title}</h3>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}