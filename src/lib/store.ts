// Findings and updates: Supabase (ASHDODMAP, tables kr_*) with a local fallback,
// so the lab keeps working when the network or the tables are not available.
import { createClient } from '@supabase/supabase-js';
import { editorKey } from './editor';
export { editorKey, captureEditorKey, forgetEditorKey } from './editor';

const URL = 'https://cbhexpybdggwzyakgagd.supabase.co';
const KEY = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3';
export const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

export interface Finding {
  id: string;
  title: string;
  x_key: string;
  y_key: string;
  unit_type: string;
  control_key?: string | null;
  stats: Record<string, number | string | null>;
  summary?: string | null;
  note?: string | null;
  author?: string | null;
  created_at: string;
  local?: boolean;
}

export interface Update { id: string; version: string; title: string; body?: string | null; kind: 'feature' | 'data' | 'fix'; published_at: string }

const LS_LOCAL = 'kr.localFindings';
const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };

export async function whoAmI(): Promise<string | null> {
  const k = editorKey();
  if (!k) return null;
  const { data, error } = await supabase.rpc('kr_editor', { p_key: k });
  return error ? null : (data as string | null);
}

function localFindings(): Finding[] { return safe(() => JSON.parse(localStorage.getItem(LS_LOCAL) || '[]'), []); }
function setLocal(f: Finding[]) { safe(() => localStorage.setItem(LS_LOCAL, JSON.stringify(f)), undefined); }

export async function listFindings(): Promise<{ items: Finding[]; remote: boolean }> {
  const local = localFindings();
  const { data, error } = await supabase.from('kr_findings').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return { items: local, remote: false };
  return { items: [...local, ...(data as Finding[])], remote: true };
}

export async function saveFinding(f: Omit<Finding, 'id' | 'created_at'> & { id?: string }): Promise<{ finding: Finding; where: 'remote' | 'local' }> {
  const k = editorKey();
  if (k) {
    const { data, error } = await supabase.rpc('kr_save_finding', { p_key: k, p_id: f.id ?? crypto.randomUUID(), p_data: f });
    if (!error && data) return { finding: data as Finding, where: 'remote' };
  }
  const finding: Finding = { ...f, id: f.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), local: true };
  setLocal([finding, ...localFindings().filter(x => x.id !== finding.id)]);
  return { finding, where: 'local' };
}

export async function removeFinding(f: Finding): Promise<boolean> {
  if (f.local) { setLocal(localFindings().filter(x => x.id !== f.id)); return true; }
  const k = editorKey();
  if (!k) return false;
  const { error } = await supabase.rpc('kr_remove_finding', { p_key: k, p_id: f.id });
  return !error;
}

export async function listUpdates(): Promise<Update[] | null> {
  const { data, error } = await supabase.from('kr_updates').select('*').order('published_at', { ascending: false }).limit(50);
  return error ? null : (data as Update[]);
}

export async function saveUpdate(u: Partial<Update>): Promise<boolean> {
  const k = editorKey();
  if (!k) return false;
  const { error } = await supabase.rpc('kr_save_update', { p_key: k, p_id: u.id ?? crypto.randomUUID(), p_data: u });
  return !error;
}
