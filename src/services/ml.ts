import { child, get, ref, runTransaction, serverTimestamp, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { getWeekKey } from '../lib/time';

async function hashUrl(url: string) {
  const encoder = new TextEncoder();
  const normalized = normalizeUrl(url);
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeUrl(url: string) {
  let clean = url.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, '');
  clean = clean.replace(/^www\./, '');
  clean = clean.split('#')[0];
  clean = clean.split('?')[0];
  return clean;
}

export async function addMlLink({ uid, url, date = new Date() }: { uid: string; url: string; date?: Date }) {
  if (!url) throw new Error('URL obrigatória');
  const key = await hashUrl(url);
  const weekISO = getWeekKey(date);
  const location = ref(db, `ml_links/${weekISO}/${uid}/items/${key}`);

  await runTransaction(location, (current) => {
    if (current) {
      return; // duplicate
    }
    return { url, ts: serverTimestamp() };
  }, { applyLocally: false });

  const snapshot = await get(location);
  if (!snapshot.exists()) {
    throw new Error('Link duplicado na semana.');
  }
}

export async function getMlLinks(uid: string, date = new Date()) {
  const weekISO = getWeekKey(date);
  const snapshot = await get(child(ref(db), `ml_links/${weekISO}/${uid}/items`));
  if (!snapshot.exists()) return [] as { url: string; ts: number }[];
  return Object.values(snapshot.val());
}
