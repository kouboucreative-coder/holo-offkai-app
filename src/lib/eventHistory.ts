// lib/eventHistory.ts
// localStorage を使ったイベント閲覧履歴のユーティリティ

const HISTORY_KEY = "offkai_viewed_events";
const MAX_HISTORY = 3;

/** イベントIDを閲覧履歴に保存（重複なし・最大3件） */
export function saveEventToHistory(eventId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: string[] = raw ? JSON.parse(raw) : [];
    const updated = [eventId, ...history.filter((id) => id !== eventId)].slice(
      0,
      MAX_HISTORY
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* noop */
  }
}

/** 閲覧履歴のイベントIDリストを取得 */
export function getEventHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
