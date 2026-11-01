import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';

const call = (method, state, ...args) => GridShiftMain.prototype[method].call(state, ...args);

test('placed tiles keep release and destination coordinates for eased snapping', () => {
    const board = Array.from({ length: 8 }, () => new Array(8).fill(-1));
    board[3][2] = 4;
    const game = {
        model: { board },
        boardRect: { x: 56, y: 218 },
        cellSize: 76,
        snapAnimations: new Map(),
        prefersReducedMotion: false
    };

    call('animatePlacedCells', game, [{ x: 2, y: 3, localX: 1, localY: 0 }], 4, {
        left: 100, top: 180, size: 76
    });

    const animation = game.snapAnimations.get('2,3');
    assert.equal(animation.fromX, 176);
    assert.equal(animation.fromY, 180);
    assert.equal(animation.targetX, 208);
    assert.equal(animation.targetY, 446);
    assert.equal(animation.duration, 0.16);
});

test('cleared-cell detection includes previous tiles and new tiles erased by the same move', () => {
    const before = [[1, -1], [-1, 2]];
    const game = { model: { board: [[-1, -1], [-1, -1]] } };
    const cleared = call('findClearedCells', game, before, [{ x: 1, y: 0 }], 4);

    assert.deepEqual(cleared, [
        { x: 0, y: 0, color: 1 },
        { x: 1, y: 0, color: 4 },
        { x: 1, y: 1, color: 2 }
    ]);
});

test('clear particle effects stay capped and become lighter for reduced motion', () => {
    const cells = Array.from({ length: 64 }, (_, index) => ({ x: index % 8, y: Math.floor(index / 8), color: index % 6 }));
    const game = {
        particles: [],
        boardRect: { x: 56, y: 218 },
        cellSize: 76,
        prefersReducedMotion: false
    };
    call('spawnClearParticles', game, cells);
    assert.equal(game.particles.length, 60);
    assert.ok(game.particles.every(p => p.life >= 0.52 && p.life <= 0.70));

    const reduced = {
        particles: [],
        boardRect: { x: 56, y: 218 },
        cellSize: 76,
        prefersReducedMotion: true
    };
    call('spawnClearParticles', reduced, cells.slice(0, 2));
    assert.equal(reduced.particles.length, 2);
    assert.ok(reduced.particles.every(p => p.life === 0.28));
});

test('clear haptics distinguish a combo from a single line', () => {
    const patterns = [];
    const game = { vibrate: pattern => patterns.push(pattern) };
    call('hapticClear', game, 1, 0);
    call('hapticClear', game, 3, 3);
    assert.deepEqual(patterns, [18, [22, 28, 22, 34, 42]]);
});
