import { child, get, ref, runTransaction } from 'firebase/database';
import { db } from '../lib/firebase';

export async function incrementIG({ uid, dateISO, type, time }: { uid: string; dateISO: string; type: 'posts' | 'stories'; time?: string }) {
  const location = ref(db, `ig_tracking/${dateISO}/${uid}`);
  await runTransaction(location, (current) => {
    const next = current ?? { posts: 0, stories: 0, times: [] as string[] };
    if (next[type] >= (type === 'posts' ? 999 : 999)) {
      return next;
    }
    next[type] = (next[type] ?? 0) + 1;
    if (time) {
      next.times = Array.isArray(next.times) ? [...next.times, time] : [time];
    }
    return next;
  });
}

export async function getIGDay(uid: string, dateISO: string) {
  const snapshot = await get(child(ref(db), `ig_tracking/${dateISO}/${uid}`));
  if (!snapshot.exists()) return { posts: 0, stories: 0 };
  return snapshot.val();
}
