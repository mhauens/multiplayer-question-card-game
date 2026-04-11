import { Card, CardCatalogOption, CardSet, ExtensionCatalogOption } from '../types';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface CardSetFileGroup {
  baseName: string;
  combined?: string;
  questions?: string;
  answers?: string;
}

export class CardDeck {
  private allCards: Map<string, Card> = new Map();
  private availableVariants: CardCatalogOption[] = [];
  private variantNames: Set<string> = new Set();
  private availableExtensions: ExtensionCatalogOption[] = [];

  constructor() {
    this.loadBaseVariant();
    this.loadVariants();
    this.loadExtensions();
  }

  private loadBaseVariant(): void {
    const dataDir = path.join(__dirname, '../../data');
    const baseSet = this.loadCardSetFromFiles(
      path.join(dataDir, 'base-questions.json'),
      path.join(dataDir, 'base-answers.json'),
      'base'
    );

    if (baseSet) {
      baseSet.title = baseSet.title || 'Basic';
      baseSet.description = baseSet.description || 'Der klassische Kartensatz mit dem normalen Spiessertum-Humor.';
      this.registerVariant(baseSet);
    }
  }

  private loadVariants(): void {
    const variantDir = path.join(__dirname, '../../data/variants');
    if (!fs.existsSync(variantDir)) return;

    this.loadCardSetsFromDirectory(variantDir, (cardSet) => {
      this.registerVariant(cardSet);
    }, 'variant');
  }

  private loadExtensions(): void {
    const extDir = path.join(__dirname, '../../data/extensions');
    if (!fs.existsSync(extDir)) return;

    this.loadCardSetsFromDirectory(extDir, (cardSet) => {
      this.registerExtension(cardSet);
    }, 'extension');
  }

  private loadCardSetsFromDirectory(
    dirPath: string,
    register: (cardSet: CardSet) => void,
    label: 'variant' | 'extension'
  ): void {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    const groups = new Map<string, CardSetFileGroup>();

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        groups.set(entry.name, {
          baseName: entry.name,
          questions: path.join(fullPath, 'questions.json'),
          answers: path.join(fullPath, 'answers.json'),
        });
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      const baseName = this.resolveCardSetBaseName(entry.name);
      const group = groups.get(baseName) || { baseName };

      if (entry.name.endsWith('-questions.json')) {
        group.questions = fullPath;
      } else if (entry.name.endsWith('-answers.json')) {
        group.answers = fullPath;
      } else {
        group.combined = fullPath;
      }

      groups.set(baseName, group);
    }

    for (const [baseName, group] of groups) {
      try {
        const cardSet = group.combined
          ? this.readCardSetFile(group.combined, baseName)
          : this.loadCardSetFromFiles(group.questions, group.answers, baseName);

        if (!cardSet) {
          continue;
        }

        register(cardSet);
      } catch (e) {
        console.error(`Failed to load ${label} ${baseName}:`, e);
      }
    }
  }

  private loadCardSetFromFiles(
    questionsPath?: string,
    answersPath?: string,
    fallbackName?: string
  ): CardSet | null {
    const questionsData = questionsPath && fs.existsSync(questionsPath)
      ? this.readCardSetFile(questionsPath, fallbackName)
      : null;
    const answersData = answersPath && fs.existsSync(answersPath)
      ? this.readCardSetFile(answersPath, fallbackName)
      : null;

    if (!questionsData && !answersData) {
      return null;
    }

    const name = questionsData?.name || answersData?.name || fallbackName;
    if (!name) {
      throw new Error('Card set name is missing.');
    }

    return {
      name,
      title: questionsData?.title || answersData?.title,
      description: questionsData?.description || answersData?.description,
      variants: questionsData?.variants || answersData?.variants,
      questions: questionsData?.questions || [],
      answers: answersData?.answers || [],
    };
  }

  private readCardSetFile(filePath: string, fallbackName?: string): CardSet {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<CardSet>;
    const name = typeof parsed.name === 'string' && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : fallbackName;

    if (!name) {
      throw new Error(`Card set in ${path.basename(filePath)} is missing a name.`);
    }

    return {
      name,
      title: parsed.title,
      description: parsed.description,
      variants: Array.isArray(parsed.variants) ? parsed.variants : undefined,
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      answers: Array.isArray(parsed.answers) ? parsed.answers : [],
    };
  }

  private resolveCardSetBaseName(fileName: string): string {
    if (fileName.endsWith('-questions.json')) {
      return fileName.slice(0, -'-questions.json'.length);
    }

    if (fileName.endsWith('-answers.json')) {
      return fileName.slice(0, -'-answers.json'.length);
    }

    return fileName.slice(0, -'.json'.length);
  }

  private registerVariant(cardSet: CardSet): void {
    this.registerCardSet(cardSet);
    this.variantNames.add(cardSet.name);
    this.availableVariants.push({
      id: cardSet.name,
      title: cardSet.title || this.formatSetName(cardSet.name),
      description: cardSet.description || 'Eigenes Kartenset.',
      questionCount: cardSet.questions.length,
      answerCount: cardSet.answers.length,
      extensions: [],
    });
  }

  private registerExtension(cardSet: CardSet): void {
    this.registerCardSet(cardSet);
    const variants = this.resolveExtensionVariants(cardSet);
    const extensionOption: ExtensionCatalogOption = {
      id: cardSet.name,
      title: cardSet.title || this.formatSetName(cardSet.name),
      description: cardSet.description || 'Optionale Erweiterung fuer dieses Kartenset.',
      questionCount: cardSet.questions.length,
      answerCount: cardSet.answers.length,
      variants,
    };

    this.availableExtensions.push(extensionOption);

    for (const variantId of variants) {
      const variant = this.availableVariants.find(option => option.id === variantId);
      if (variant) {
        variant.extensions.push({ ...extensionOption, variants: [...variants] });
      }
    }
  }

  private registerCardSet(cardSet: CardSet): void {
    for (const q of cardSet.questions) {
      const card: Card = {
        id: randomUUID(),
        type: 'question',
        text: q.text,
        blanks: q.blanks,
        extension: cardSet.name,
      };
      this.allCards.set(card.id, card);
    }
    for (const answerText of cardSet.answers) {
      const card: Card = {
        id: randomUUID(),
        type: 'answer',
        text: answerText,
        blanks: 0,
        extension: cardSet.name,
      };
      this.allCards.set(card.id, card);
    }
  }

  getCard(id: string): Card | undefined {
    return this.allCards.get(id);
  }

  hasVariant(variant: string): boolean {
    return this.variantNames.has(variant);
  }

  getAvailableVariants(): CardCatalogOption[] {
    return this.availableVariants.map((variant) => ({
      ...variant,
      extensions: variant.extensions.map((extension) => ({
        ...extension,
        variants: [...extension.variants],
      })),
    }));
  }

  getAvailableExtensions(): ExtensionCatalogOption[] {
    return this.availableExtensions.map((extension) => ({
      ...extension,
      variants: [...extension.variants],
    }));
  }

  getValidExtensionsForVariant(variant: string, extensions: string[]): string[] {
    const selectedVariant = this.hasVariant(variant) ? variant : 'base';
    const allowedExtensions = new Set(
      this.availableExtensions
        .filter((extension) => extension.variants.includes(selectedVariant))
        .map((extension) => extension.id)
    );

    const validExtensions: string[] = [];
    for (const extensionId of extensions) {
      if (!allowedExtensions.has(extensionId) || validExtensions.includes(extensionId)) {
        continue;
      }

      validExtensions.push(extensionId);
    }

    return validExtensions;
  }

  createDecks(variant: string, extensions: string[]): { questionDeck: string[]; answerDeck: string[] } {
    const selectedVariant = this.hasVariant(variant) ? variant : 'base';
    const validExtensions = this.getValidExtensionsForVariant(selectedVariant, extensions);
    const validSources = new Set([selectedVariant, ...validExtensions]);
    const questionDeck: string[] = [];
    const answerDeck: string[] = [];

    for (const [id, card] of this.allCards) {
      if (!validSources.has(card.extension)) continue;
      if (card.type === 'question') {
        questionDeck.push(id);
      } else {
        answerDeck.push(id);
      }
    }

    this.shuffle(questionDeck);
    this.shuffle(answerDeck);

    return { questionDeck, answerDeck };
  }

  private shuffle(arr: string[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private formatSetName(name: string): string {
    return name
      .split('-')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private resolveExtensionVariants(cardSet: CardSet): string[] {
    const configuredVariants = Array.isArray(cardSet.variants) && cardSet.variants.length > 0
      ? cardSet.variants
      : ['base'];

    const uniqueVariants: string[] = [];
    for (const variantId of configuredVariants) {
      if (!this.hasVariant(variantId) || uniqueVariants.includes(variantId)) {
        continue;
      }

      uniqueVariants.push(variantId);
    }

    return uniqueVariants;
  }
}
