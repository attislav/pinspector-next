// Shared formatting utilities (de-DE locale)

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('de-DE').format(num);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function formatPinDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function formatDateShort(date: string): string {
  return new Date(date).toLocaleDateString('de-DE');
}
