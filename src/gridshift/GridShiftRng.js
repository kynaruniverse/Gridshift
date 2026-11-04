// One mulberry32 implementation, shared by the model (stateful, re-seeded per tray)
// and by contracts/runs (closure form). Do not copy it elsewhere.
export function rngAdvance(state) {
    return (state + 0x6D2B79F5) >>> 0;
}

export function rngValue(state) {
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state = rngAdvance(state);
        return rngValue(state);
    };
}
