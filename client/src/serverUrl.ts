export function resolveServerUrl(): string {
  const configuredUrl = import.meta.env.VITE_SERVER_URL;
  if (typeof configuredUrl === 'string' && configuredUrl.trim().length > 0) {
    return configuredUrl.trim();
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return '';
}