import { child, get, push, ref, set, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { Sale } from '../types';

export interface SaleRecord extends Sale {
  id: string;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

export async function addSale(sale: Sale & { orderId?: string }) {
  const month = monthKey(sale.date);
  const location = ref(db, `sales/${month}/${sale.sellerUid}`);
  const node = push(location);
  const payload: Sale = {
    ...sale,
    gross: sale.gross,
    serviceOnly: sale.serviceOnly,
    createdAt: sale.createdAt ?? new Date().toISOString()
  };
  await set(node, payload);
  return node.key;
}

export async function getSalesByUserMonth(uid: string, month: string): Promise<SaleRecord[]> {
  const snapshot = await get(child(ref(db), `sales/${month}/${uid}`));
  if (!snapshot.exists()) return [];
  const data = snapshot.val() as Record<string, Sale>;
  return Object.entries(data).map(([id, value]) => ({ id, ...value }));
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

export async function updateSale({ uid, month, saleId, data }: { uid: string; month: string; saleId: string; data: Sale }) {
  await set(ref(db, `sales/${month}/${uid}/${saleId}`), data);
}

export async function deleteSale({ uid, month, saleId }: { uid: string; month: string; saleId: string }) {
  await update(ref(db), { [`sales/${month}/${uid}/${saleId}`]: null });
}
