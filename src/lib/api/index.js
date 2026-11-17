import * as remote from './supabaseApi.js';
import * as local from './localApi.js';

export const hasSupabase = Boolean(remote.supabase);

export function getMode() {
  try {
    if (!hasSupabase || localStorage.getItem('ascent-mode') === 'demo') return 'demo';
  } catch { return 'demo'; }
  return 'live';
}

export function setMode(mode) {
  try {
    if (mode === 'demo') localStorage.setItem('ascent-mode', 'demo');
    else localStorage.removeItem('ascent-mode');
  } catch { /* ignore */ }
}

export const api = getMode() === 'demo' ? local : remote;
