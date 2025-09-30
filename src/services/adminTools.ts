import { child, get, ref, update } from 'firebase/database';
import { format } from 'date-fns';
import { db } from '../lib/firebase';
import { formatDate, getWeekKey } from '../lib/time';

type MlTimestamp = number | string | { seconds?: number; nanoseconds?: number } | { toMillis: () => number } | null | undefined;

function extractMlTimestamp(value: MlTimestamp): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const toMillis = record['toMillis'];
    if (typeof toMillis === 'function') {
      return (toMillis as () => number)();
    }
    const seconds = record['seconds'];
    if (typeof seconds === 'number') {
      return seconds * 1000;
    }
  }
  return null;
}

function countDaysInMonth(month: string) {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const result: string[] = [];
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return result;
  }
  const date = new Date(Date.UTC(year, monthIndex, 1));
  while (date.getUTCMonth() === monthIndex) {
    result.push(format(date, 'yyyy-MM-dd'));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return result;
}

function filterSalesByDate(data: Record<string, any>, date: string) {
  const remaining: Record<string, any> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!value) {
      return;
    }
    const rawDate = value.date;
    if (typeof rawDate !== 'string') {
      remaining[key] = value;
      return;
    }
    const normalized = rawDate.length >= 10 ? rawDate.slice(0, 10) : rawDate;
    if (normalized !== date) {
      remaining[key] = value;
    }
  });
  return remaining;
}

function filterMlItemsByDate(data: Record<string, any>, date: string) {
  const remaining: Record<string, any> = {};
  Object.entries(data).forEach(([key, value]) => {
    const timestamp = extractMlTimestamp(value?.ts);
    if (timestamp === null) {
      remaining[key] = value;
      return;
    }
    const itemDate = formatDate(new Date(timestamp), 'yyyy-MM-dd');
    if (itemDate !== date) {
      remaining[key] = value;
    }
  });
  return remaining;
}

export async function resetUserDay({ uid, date }: { uid: string; date: string }) {
  const updates: Record<string, any> = {};
  const month = date.slice(0, 7);

  const salesSnapshot = await get(child(ref(db), `sales/${month}/${uid}`));
  if (salesSnapshot.exists()) {
    const remaining = filterSalesByDate(salesSnapshot.val() as Record<string, any>, date);
    if (Object.keys(remaining).length === 0) {
      updates[`sales/${month}/${uid}`] = null;
    } else {
      updates[`sales/${month}/${uid}`] = remaining;
    }
  }

  updates[`ig_tracking/${date}/${uid}`] = null;

  const weekKey = getWeekKey(new Date(`${date}T00:00:00`));
  const mlSnapshot = await get(child(ref(db), `ml_links/${weekKey}/${uid}/items`));
  if (mlSnapshot.exists()) {
    const remaining = filterMlItemsByDate(mlSnapshot.val() as Record<string, any>, date);
    if (Object.keys(remaining).length === 0) {
      updates[`ml_links/${weekKey}/${uid}`] = null;
    } else {
      updates[`ml_links/${weekKey}/${uid}/items`] = remaining;
    }
  }

  await update(ref(db), updates);
}

export async function resetUserMonth({ uid, month }: { uid: string; month: string }) {
  const updates: Record<string, any> = {};
  updates[`sales/${month}/${uid}`] = null;

  const days = countDaysInMonth(month);
  const uniqueWeeks = new Set<string>();
  days.forEach((day) => {
    updates[`ig_tracking/${day}/${uid}`] = null;
    uniqueWeeks.add(getWeekKey(new Date(`${day}T00:00:00`)));
  });

  uniqueWeeks.forEach((weekKey) => {
    updates[`ml_links/${weekKey}/${uid}`] = null;
  });

  await update(ref(db), updates);
}
