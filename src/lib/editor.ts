// Editor key handling, kept apart from the Supabase client so the first page loads light.
const LS_KEY = 'kr.editorKey';
const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };

export function editorKey(): string | null {
  return safe(() => localStorage.getItem(LS_KEY), null);
}

/** `?edit=<key>` in the address stores the key once and removes it from the address bar. */
export function captureEditorKey() {
  const u = new window.URL(window.location.href);
  const k = u.searchParams.get('edit');
  if (k) {
    safe(() => localStorage.setItem(LS_KEY, k), undefined);
    u.searchParams.delete('edit');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
}

export function forgetEditorKey() { safe(() => localStorage.removeItem(LS_KEY), undefined); }

