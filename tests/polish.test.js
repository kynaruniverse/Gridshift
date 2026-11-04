import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';

const P = GridShiftMain.prototype;
const call = (name, game, ...args) => P[name].call(game, ...args);

test('resolveOrigin keeps a legal drop and rescues an illegal one within a cell', () => {
    const model = new GridShiftModel();
    model.reset('classic');
    model.board[3][3] = 2;
    const game = { model, resolveOrigin: P.resolveOrigin };
    const dot = [{ x: 0, y: 0 }];
    assert.deepEqual(call('resolveOrigin', game, dot, 1.2, 1.1), { x: 1, y: 1 });
    // Lands on the filled cell (3,3) but is nearer to (3,2) than to any other free neighbour.
    assert.deepEqual(call('resolveOrigin', game, dot, 3.1, 2.7), { x: 3, y: 2 });
    assert.deepEqual(call('resolveOrigin', game, dot, NaN, 2), { x: NaN, y: 2 });
});

test('quitting a run through the pause menu still banks the score', () => {
    let saved = 0;
    const game = {
        screen: 'game', modal: 'paused', runFinalized: false, tutorialStep: -1, mode: 'classic',
        model: { score: 4200 }, bestScores: { classic: 100, shift: 0, daily: 0 },
        saveProfile() { saved++; }, audio: { setHeat() {} }
    };
    game.finishRun = P.finishRun;
    call('bankRunIfAbandoned', Object.assign(game, { bankRunIfAbandoned: P.bankRunIfAbandoned }));
    assert.equal(game.bestScores.classic, 4200);
    assert.equal(game.modal, 'paused', 'quitting does not open the results window');
    assert.equal(saved, 1);
    call('bankRunIfAbandoned', game);
    assert.equal(saved, 1, 'banked only once');
});

test('trauma stacks, caps at 1, decays, and is ignored under reduced motion', () => {
    const game = { trauma: 0, prefersReducedMotion: false, addTrauma: P.addTrauma };
    call('triggerShake', Object.assign(game, { triggerShake: P.triggerShake }), 0.4, 16);
    assert.ok(game.trauma > 0.85 && game.trauma <= 1);
    call('addTrauma', game, 0.5);
    assert.equal(game.trauma, 1);
    const calm = { trauma: 0, prefersReducedMotion: true, addTrauma: P.addTrauma };
    call('addTrauma', calm, 0.9);
    assert.equal(calm.trauma, 0);
});

test('a clear spawns a rippling dissolve and a floating score; hit-stop scales with lines', () => {
    const game = Object.assign(Object.create(P), {
        prefersReducedMotion: false, trauma: 0, hitStop: 0, dyingTiles: [], floaters: [], sweeps: [],
        boardRect: { x: 56, y: 180 }, cellSize: 76, model: { heat: 5 }
    });
    const cells = Array.from({ length: 8 }, (_, x) => ({ x, y: 2, color: 1 }));
    game.clearFeedback({ lines: 1, score: 1500 }, cells, 300);
    assert.equal(game.dyingTiles.length, 8);
    assert.ok(Math.max(...game.dyingTiles.map(t => t.delay)) > 0, 'tiles ripple outward');
    assert.equal(game.floaters[0].text, '+1,200');
    assert.equal(game.hitStop, 0.06);
    game.clearFeedback({ lines: 3, score: 4000 }, cells, 0);
    assert.equal(game.hitStop, 0.12);
});

test('update freezes animation during hit-stop but still eases the score and decays trauma', () => {
    const game = Object.assign(Object.create(P), {
        modal: '', clock: 0, hitStop: 0.1, statusTimer: 0, shakeTimer: 0, flashTimer: 0, trauma: 1,
        model: { score: 1000 }, displayScore: 0, lastScore: 0, scorePop: 0, dragVx: 0,
        snapAnimations: new Map([['a', { elapsed: 0, delay: 0, duration: 1 }]]),
        returnAnim: null, particles: [], dyingTiles: [], floaters: []
    });
    game.update(0.05);
    assert.equal(game.clock, 0);
    assert.equal(game.snapAnimations.get('a').elapsed, 0);
    assert.ok(game.displayScore > 0 && game.displayScore < 1000);
    assert.ok(game.trauma < 1);
    game.update(0.2); // the frame that ends the freeze is still frozen
    game.update(0.2);
    assert.ok(game.clock > 0);
});

test('a paused game does not advance its clock', () => {
    const game = Object.assign(Object.create(P), {
        modal: 'paused', clock: 5, hitStop: 0, statusTimer: 0, shakeTimer: 0, flashTimer: 0, trauma: 0,
        model: { score: 0 }, displayScore: 0, lastScore: 0, scorePop: 0, dragVx: 0,
        snapAnimations: new Map(), returnAnim: null, particles: [], dyingTiles: [], floaters: []
    });
    game.update(0.1);
    assert.equal(game.clock, 5);
});

test('a clear that completes lines spawns one gold sweep per line', () => {
    const game = Object.assign(Object.create(P), { prefersReducedMotion: false, sweeps: [] });
    const row = Array.from({ length: 8 }, (_, x) => ({ x, y: 3, color: 1 }));
    const col = Array.from({ length: 8 }, (_, y) => ({ x: 6, y, color: 1 }));
    game.spawnSweeps([...row, ...col]);
    assert.deepEqual(game.sweeps.map(s => `${s.axis}${s.index}`).sort(), ['col6', 'row3']);
    game.spawnSweeps([{ x: 0, y: 0, color: 1 }]);
    assert.equal(game.sweeps.length, 2, 'partial cells make no sweep');
});
