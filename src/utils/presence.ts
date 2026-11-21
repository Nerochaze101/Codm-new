export function formatLastSeen(timestamp?: number | null, nowMs: number = Date.now()): string {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Offline';
  }

  const diffMs = Math.max(0, nowMs - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return 'Last seen just now';
  }
  if (diffMin < 60) {
    return `Last seen ${diffMin}m ago`;
  }
  if (diffHr < 24) {
    return `Last seen ${diffHr}h ago`;
  }
  if (diffDay === 1) {
    const t = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Last seen yesterday at ${t}`;
  }
  if (diffDay < 7) {
    return `Last seen ${diffDay}d ago`;
  }

  const dateStr = new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  const timeStr = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Last seen ${dateStr}, ${timeStr}`;
}

export function formatReadTime(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
