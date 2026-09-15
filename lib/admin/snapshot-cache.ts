import 'server-only';

type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

type AdminSnapshotStore = Map<string, CacheEntry<unknown>>;

type GlobalWithAdminSnapshotCache = typeof globalThis & {
  __growthosAdminSnapshotCache?: AdminSnapshotStore;
};

const globalCache = globalThis as GlobalWithAdminSnapshotCache;
const store: AdminSnapshotStore =
  globalCache.__growthosAdminSnapshotCache || new Map<string, CacheEntry<unknown>>();

globalCache.__growthosAdminSnapshotCache = store;

const DEFAULT_TTL_MS = Math.max(
  1000,
  Number(process.env.GROWTHOS_ADMIN_CACHE_TTL_MS || 120000)
);

const ADMIN_TTL_MS: Record<string, number> = {
  'admin:overview': 60000,
  'admin:clients': 300000,
  'admin:client-options': 300000,
  'admin:plans': 300000,
  'admin:modules': 300000,
  'admin:users': 120000,
  'admin:integrations': 120000,
  'admin:data-health': 60000,
  'admin:sync-history': 60000,
  'admin:system': 300000,
  'admin:warehouse-audit': 600000,
};

export function getAdminSnapshotTtlMs(key: string) {
  const envKey = `GROWTHOS_ADMIN_CACHE_TTL_${key.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}_MS`;
  const configured = Number(process.env[envKey]);

  if (Number.isFinite(configured) && configured >= 1000) {
    return configured;
  }

  return ADMIN_TTL_MS[key] ?? DEFAULT_TTL_MS;
}

function cacheDebugEnabled() {
  return String(process.env.GROWTHOS_ADMIN_CACHE_DEBUG || '')
    .trim()
    .toLowerCase() === 'true';
}

function cacheDebug(message: string) {
  if (!cacheDebugEnabled()) {
    return;
  }

  console.log(message);
}

export async function getCachedAdminSnapshot<T>(
  key: string,
  loader: () => Promise<T>,
  options?: {
    fresh?: boolean;
    ttlMs?: number;
  }
): Promise<T> {
  const now = Date.now();
  const ttlMs = Math.max(1000, options?.ttlMs ?? getAdminSnapshotTtlMs(key));
  const existing = store.get(key) as CacheEntry<T> | undefined;

  if (!options?.fresh && existing?.value !== undefined && existing.expiresAt > now) {
    const remainingMs = Math.max(0, existing.expiresAt - now);
    cacheDebug(`[ADMIN_CACHE] HIT      ${key} ttl_remaining=${remainingMs}ms`);
    return existing.value;
  }

  if (!options?.fresh && existing?.promise) {
    cacheDebug(`[ADMIN_CACHE] INFLIGHT ${key}`);
    return existing.promise;
  }

  if (options?.fresh) {
    cacheDebug(`[ADMIN_CACHE] BYPASS   ${key}`);
  } else if (existing?.value !== undefined) {
    cacheDebug(`[ADMIN_CACHE] MISS     ${key} reason=expired`);
  } else {
    cacheDebug(`[ADMIN_CACHE] MISS     ${key} reason=empty`);
  }

  const loadStartedAt = Date.now();
  cacheDebug(`[ADMIN_BQ]    LOAD START ${key}`);

  const promise = loader()
    .then(value => {
      const durationMs = Date.now() - loadStartedAt;

      store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });

      cacheDebug(`[ADMIN_BQ]    LOAD END   ${key} ${durationMs}ms`);
      cacheDebug(`[ADMIN_CACHE] STORE      ${key} ttl=${ttlMs}ms`);

      return value;
    })
    .catch(error => {
      const durationMs = Date.now() - loadStartedAt;
      cacheDebug(`[ADMIN_BQ]    LOAD ERROR ${key} ${durationMs}ms`);

      const current = store.get(key) as CacheEntry<T> | undefined;
      if (current?.promise === promise) {
        store.delete(key);
      }
      throw error;
    });

  store.set(key, {
    value: existing?.value,
    expiresAt: options?.fresh ? 0 : existing?.expiresAt || 0,
    promise,
  });

  return promise;
}

export function invalidateAdminSnapshots(...keys: string[]) {
  if (keys.length === 0) {
    cacheDebug('[ADMIN_CACHE] INVALIDATE all');
    store.clear();
    return;
  }

  for (const key of keys) {
    cacheDebug(`[ADMIN_CACHE] INVALIDATE ${key}`);
    store.delete(key);
  }
}
