// Boons are small rule changes a player drafts before a run. Data only: each one is a
// patch applied on top of DEFAULT_RULES, so adding a boon never touches the model.
export const BOONS = [
    { id: 'slingshot', name: 'Slingshot', text: 'A slide that clears a line refunds its charge.', rules: { slingshot: true } },
    { id: 'furnace', name: 'Furnace', text: 'A slide that clears a line adds a Heat step.', rules: { furnace: true } },
    { id: 'safetynet', name: 'Safety Net', text: 'Two free misses before Heat cools.', rules: { heatGraceMisses: 2 } },
    { id: 'twist', name: 'Twist', text: 'Tap a tray piece to rotate it.', rules: { rotate: true } },
    { id: 'battery', name: 'Battery', text: 'Start with 3 slide charges and earn them faster.', rules: { shiftStartCharges: 3, shiftLinesPerCharge: 2 } },
    { id: 'overdrive', name: 'Long Overdrive', text: 'Surges hold x8 for 5 placements.', rules: { overdriveMoves: 5 } }
];

// Offers n different boons, chosen with the given random function.
export function drawBoons(rand = Math.random, n = 3, skip = []) {
    const pool = BOONS.filter(boon => !skip.includes(boon.id));
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
}

// The boon of the day: the same for everyone on a given date key.
export function dailyBoon(key) {
    let h = 0;
    for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return BOONS[h % BOONS.length];
}

export function findBoon(id) {
    return BOONS.find(boon => boon.id === id) || null;
}

// Merges the chosen boons into one rules patch. Unknown ids are ignored.
export function rulesForBoons(ids = []) {
    const patch = {};
    for (const id of ids) {
        const boon = findBoon(id);
        if (boon) Object.assign(patch, boon.rules);
    }
    return patch;
}
