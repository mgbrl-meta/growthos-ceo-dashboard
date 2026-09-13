export type GrowthOSSidebarMode =
  | 'cursor'
  | 'fixed';

export type GrowthOSTableDensity =
  | 'compact'
  | 'comfortable';

export type GrowthOSDefaultLandingPage =
  | 'CEO Summary'
  | 'Meta OS'
  | 'Google OS'
  | 'Attribution OS'
  | 'Retention OS'
  | 'Product OS';

export type GrowthOSDefaultDateRange =
  | '7'
  | '14'
  | '30'
  | '90';

export type GrowthOSPersonalPreferences = {
  sidebarMode: GrowthOSSidebarMode;
  tableDensity: GrowthOSTableDensity;
  defaultLandingPage: GrowthOSDefaultLandingPage;
  defaultDateRange: GrowthOSDefaultDateRange;
};

export const GROWTH_OS_PREFERENCES_UPDATED_EVENT =
  'growth-os-user-preferences-updated';

export const GROWTH_OS_SIDEBAR_MODE_UPDATED_EVENT =
  'growth-os-sidebar-mode-updated';

const LEGACY_USER_PREFERENCES_KEY =
  'growth_os_user_preferences_v1';

const LEGACY_SIDEBAR_MODE_KEY =
  'growth_os_sidebar_mode_v1';

const PERSONAL_PREFERENCES_KEY_PREFIX =
  'growth_os_personal_preferences_v2';

export const DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES:
  GrowthOSPersonalPreferences = {
  sidebarMode: 'fixed',
  tableDensity: 'compact',
  defaultLandingPage: 'CEO Summary',
  defaultDateRange: '30',
};

function normalizeSidebarMode(
  value: unknown
): GrowthOSSidebarMode {
  return value === 'cursor'
    ? 'cursor'
    : 'fixed';
}

function normalizeTableDensity(
  value: unknown
): GrowthOSTableDensity {
  return value === 'comfortable'
    ? 'comfortable'
    : 'compact';
}

function normalizeLandingPage(
  value: unknown
): GrowthOSDefaultLandingPage {
  const allowed: GrowthOSDefaultLandingPage[] = [
    'CEO Summary',
    'Meta OS',
    'Google OS',
    'Attribution OS',
    'Retention OS',
    'Product OS',
  ];

  return allowed.includes(
    value as GrowthOSDefaultLandingPage
  )
    ? value as GrowthOSDefaultLandingPage
    : 'CEO Summary';
}

function normalizeDateRange(
  value: unknown
): GrowthOSDefaultDateRange {
  return (
    value === '7'
    || value === '14'
    || value === '90'
  )
    ? value
    : '30';
}

export function normalizeGrowthOSPersonalPreferences(
  value: Partial<GrowthOSPersonalPreferences> | null | undefined
): GrowthOSPersonalPreferences {
  return {
    sidebarMode: normalizeSidebarMode(
      value?.sidebarMode
    ),
    tableDensity: normalizeTableDensity(
      value?.tableDensity
    ),
    defaultLandingPage: normalizeLandingPage(
      value?.defaultLandingPage
    ),
    defaultDateRange: normalizeDateRange(
      value?.defaultDateRange
    ),
  };
}

function safeUserKey(
  userId: string | null | undefined
) {
  const normalized = String(
    userId || 'current-user'
  ).trim();

  return encodeURIComponent(
    normalized || 'current-user'
  );
}

export function getGrowthOSPreferencesStorageKey(
  userId: string | null | undefined
) {
  return `${PERSONAL_PREFERENCES_KEY_PREFIX}:${safeUserKey(userId)}`;
}

export function applyGrowthOSTableDensity(
  density: GrowthOSTableDensity
) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.growthOsTableDensity =
    normalizeTableDensity(density);
}

function readLegacyPreferences():
  GrowthOSPersonalPreferences | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const legacyPreferencesRaw =
    window.localStorage.getItem(
      LEGACY_USER_PREFERENCES_KEY
    );

  const legacySidebarMode =
    window.localStorage.getItem(
      LEGACY_SIDEBAR_MODE_KEY
    );

  if (
    !legacyPreferencesRaw
    && !legacySidebarMode
  ) {
    return null;
  }

  let parsed: Record<string, unknown> = {};

  if (legacyPreferencesRaw) {
    try {
      parsed = JSON.parse(
        legacyPreferencesRaw
      ) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  return normalizeGrowthOSPersonalPreferences({
    sidebarMode:
      legacySidebarMode
        ? legacySidebarMode as GrowthOSSidebarMode
        : undefined,
    tableDensity: parsed.tableDensity as GrowthOSTableDensity | undefined,
    defaultLandingPage: parsed.defaultLandingPage as GrowthOSDefaultLandingPage | undefined,
    defaultDateRange: parsed.defaultDateRange as GrowthOSDefaultDateRange | undefined,
  });
}

export function readGrowthOSPersonalPreferences(
  userId: string | null | undefined
): GrowthOSPersonalPreferences {
  if (typeof window === 'undefined') {
    return {
      ...DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES,
    };
  }

  const key =
    getGrowthOSPreferencesStorageKey(
      userId
    );

  const raw =
    window.localStorage.getItem(
      key
    );

  if (raw) {
    try {
      const parsed = JSON.parse(
        raw
      ) as Partial<GrowthOSPersonalPreferences>;

      return normalizeGrowthOSPersonalPreferences(
        parsed
      );
    } catch {
      // Invalid stored preferences fail safely to defaults/migration.
    }
  }

  const legacy =
    readLegacyPreferences();

  const next =
    legacy
    || {
      ...DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES,
    };

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(next)
    );

    // Legacy values were not user-scoped. Migrate them only once so
    // another user on the same browser does not inherit the first
    // user's personal defaults.
    window.localStorage.removeItem(
      LEGACY_USER_PREFERENCES_KEY
    );

    window.localStorage.removeItem(
      LEGACY_SIDEBAR_MODE_KEY
    );
  } catch {
    // localStorage can be unavailable in restrictive browser modes.
  }

  return next;
}

export function dispatchGrowthOSPreferencesUpdated(
  userId: string | null | undefined,
  preferences: GrowthOSPersonalPreferences
) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized =
    normalizeGrowthOSPersonalPreferences(
      preferences
    );

  window.dispatchEvent(
    new CustomEvent(
      GROWTH_OS_PREFERENCES_UPDATED_EVENT,
      {
        detail: {
          userId: String(userId || ''),
          preferences: normalized,
        },
      }
    )
  );

  // Compatibility event for the existing sidebar runtime behavior.
  window.dispatchEvent(
    new CustomEvent(
      GROWTH_OS_SIDEBAR_MODE_UPDATED_EVENT,
      {
        detail: normalized.sidebarMode,
      }
    )
  );
}

export function writeGrowthOSPersonalPreferences(
  userId: string | null | undefined,
  preferences: GrowthOSPersonalPreferences
) {
  const normalized =
    normalizeGrowthOSPersonalPreferences(
      preferences
    );

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      getGrowthOSPreferencesStorageKey(
        userId
      ),
      JSON.stringify(normalized)
    );
  }

  applyGrowthOSTableDensity(
    normalized.tableDensity
  );

  dispatchGrowthOSPreferencesUpdated(
    userId,
    normalized
  );

  return normalized;
}

export function resetGrowthOSPersonalPreferences(
  userId: string | null | undefined
) {
  return writeGrowthOSPersonalPreferences(
    userId,
    {
      ...DEFAULT_GROWTH_OS_PERSONAL_PREFERENCES,
    }
  );
}
