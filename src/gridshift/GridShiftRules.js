// Per-run balance numbers. The model reads these from `model.rules`, so a boon (or a test)
// can change them for one run without touching shared statics.
export const DEFAULT_RULES = Object.freeze({
    shiftStartCharges: 1,
    shiftMaxCharges: 3,
    shiftLinesPerCharge: 3,
    heatMax: 8,
    heatGraceMisses: 1,
    heatAfterSurge: 6,
    surgeBonus: 150,
    // After a Surge, heat is held at max for this many placements (Overdrive): no cooling,
    // and every clear sweeps again. 0 turns Overdrive off. 2 keeps the score spread at the
    // old level (npm run sim); 3 made the best runs 40% bigger without helping anyone else.
    overdriveMoves: 2,
    // Bonus for clearing N lines at once; index = lines (the last entry covers anything larger).
    lineBonus: Object.freeze([0, 100, 300, 600, 1000, 1500]),
    // Boon switches
    slingshot: false,   // a slide that clears a line refunds its charge
    furnace: false,     // a slide that clears a line adds one extra heat step
    rotate: false       // tap a tray piece to rotate it
});

export function makeRules(overrides = {}) {
    return { ...DEFAULT_RULES, ...overrides };
}
