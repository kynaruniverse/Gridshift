// What stars unlock. Board themes and tile skins are looks only; nothing changes gameplay.

export const THEMES = [
    { id: 'classic', name: 'ARCADE', stars: 0 },
    { id: 'vaporwave', name: 'BERRY', stars: 10 },
    { id: 'cyberpunk', name: 'MINT', stars: 45 }
];

export const SKINS = [
    { id: 'primary', name: 'PRIMARY', stars: 0 },
    { id: 'candy', name: 'CANDY', stars: 25 },
    { id: 'retro', name: 'RETRO', stars: 70 }
];

export const isUnlocked = (item, stars) => stars >= item.stars;

export function findTheme(id) { return THEMES.find(item => item.id === id); }
export function findSkin(id) { return SKINS.find(item => item.id === id); }

// Everything that unlocked when stars went from `before` to `after`.
export function newlyUnlocked(before, after) {
    const all = [
        ...THEMES.map(item => ({ ...item, kind: 'theme' })),
        ...SKINS.map(item => ({ ...item, kind: 'skin' }))
    ];
    return all.filter(item => item.stars > before && item.stars <= after).sort((a, b) => a.stars - b.stars);
}

// The closest thing still locked, or null when everything is open.
export function nextUnlock(stars) {
    const all = [
        ...THEMES.map(item => ({ ...item, kind: 'theme' })),
        ...SKINS.map(item => ({ ...item, kind: 'skin' }))
    ];
    const locked = all.filter(item => item.stars > stars).sort((a, b) => a.stars - b.stars);
    return locked[0] || null;
}

export const unlockLabel = item => `${item.name} ${item.kind === 'theme' ? 'THEME' : 'TILES'}`;
