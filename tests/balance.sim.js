// Balance harness: plays seeded runs with a greedy bot through the real model and contracts.
//   npm run sim            -> current rules vs the old (pre-Overdrive) rules
// The bot is a proxy for a competent but unimaginative player, not a human. Use it to compare
// rule changes against each other, not to read absolute difficulty.
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';
import { makeContracts, updateContracts } from '../src/gridshift/GridShiftContracts.js';
import { mulberry32 } from '../src/gridshift/GridShiftRng.js';

const LEGACY = { overdriveMoves: 0, heatAfterSurge: 5, lineBonus: [0, 100, 200, 300, 400, 500] };

function isolated(board) {
    let iso = 0, filled = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if (board[y][x] !== -1) { filled++; continue; }
        const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => board[y + dy]?.[x + dx] === -1).length;
        if (free <= 1) iso++;
    }
    return -iso * 3 - filled * 0.5;
}

function clone(model) {
    const c = new GridShiftModel();
    Object.assign(c, JSON.parse(JSON.stringify({ ...model, rng: undefined })));
    c.rng = () => 0.5;   // evaluating a move must never consume the real run's randomness
    return c;
}

function bestMove(model) {
    let best = null, bestScore = -Infinity;
    model.tray.forEach((piece, slot) => {
        if (piece.used) return;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            if (!model.canPlace(piece.cells, { x, y })) continue;
            const trial = clone(model);
            const r = trial.placePiece(slot, { x, y });
            const value = r.lines * 40 + isolated(trial.board);
            if (value > bestScore) { bestScore = value; best = { slot, x, y }; }
        }
    });
    return best;
}

function slide(model) {
    for (const axis of ['row', 'col']) for (let i = 0; i < 8; i++) for (const dir of [1, -1]) {
        const r = model.shiftLine(axis, i, dir);
        if (r.ok) return r;
    }
    return null;
}

function play(mode, seed, rules) {
    const model = new GridShiftModel();
    model.rng = mulberry32(seed);
    model.reset(mode, null, rules);
    const contracts = makeContracts(mode, mulberry32(seed ^ 0xabc));
    const stat = { surges: 0, maxHeat: 1, heatHist: new Array(9).fill(0), slides: 0, odTurns: 0 };
    for (let guard = 0; guard < 3000 && !model.isStuck(); guard++) {
        const move = bestMove(model);
        if (move) {
            const r = model.placePiece(move.slot, { x: move.x, y: move.y });
            if (r.surge) stat.surges++;
            if (model.overdrive > 0) stat.odTurns++;
            stat.maxHeat = Math.max(stat.maxHeat, model.heat);
            stat.heatHist[model.heat]++;
            updateContracts(contracts, { kind: 'place', lines: r.lines, combo: r.combo, heat: model.heat, score: model.score, surge: r.surge });
        } else {
            const r = slide(model);
            if (!r) break;
            stat.slides++;
            if (r.surge) stat.surges++;
            updateContracts(contracts, { kind: 'slide', lines: r.lines, combo: r.combo, heat: model.heat, score: model.score, surge: r.surge });
        }
    }
    return { score: model.score, stat, contracts };
}

function report(label, mode, runs, rules) {
    const results = Array.from({ length: runs }, (_, i) => play(mode, (i + 1) * 7919, rules));
    const avg = f => results.reduce((s, r) => s + f(r), 0) / runs;
    const scores = results.map(r => r.score).sort((a, b) => a - b);
    const q = p => scores[Math.min(runs - 1, Math.floor(runs * p))];
    const done = tier => 100 * results.filter(r => r.contracts.some(c => c.tier === tier && c.awarded)).length / runs;
    const hh = new Array(9).fill(0);
    results.forEach(r => r.stat.heatHist.forEach((v, i) => { hh[i] += v; }));
    const total = hh.reduce((a, b) => a + b, 0);
    const low = 100 * (hh[1] + hh[2]) / total, top = 100 * hh[8] / total;
    console.log(`\n${label} | ${mode} | ${runs} runs`);
    console.log(`  score median ${q(0.5)}  p10 ${q(0.1)}  p90 ${q(0.9)}  (p90/p10 = ${(q(0.9) / Math.max(1, q(0.1))).toFixed(0)}x)`);
    console.log(`  runs reaching x8: ${(100 * results.filter(r => r.stat.maxHeat >= 8).length / runs).toFixed(0)}%   surges/run ${avg(r => r.stat.surges).toFixed(2)}   placements at x8 ${top.toFixed(1)}%   at x1-x2 ${low.toFixed(0)}%`);
    console.log(`  contract tiers completed: easy ${done(1).toFixed(0)}%  medium ${done(2).toFixed(0)}%  hard ${done(3).toFixed(0)}%   stars/run ${avg(r => r.contracts.reduce((s, c) => s + (c.awarded ? c.stars : 0), 0)).toFixed(2)}`);
}

const runs = Number(process.argv[2]) || 120;
for (const mode of ['classic', 'shift']) {
    report('LEGACY rules ', mode, runs, LEGACY);
    report('CURRENT rules', mode, runs, null);
}
