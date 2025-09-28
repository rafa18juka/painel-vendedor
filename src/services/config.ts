import { child, get, ref, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { Config } from '../types';

const CONFIG_PATH = 'config';

export async function getConfig(): Promise<Config> {
  const snapshot = await get(ref(db, CONFIG_PATH));
  if (!snapshot.exists()) {
    throw new Error('Configuração não encontrada.');
  }
  return snapshot.val();
}

export async function saveConfig(cfg: Config) {
  await set(ref(db, CONFIG_PATH), cfg);
}

export async function getUserRole(uid: string) {
  const snapshot = await get(child(ref(db), `users/${uid}`));
  if (!snapshot.exists()) return null;
  const data = snapshot.val();
  return data.role as string | null;
}

export async function getUserProfile(uid: string) {
  const snapshot = await get(child(ref(db), `users/${uid}`));
  if (!snapshot.exists()) return null;
  return snapshot.val();
}
