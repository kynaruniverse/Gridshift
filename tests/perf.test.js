import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';

function stub() {
    return {
        dprCap: 2,
        resizes: 0,
        frameStats: { last: 0, frames: 0, ms: 0, avg: 0, fps: 0, windows: 0 },
        initCanvasSize() { this.resizes++; }
    };
}

function run(game, frameMs, frames, start = 1000) {
    let t = start;
    for (let i = 0; i < frames; i++) {
        t += frameMs;
        GridShiftMain.prototype.trackFrame.call(game, t);
    }
    return t;
}

test('smooth frames keep full resolution', () => {
    const game = stub();
    run(game, 16.7, 300);
    assert.equal(game.dprCap, 2);
    assert.equal(game.resizes, 0);
    assert.ok(game.frameStats.fps > 55);
});

test('sustained slow frames step the resolution down, never below 1x', () => {
    const game = stub();
    run(game, 40, 500);
    assert.equal(game.dprCap, 1);
    assert.ok(game.resizes >= 2);
});

test('the first measuring window is ignored as warm-up', () => {
    const game = stub();
    run(game, 40, 47);
    assert.equal(game.dprCap, 2);
});

test('long pauses such as a hidden tab are not counted as slow frames', () => {
    const game = stub();
    let t = run(game, 16.7, 60);
    t = run(game, 5000, 3, t);
    run(game, 16.7, 200, t);
    assert.equal(game.dprCap, 2);
});