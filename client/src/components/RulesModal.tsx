import { useEffect } from 'react';
import { HAND_SIZE, MAX_PLAYERS, MIN_PLAYERS_TO_START } from '@kgs/game-rules';

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
      'Sobald alle aktiven Nicht-Bosse abgegeben haben, wechselt die Runde automatisch ins Aufdecken.',
    ],
  },
  {
    title: 'Aufdecken und Werten',
    items: [
      'Nur der Rundenboss darf Antworten aufdecken, einzeln oder gesammelt.',
      'Erst nach dem vollständigen Aufdecken darf der Rundenboss die beste Antwort auswählen.',
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
    ],
  },
  {
    title: 'Karten tauschen und Verbindungen',
    items: [
      'Wer mit seiner Hand unzufrieden ist, kann in der Antwortphase alle Karten tauschen und setzt diese Runde aus.',
      'Getauschte Spieler nehmen erst in der nächsten Runde wieder normal teil.',
      'Wenn jemand kurz die Verbindung verliert, kann die Person über dieselbe Browser-Session wieder beitreten.',
      'Getrennte Spieler werden beim Boss-Wechsel übersprungen.',
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