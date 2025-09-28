import { child, get, ref, set } from 'firebase/database';
import { db } from '../lib/firebase';

export interface ClosurePayload {
  month: string;
  adesao: { capa: number; impermeabilizacao: number };
  faturamento_sofas: number;
  pontualidade: Record<string, number>;
  mlWeeks: Record<string, number>;
  publishedAt?: number;
  bonus?: Record<string, number>;
}

export async function publishClosure(payload: ClosurePayload) {
  const location = ref(db, `closures/${payload.month}`);
  await set(location, { ...payload, publishedAt: Date.now() });
}

export async function getClosure(month: string) {
  const snapshot = await get(child(ref(db), `closures/${month}`));
  if (!snapshot.exists()) return null;
  return snapshot.val();
}
