const KEY = "delfee_recent_searches"
const MAX = 6

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function addRecentSearch(term: string): void {
  if (typeof window === "undefined") return
  const t = term.trim()
  if (!t) return
  try {
    const existing = getRecentSearches().filter(
      (s) => s.toLowerCase() !== t.toLowerCase()
    )
    const next = [t, ...existing].slice(0, MAX)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore storage errors */
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore storage errors */
  }
}
