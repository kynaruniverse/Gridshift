import { mulberry32 } from './GridShiftRng.js';
// Contracts: three small goals every run (one easy, one medium, one hard).
// Finishing one earns stars (1, 2 or 3), and stars unlock looks in the Locker.
// This file is pure logic with no drawing, so it is easy to test.

const fmt = n => (n >= 1000 ? `${n / 1000}K` : String(n));

// tiers: the target for each difficulty (1 easy, 2 medium, 3 hard).
// shiftOnly types need the slide mechanic, so they never appear in Classic.
export const CONTRACT_TYPES = {
    lines: { tiers: { 1: 8, 2: 14, 3: 22 }, shiftOnly: false, label: n => `${n} LINE${n === 1 ? '' : 'S'}` },
    doubles: { tiers: { 1: 2, 2: 4, 3: 7 }, shiftOnly: false, label: n => `${n} DOUBLE${n === 1 ? '' : 'S'}` },
    heat: { tiers: { 1: 3, 2: 5, 3: 7 }, shiftOnly: false, label: n => `HEAT ×${n}` },
    score: { tiers: { 1: 1500, 2: 3500, 3: 7000 }, shiftOnly: false, label: n => `${fmt(n)} POINTS` },
    streak: { tiers: { 1: 3, 2: 5, 3: 8 }, shiftOnly: false, label: n => `${n} IN A ROW` },
    slides: { tiers: { 1: 2, 2: 4 }, shiftOnly: true, label: n => `${n} SLIDE${n === 1 ? '' : 'S'}` },
    slideclear: { tiers: { 2: 1, 3: 3 }, shiftOnly: true, label: n => (n === 1 ? 'SLIDE A CLEAR' : `${n} SLIDE CLEARS`) },
    surge: { tiers: { 3: 1 }, shiftOnly: false, label: () => 'TRIGGER A SURGE' }
};

// Small seedable random generator so the Daily can share its contracts (shared mulberry32).
export function seededRandom(seed) {
    return mulberry32(seed);
}

// Draws one contract per tier, never repeating a type within a run.
// scoreScale stretches only the score contract (1 = the shared defaults, used by the Daily).
export function makeContracts(mode, rand = Math.random, scoreScale = 1) {
    const slides = mode === 'shift';
    const chosen = [];
    const used = new Set();
    for (const tier of [1, 2, 3]) {
        const options = Object.keys(CONTRACT_TYPES).filter(type => {
            const def = CONTRACT_TYPES[type];
            return def.tiers[tier] !== undefined && !used.has(type) && (slides || !def.shiftOnly);
        });
        const type = options[Math.floor(rand() * options.length)];
        used.add(type);
        let target = CONTRACT_TYPES[type].tiers[tier];
        if (type === 'score' && scoreScale !== 1) target = Math.max(500, Math.round(target * scoreScale / 100) * 100);
        chosen.push({ type, tier, stars: tier, target, progress: 0, awarded: false });
    }
    return chosen;
}

export function contractLabel(contract) {
    return CONTRACT_TYPES[contract.type].label(contract.target);
}

export function isDone(contract) {
    return contract.awarded || contract.progress >= contract.target;
}

// Call after every successful move. Returns the contracts that just completed.
// event: { kind: 'place' | 'slide', lines, combo, heat, score, surge }
export function updateContracts(contracts, event) {
    const finished = [];
    for (const contract of contracts) {
        if (contract.awarded) continue;
        switch (contract.type) {
            case 'lines': contract.progress += event.lines; break;
            case 'doubles': if (event.lines >= 2) contract.progress += 1; break;
            case 'heat': contract.progress = Math.max(contract.progress, event.heat); break;
            case 'score': contract.progress = Math.max(contract.progress, event.score); break;
            case 'streak': contract.progress = Math.max(contract.progress, event.combo); break;
            case 'slides': if (event.kind === 'slide') contract.progress += 1; break;
            case 'slideclear': if (event.kind === 'slide' && event.lines > 0) contract.progress += 1; break;
            case 'surge': if (event.surge) contract.progress += 1; break;
            default: break;
        }
        contract.progress = Math.min(contract.progress, contract.target);
        if (contract.progress >= contract.target) {
            contract.awarded = true;
            finished.push(contract);
        }
    }
    return finished;
}

// Undo rewinds progress, but a contract that was already earned stays earned.
export function snapshotProgress(contracts) {
    return contracts.map(contract => contract.progress);
}

export function restoreProgress(contracts, saved) {
    contracts.forEach((contract, i) => {
        if (contract.awarded) contract.progress = contract.target;
        else if (saved && Number.isFinite(saved[i])) contract.progress = saved[i];
    });
}
