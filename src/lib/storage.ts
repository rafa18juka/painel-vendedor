const PREFIX = 'rc_';

type ScopeKey = 'templates_user' | 'quickfields_user' | 'notas_user' | 'pendencias_user';

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
    return safeParse(localStorage.getItem(keyFor(scope, uid)), fallback);
  },
  setUserScoped<T>(scope: ScopeKey, uid: string, value: T) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(keyFor(scope, uid), JSON.stringify(value));
  },
  exportAll(uid: string) {
    if (typeof window === 'undefined') return null;
    const data: Record<string, unknown> = {};
    (['templates_user', 'quickfields_user', 'notas_user', 'pendencias_user'] as ScopeKey[]).forEach((scope) => {
      data[scope] = ls.getUserScoped(scope, uid, {});
    });
    return JSON.stringify(data, null, 2);
  },
  importAll(uid: string, payload: string) {
    const data = safeParse<Record<ScopeKey, unknown>>(payload, {
      templates_user: {},
      quickfields_user: {},
      notas_user: {},
      pendencias_user: {}
    });
    (Object.keys(data) as ScopeKey[]).forEach((scope) => {
      this.setUserScoped(scope, uid, data[scope]);
    });
  }
};
