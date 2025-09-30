const PREFIX = 'rc_';

type ScopeKey = 'templates_user' | 'templates_state_user' | 'quickfields_user' | 'notas_user' | 'pendencias_user' | 'sticky_user';

function keyFor(scope: ScopeKey, uid: string) {
  return `${PREFIX}${scope}_${uid}`;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const ls = {
  getUserScoped<T>(scope: ScopeKey, uid: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    const storageKey = keyFor(scope, uid);
    const raw = localStorage.getItem(storageKey);
    const parsed = safeParse(raw, fallback);
    if (import.meta.env.DEV) {
      console.log('[storage] get', storageKey, raw, parsed);
    }
    return parsed;
  },
  setUserScoped<T>(scope: ScopeKey, uid: string, value: T) {
    if (typeof window === 'undefined') return;
    const storageKey = keyFor(scope, uid);
    localStorage.setItem(storageKey, JSON.stringify(value));
    if (import.meta.env.DEV) {
      console.log('[storage] set', storageKey, value);
    }
  },
  exportAll(uid: string) {
    if (typeof window === 'undefined') return null;
    const data: Record<string, unknown> = {};
    const defaults: Record<ScopeKey, unknown> = {
      templates_user: [],
      templates_state_user: {},
      quickfields_user: {},
      notas_user: {},
      pendencias_user: [],
      sticky_user: []
    };
    (['templates_user', 'templates_state_user', 'quickfields_user', 'notas_user', 'pendencias_user', 'sticky_user'] as ScopeKey[]).forEach((scope) => {
      data[scope] = ls.getUserScoped(scope, uid, defaults[scope]);
    });
    return JSON.stringify(data, null, 2);
  },
  importAll(uid: string, payload: string) {
    const data = safeParse<Record<ScopeKey, unknown>>(payload, {
      templates_user: [],
      templates_state_user: {},
      quickfields_user: {},
      notas_user: {},
      pendencias_user: [],
      sticky_user: []
    });
    (Object.keys(data) as ScopeKey[]).forEach((scope) => {
      this.setUserScoped(scope, uid, data[scope]);
    });
  }
};
