// The saved profile carries a version so future changes can migrate it instead of guessing.
export const PROFILE_VERSION = 2;

// Returns { data, migrated }. Never throws; unknown or missing fields are left for
// loadProfile to sanitise. Version 1 profiles (no version field) gain the new fields.
export function migrateProfile(raw) {
    if (!raw || typeof raw !== 'object') return { data: { version: PROFILE_VERSION }, migrated: false };
    const data = { ...raw };
    let version = Number(data.version);
    if (!Number.isFinite(version) || version < 1) version = 1;
    let migrated = false;
    if (version < 2) {
        // v1 -> v2: runs played and a place for unlocked boons.
        data.stats = { ...(data.stats || {}), runs: Number(data.stats?.runs) || 0 };
        data.boons = Array.isArray(data.boons) ? data.boons : [];
        migrated = true;
        version = 2;
    }
    data.version = version;
    return { data, migrated };
}
