import { child, get, push, ref, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { Sale } from '../types';

function monthKey(date: string) {
  return date.slice(0, 7);
}

export async function addSale(sale: Sale & { orderId?: string }) {
  const month = monthKey(sale.date);
  const location = ref(db, `sales/${month}/${sale.sellerUid}`);
  const node = push(location);
  await set(node, sale);
  return node.key;
}

export async function getSalesByUserMonth(uid: string, month: string) {
  const snapshot = await get(child(ref(db), `sales/${month}/${uid}`));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as Sale[];
}

export async function getAllSalesByMonth(month: string) {
  const snapshot = await get(child(ref(db), `sales/${month}`));
  if (!snapshot.exists()) return {} as Record<string, Sale[]>;
  const data = snapshot.val();
  const result: Record<string, Sale[]> = {};
  Object.entries(data).forEach(([uid, value]) => {
    result[uid] = Object.values(value as Record<string, Sale>);
  });
  return result;
}
