import { child, get, ref, runTransaction, serverTimestamp } from 'firebase/database';
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

export async function getMlLinks(uid: string, date = new Date()): Promise<{ url: string; ts: number }[]> {
  const weekISO = getWeekKey(date);
  const snapshot = await get(child(ref(db), `ml_links/${weekISO}/${uid}/items`));
  if (!snapshot.exists()) return [] as { url: string; ts: number }[];
  return Object.values(snapshot.val());
}

type MlLinkItemsNode = Record<string, { url?: unknown; ts?: unknown }>;

type MlLinksWeekNode = Record<string, { items?: MlLinkItemsNode } | null | undefined>;

export type MlLinkRecord = {
  id: string;
  url: string;
  ts: number;
};

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object') {
    const maybeToMillis = (value as { toMillis?: unknown }).toMillis;
    if (typeof maybeToMillis === 'function') {
      const result = maybeToMillis();
      return typeof result === 'number' && Number.isFinite(result) ? result : null;
    }
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return seconds * 1000;
    }
  }
  return null;
}

export async function getAllMlLinks(): Promise<Record<string, Record<string, MlLinkRecord[]>>> {
  const snapshot = await get(child(ref(db), 'ml_links'));
  if (!snapshot.exists()) {
    return {};
  }

  const raw = snapshot.val() as Record<string, MlLinksWeekNode>;
  const result: Record<string, Record<string, MlLinkRecord[]>> = {};

  Object.entries(raw).forEach(([weekKey, weekNode]) => {
    if (!weekNode || typeof weekNode !== 'object') {
      return;
    }

    const weekResult: Record<string, MlLinkRecord[]> = {};

    Object.entries(weekNode).forEach(([uid, userNode]) => {
      if (!userNode || typeof userNode !== 'object') {
        return;
      }

      const itemsNode = (userNode as { items?: MlLinkItemsNode }).items;
      if (!itemsNode || typeof itemsNode !== 'object') {
        return;
      }

      const items: MlLinkRecord[] = [];

      Object.entries(itemsNode).forEach(([id, value]) => {
        if (!value || typeof value !== 'object') {
          return;
        }

        const rawUrl = (value as { url?: unknown }).url;
        if (typeof rawUrl !== 'string') {
          return;
        }

        const url = rawUrl.trim();
        if (!url) {
          return;
        }

        const ts = normalizeTimestamp((value as { ts?: unknown }).ts) ?? 0;
        items.push({ id, url, ts });
      });

      if (items.length > 0) {
        weekResult[uid] = items;
      }
    });

    if (Object.keys(weekResult).length > 0) {
      result[weekKey] = weekResult;
    }
  });

  return result;
}

