import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';

const dot = used => ({ cells: [{ x: 0, y: 0 }], color: 0, special: 0, used });

function setup(mode = 'classic') {
    const model = new GridShiftModel();
    model.reset(mode);
    model.board = model._emptyBoard(-1);
    model.specialBoard = model._emptyBoard(GridShiftModel.SPECIAL_NONE);
    model.tray = [dot(false), dot(false), dot(false)];
    return model;
}

// Leaves row 0 one cell short, so the next dot at (7, 0) clears a line.
function almostLine(model, row = 0) {
    for (let x = 0; x < 7; x++) model.board[row][x] = 1;
}

test('heat starts at 1 in every mode', () => {
    for (const mode of ['classic', 'shift', 'fever']) {
        const model = setup(mode);
        assert.equal(model.heat, 1);
        assert.equal(model.heatMisses, 0);
    }
});

test('a clear raises heat by one, and two lines at once raise it by two', () => {
    const model = setup();
    almostLine(model);
    const result = model.placePiece(0, { x: 7, y: 0 });
    assert.equal(result.lines, 1);
    assert.equal(model.heat, 2);
    assert.equal(result.heat_before, 1);

    const double = setup();
    almostLine(double, 0);
    almostLine(double, 1);
    double.board[0][6] = -1;
    double.board[1][6] = -1;
    double.board[0][7] = 1;
    double.board[1][7] = 1;
    double.tray = [{ cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }], color: 0, special: 0, used: false }, dot(true), dot(true)];
    const doubleResult = double.placePiece(0, { x: 6, y: 0 });
    assert.equal(doubleResult.lines, 2);
    assert.equal(double.heat, 3);
});

test('a move is scored at the heat you had before it', () => {
    const model = setup();
    model.heat = 3;
    almostLine(model);
    model.placePiece(0, { x: 7, y: 0 });
    // one cell (5) + eight cleared cells (80) + one line (100), all times three
    assert.equal(model.score, (5 + 80 + 100) * 3);
});

test('placing without a clear is also multiplied', () => {
    const model = setup();
    model.heat = 4;
    model.placePiece(0, { x: 2, y: 2 });
    assert.equal(model.score, 5 * 4);
});

test('the first miss is free and later misses cool heat one step at a time', () => {
    const model = setup();
    model.heat = 4;
    model.placePiece(0, { x: 0, y: 4 });
    assert.equal(model.heat, 4);
    assert.equal(model.heatMisses, 1);
    model.placePiece(1, { x: 2, y: 4 });
    assert.equal(model.heat, 3);
    model.tray = [dot(false), dot(false), dot(false)];
    model.placePiece(0, { x: 4, y: 4 });
    assert.equal(model.heat, 2);
    model.placePiece(1, { x: 6, y: 4 });
    assert.equal(model.heat, 1);
    model.placePiece(2, { x: 0, y: 6 });
    assert.equal(model.heat, 1);
});

test('a clear after a miss resets the miss count', () => {
    const model = setup();
    model.heat = 3;
    model.placePiece(0, { x: 0, y: 5 });
    assert.equal(model.heatMisses, 1);
    almostLine(model, 0);
    model.placePiece(1, { x: 7, y: 0 });
    assert.equal(model.heatMisses, 0);
    assert.equal(model.heat, 4);
});

test('slides keep heat alive: no clear changes nothing, a clear builds it', () => {
    const model = setup('shift');
    model.shiftCharges = 3;
    model.heat = 4;
    model.heatMisses = 1;
    model.board[5][2] = 1;
    model.shiftLine('row', 5, 1);
    assert.equal(model.heat, 4);
    assert.equal(model.heatMisses, 1);

    for (let y = 0; y < 7; y++) model.board[y][0] = 1;
    model.board[7][1] = 2;
    const result = model.shiftLine('row', 7, -1);
    assert.equal(result.lines, 1);
    assert.equal(model.heat, 5);
    assert.equal(model.heatMisses, 0);
});

test('heat never goes above the maximum', () => {
    const model = setup();
    model.heat = 7;
    almostLine(model);
    almostLine(model, 1);
    model.board[0][6] = -1;
    model.board[1][6] = -1;
    model.board[0][7] = 1;
    model.board[1][7] = 1;
    model.tray = [{ cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }], color: 0, special: 0, used: false }, dot(true), dot(true)];
    model.placePiece(0, { x: 6, y: 0 });
    assert.equal(model.heat, GridShiftModel.HEAT_MAX);
});

test('at full heat the next clear surges: it sweeps the fullest line and drops heat to five', () => {
    const model = setup();
    model.heat = 8;
    almostLine(model, 0);            // will clear
    for (let x = 0; x < 6; x++) model.board[5][x] = 2; // fullest leftover line: six cells
    const result = model.placePiece(0, { x: 7, y: 0 });
    assert.equal(result.surge, true);
    assert.equal(result.surge_cells.length, 6);
    assert.ok(model.board[5].every(cell => cell === -1));
    assert.equal(model.heat, GridShiftModel.HEAT_AFTER_SURGE);
    // one cell (5), 8 + 6 cleared cells (140), one line (100), surge bonus (150), all times eight
    assert.equal(model.score, (5 + 140 + 100 + 150) * 8);
});

test('surge does not happen below full heat or without a clear', () => {
    const below = setup();
    below.heat = 7;
    almostLine(below);
    below.board[5][0] = 2;
    assert.equal(below.placePiece(0, { x: 7, y: 0 }).surge, false);
    assert.equal(below.board[5][0], 2);

    const miss = setup();
    miss.heat = 8;
    miss.board[5][0] = 2;
    assert.equal(miss.placePiece(0, { x: 3, y: 3 }).surge, false);
    assert.equal(miss.board[5][0], 2);
});

test('a surge on a nearly empty board still resets heat', () => {
    const model = setup();
    model.heat = 8;
    almostLine(model);
    const result = model.placePiece(0, { x: 7, y: 0 });
    assert.equal(result.surge, true);
    assert.equal(result.surge_cells.length, 0);
    assert.equal(model.heat, GridShiftModel.HEAT_AFTER_SURGE);
});

test('a slide can trigger a surge and reports the swept cells', () => {
    const model = setup('shift');
    model.shiftCharges = 2;
    model.heat = 8;
    for (let y = 0; y < 7; y++) model.board[y][0] = 1;
    model.board[7][1] = 2;
    for (let x = 3; x < 8; x++) model.board[3][x] = 3;
    const result = model.shiftLine('row', 7, -1);
    assert.equal(result.lines, 1);
    assert.equal(result.surge, true);
    assert.equal(result.surge_cells.length, 5);
    assert.equal(result.cleared.length, 8 + 5);
    assert.equal(model.heat, GridShiftModel.HEAT_AFTER_SURGE);
});

test('undo restores heat and misses', () => {
    const model = setup();
    model.heat = 5;
    model.heatMisses = 1;
    model.placePiece(0, { x: 2, y: 2 });
    assert.equal(model.heat, 4);
    assert.equal(model.undo(), true);
    assert.equal(model.heat, 5);
    assert.equal(model.heatMisses, 1);
});

test('heat tiers match the planned bands', () => {
    const tier = GridShiftMain.prototype.heatTier;
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(tier), [0, 0, 1, 1, 2, 2, 2, 3]);
});

function feedbackStub(heat) {
    const calls = { heat: [], vibrate: [], shake: [], status: [] };
    return {
        calls,
        clock: 5,
        praise: null,
        flashTimer: 0,
        model: { heat },
        audio: { setHeat: value => calls.heat.push(value) },
        heatTier: GridShiftMain.prototype.heatTier,
        vibrate: pattern => calls.vibrate.push(pattern),
        triggerShake: (...args) => calls.shake.push(args),
        setStatus: message => calls.status.push(message)
    };
}

test('feedback: a surge flashes, shakes and calls it out', () => {
    const game = feedbackStub(5);
    GridShiftMain.prototype.heatFeedback.call(game, { surge: true, heat_before: 8, lines: 1 }, 3);
    assert.equal(game.praise.text, 'SURGE ×8!');
    assert.ok(game.flashTimer > 0);
    assert.equal(game.calls.shake.length, 1);
    assert.deepEqual(game.calls.heat, [5]);
});

test('feedback: reaching a new tier is called out, staying in a tier is not', () => {
    const up = feedbackStub(3);
    GridShiftMain.prototype.heatFeedback.call(up, { surge: false, heat_before: 2, lines: 1 }, 0);
    assert.equal(up.praise.text, 'HEAT ×3');

    const same = feedbackStub(4);
    GridShiftMain.prototype.heatFeedback.call(same, { surge: false, heat_before: 3, lines: 1 }, 1);
    assert.equal(same.praise, null);
});

test('feedback: dropping a tier says so', () => {
    const game = feedbackStub(2);
    GridShiftMain.prototype.heatFeedback.call(game, { surge: false, heat_before: 3, lines: 0 }, 1);
    assert.equal(game.calls.status.length, 1);
    assert.equal(game.praise, null);
});