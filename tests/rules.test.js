import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';
import { makeRules, DEFAULT_RULES } from '../src/gridshift/GridShiftRules.js';
import { BOONS, rulesForBoons, findBoon } from '../src/gridshift/GridShiftBoons.js';
import { mulberry32 } from '../src/gridshift/GridShiftRng.js';
import { seededRandom } from '../src/gridshift/GridShiftContracts.js';
import { replayRun } from '../src/gridshift/GridShiftReplay.js';

const dot = used => ({ cells: [{ x: 0, y: 0 }], color: 0, used });
function setup(mode = 'classic', rules = null) {
    const model = new GridShiftModel();
    model.reset(mode, null, rules);
    model.tray = [dot(false), dot(false), dot(false)];
    return model;
}
function almostLine(model, y = 0) {
    for (let x = 0; x < 7; x++) model.board[y][x] = 1;
}

test('the contracts RNG and the model RNG are the same generator', () => {
    const a = mulberry32(1234), b = seededRandom(1234);
    for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('rules are per run: changing one model never leaks into the defaults', () => {
    const model = setup('classic', { heatGraceMisses: 3 });
    assert.equal(model.rules.heatGraceMisses, 3);
    assert.equal(DEFAULT_RULES.heatGraceMisses, 1);
    assert.equal(new GridShiftModel().rules.heatGraceMisses, 1);
    assert.throws(() => { 'use strict'; DEFAULT_RULES.heatMax = 1; });
});

test('multi-line clears score on a rising table', () => {
    const model = setup();
    model.heat = 1;
    assert.equal([0, 1, 2, 3, 4, 5, 9].map(n => model._lineBonus(n)).join(','), '0,100,300,600,1000,1500,1500');
    // two lines at once: 1 cell (5) + 16 cells (160) + bonus 300
    const two = setup();
    for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) if (!(y === 0 && x === 7)) two.board[y][x] = 1;
    two.board[1][7] = 1;
    two.tray = [dot(false), dot(true), dot(true)];
    two.placePiece(0, { x: 7, y: 0 });
    assert.equal(two.score, 5 + 160 + 300);
});

test('Overdrive holds x8 for its placements, then drops to the after-surge level', () => {
    const model = setup('classic', { overdriveMoves: 3 });
    model.heat = 8;
    almostLine(model);
    model.tray = [dot(false), dot(false), dot(false)];
    assert.equal(model.placePiece(0, { x: 7, y: 0 }).surge, true);
    assert.equal(model.overdrive, 3);
    // three placements with no clear: heat must not cool while Overdrive lasts
    model.placePiece(1, { x: 3, y: 3 });
    assert.equal(model.heat, 8);
    assert.equal(model.overdrive, 2);
    model.placePiece(2, { x: 4, y: 4 });
    assert.equal(model.overdrive, 1);
    model.tray = [dot(false), dot(false), dot(false)];
    model.placePiece(0, { x: 5, y: 5 });
    assert.equal(model.overdrive, 0);
    assert.equal(model.heat, DEFAULT_RULES.heatAfterSurge);
});

test('clearing again during Overdrive surges again and refreshes it', () => {
    const model = setup();
    model.heat = 8;
    almostLine(model, 0);
    model.placePiece(0, { x: 7, y: 0 });
    model.tray = [dot(false), dot(true), dot(true)];
    model.overdrive = 1;
    almostLine(model, 4);
    const result = model.placePiece(0, { x: 7, y: 4 });
    assert.equal(result.surge, true);
    assert.equal(model.overdrive, model.rules.overdriveMoves);
});

test('overdriveMoves 0 restores the old behaviour', () => {
    const model = setup('classic', { overdriveMoves: 0 });
    model.heat = 8;
    almostLine(model);
    model.placePiece(0, { x: 7, y: 0 });
    assert.equal(model.heat, DEFAULT_RULES.heatAfterSurge);
    assert.equal(model.overdrive, 0);
});

test('undo restores Overdrive', () => {
    const model = setup();
    model.heat = 8;
    almostLine(model);
    model.placePiece(0, { x: 7, y: 0 });
    assert.equal(model.overdrive, model.rules.overdriveMoves);
    model.undo();
    assert.equal(model.overdrive, 0);
    assert.equal(model.heat, 8);
});

test('every boon is valid data and only patches known rule keys', () => {
    for (const boon of BOONS) {
        assert.ok(boon.id && boon.name && boon.text);
        for (const key of Object.keys(boon.rules)) assert.ok(key in DEFAULT_RULES, `${boon.id}: unknown rule ${key}`);
    }
    assert.equal(findBoon('nope'), null);
    assert.deepEqual(rulesForBoons(['safetynet', 'nope']), { heatGraceMisses: 2 });
});

test('Safety Net gives two free misses', () => {
    const model = setup('classic', rulesForBoons(['safetynet']));
    model.heat = 5;
    model.placePiece(0, { x: 0, y: 0 });
    model.placePiece(1, { x: 2, y: 2 });
    assert.equal(model.heat, 5);
    model.placePiece(2, { x: 4, y: 4 });
    assert.equal(model.heat, 4);
});

test('Slingshot refunds the charge and Furnace adds heat when a slide clears', () => {
    const model = setup('shift', rulesForBoons(['slingshot', 'furnace']));
    model.shiftCharges = 1;
    model.heat = 3;
    for (let y = 0; y < 7; y++) model.board[y][0] = 1;
    model.board[7][1] = 2;
    const result = model.shiftLine('row', 7, -1);
    assert.equal(result.lines, 1);
    assert.equal(model.shiftCharges, 1, 'charge refunded');
    assert.equal(model.heat, 5, '+1 for the clear and +1 from Furnace');
});

test('Battery starts with three charges and earns them every two lines', () => {
    const model = setup('shift', rulesForBoons(['battery']));
    assert.equal(model.shiftCharges, 3);
    model.shiftCharges = 0;
    model._earnShiftCharges(2);
    assert.equal(model.shiftCharges, 1);
});

test('rotation: four quarter turns return the piece, and it only works with Twist', () => {
    const l = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
    let cells = l;
    for (let i = 0; i < 4; i++) cells = GridShiftModel.rotateCells(cells);
    const norm = list => JSON.stringify([...list].sort((a, b) => a.x - b.x || a.y - b.y));
    assert.equal(norm(cells), norm(l));
    assert.ok(Math.min(...GridShiftModel.rotateCells(l).map(c => c.x)) === 0);

    const plain = setup();
    plain.tray[0] = { cells: l, color: 0, used: false };
    assert.equal(plain.rotatePiece(0), false);

    const twist = setup('classic', rulesForBoons(['twist']));
    twist.tray[0] = { cells: l, color: 0, used: false };
    assert.equal(twist.rotatePiece(0), true);
    assert.notEqual(norm(twist.tray[0].cells), norm(l));
    assert.equal(twist.history.length, 0, 'rotating is free and is not an Undo step');
});

test('with Twist a board that only fits a rotated piece is not a dead end', () => {
    const model = setup('classic', rulesForBoons(['twist']));
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) model.board[y][x] = 1;
    for (let y = 0; y < 3; y++) model.board[y][0] = -1;   // a vertical 1x3 hole
    model.tray = [{ cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], color: 0, used: false }, dot(true), dot(true)];
    assert.equal(model.canAnyPieceFit(), true);
    const plain = setup();
    plain.board = model.board.map(r => r.slice());
    plain.tray = model.tray;
    assert.equal(plain.canAnyPieceFit(), false);
});

test('golden replay: the same seed and moves always give the same final score', () => {
    function play(seed) {
        const model = new GridShiftModel();
        model.rng = mulberry32(seed);
        model.reset('shift');
        const moves = [];
        for (let guard = 0; guard < 400 && !model.isStuck(); guard++) {
            let done = false;
            for (let slot = 0; slot < 3 && !done; slot++) {
                if (model.tray[slot].used) continue;
                for (let y = 0; y < 8 && !done; y++) for (let x = 0; x < 8 && !done; x++) {
                    if (model.placePiece(slot, { x, y }).ok) { moves.push({ t: 'p', slot, x, y }); done = true; }
                }
            }
            if (!done) {
                for (const axis of ['row', 'col']) for (let i = 0; i < 8 && !done; i++) {
                    if (model.shiftLine(axis, i, 1).ok) { moves.push({ t: 's', axis, index: i, dir: 1 }); done = true; }
                }
            }
            if (!done) break;
        }
        return { score: model.score, log: { mode: 'shift', seed, rules: null, moves } };
    }
    const first = play(77), second = play(77), other = play(78);
    assert.equal(first.score, second.score);
    assert.ok(first.log.moves.length > 5);
    assert.equal(replayRun(first.log).score, first.score);
    assert.notEqual(other.score, first.score);
});

test('the Daily property holds: the same seed deals the same trays regardless of play', () => {
    const a = new GridShiftModel(), b = new GridShiftModel();
    a.reset('shift', 4242);
    b.reset('shift', 4242);
    a.placePiece(0, { x: 0, y: 0 });
    b.placePiece(0, { x: 5, y: 5 });
    for (const m of [a, b]) for (let i = 0; i < 3; i++) m.tray.forEach(p => { p.used = true; });
    a._dealTray();
    b._dealTray();
    assert.equal(JSON.stringify(a.tray), JSON.stringify(b.tray));
});
