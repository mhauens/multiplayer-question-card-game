import fs from 'fs';
import path from 'path';

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  if (!key) {
    return null;
  }

  const rawValue = trimmed.slice(separatorIndex + 1);
  return {
    key,
    value: stripWrappingQuotes(rawValue),
  };
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  for (const line of fileContent.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (typeof process.env[parsed.key] === 'undefined') {
      process.env[parsed.key] = parsed.value;
    }
  }
}

export function loadLocalEnv(): void {
  const serverDir = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(serverDir, '..');

  const candidateFiles = [
    path.join(repoRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    path.join(serverDir, '.env'),
    path.join(serverDir, '.env.local'),
  ];

  candidateFiles.forEach(loadEnvFile);
}
