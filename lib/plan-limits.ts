export const FREE_PLAYLIST_LIMIT = 3;
export const FREE_HISTORY_LIMIT = 30;
export const PREMIUM_HISTORY_LIMIT = 1000;

export function canCreatePlaylist(plan: string | undefined, currentCount: number) {
  return plan === "premium" || currentCount < FREE_PLAYLIST_LIMIT;
}

export function historyLimit(plan: string | undefined) {
  return plan === "premium" ? PREMIUM_HISTORY_LIMIT : FREE_HISTORY_LIMIT;
}
