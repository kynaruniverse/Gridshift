import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';
import { renderMethods, TILE_COLORS } from '../src/gridshift/GridShiftRender.js';

// A drawing surface that accepts every canvas call and draws nothing. These tests only
// check that each screen can be drawn without errors and registers the buttons that
// the input code expects.
function fakeContext() {
    const target = {
        measureText: text => ({ width: String(text).length * 11 }),
        createLinearGradient: () => ({ addColorStop() {} })
    };
    return new Proxy(target, {
        get: (t, key) => (key in t ? t[key] : () => {}),
        set: (t, key, value) => { t[key] = value; return true; }
    });
}

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext() }) };

function makeGame(extra = {}) {
    const model = new GridShiftModel();
    model.reset('shift');
    return Object.assign(Object.create(GridShiftMain.prototype), renderMethods, {
        ctx: fakeContext(), theme: 'classic', screen: 'home', modal: '', mode: 'shift', model, clock: 3.2,
        muted: false, bestScores: { classic: 0, fever: 0, shift: 120 }, crystals: 5, crystalsEarned: 3,
        daily: { date: '', best: 0, claimed: false, streak: 0, bestStreak: 0, lastDate: '' }, runDailyKey: '',
        buttonHits: {}, trayRects: [], snapAnimations: new Map(), particles: [], praise: null,
        shakeTimer: 0, shakeIntensity: 0, flashTimer: 0, statusTimer: 0, statusMessage: '', tutorialStep: -1,
        dragIndex: -1, dragPosition: { x: 0, y: 0 }, dragStartClock: 0, shiftGesture: null, secondsLeft: 90,
        frameStats: { fps: 60, avg: 16.7 }, dprCap: 2, showFps: false, cellSize: 76, boardRect: null,
        ...extra
    });
}

test('the home screen draws and registers every start button', () => {
    const game = makeGame();
    game.render();
    for (const name of ['start_shift', 'start_classic', 'start_fever', 'start_daily', 'sound_toggle', 'toggle_theme']) {
        assert.ok(game.buttonHits[name], `${name} is missing`);
    }
});

test('every theme draws the home and game screens', () => {
    for (const theme of ['classic', 'vaporwave', 'cyberpunk']) {
        const home = makeGame({ theme });
        home.render();
        const play = makeGame({ theme, screen: 'game' });
        play.render();
        assert.equal(play.trayRects.length, 3);
    }
});

test('the game screen sets the board geometry and registers its controls', () => {
    const game = makeGame({ screen: 'game' });
    game.render();
    assert.deepEqual(game.boardRect, { x: 56, y: 180, width: 608, height: 608 });
    assert.equal(game.cellSize, 76);
    assert.ok(game.buttonHits.pause);
    assert.ok(game.buttonHits.undo_move);
    assert.equal(game.trayRects.length, 3);
});

test('classic and fever modes draw their own header', () => {
    for (const mode of ['classic', 'fever', 'daily']) {
        const game = makeGame({ screen: 'game', mode });
        game.model.reset(mode === 'classic' ? 'classic' : 'fever');
        game.render();
        assert.equal(game.trayRects.length, 3);
    }
});

test('every heat level draws, with praise, particles, a flash and the fps counter', () => {
    for (let heat = 1; heat <= 8; heat++) {
        const game = makeGame({
            screen: 'game', showFps: true, flashTimer: 0.2,
            praise: { text: 'HEAT', start: 3.0 },
            particles: [{ x: 300, y: 300, age: 0.1, life: 0.6, radius: 4, color: TILE_COLORS[0], vx: 0, vy: 0 }]
        });
        game.model.heat = heat;
        game.model.board[7] = [0, 1, 2, -1, 3, 4, -1, 5];
        game.render();
    }
});

test('dragging a piece over the board draws the ghost for fits, misses and clears', () => {
    const fits = makeGame({ screen: 'game' });
    fits.render();
    fits.dragIndex = 0;
    fits.dragPosition = { x: 300, y: 500 };
    fits.render();

    const blocked = makeGame({ screen: 'game' });
    blocked.model.board[3][3] = 1;
    blocked.model.tray = [{ cells: [{ x: 0, y: 0 }], color: 0, special: 0, used: false }, ...blocked.model.tray.slice(1)];
    blocked.render();
    blocked.dragIndex = 0;
    blocked.dragPosition = { x: 56 + 3.5 * 76, y: 180 + 3.5 * 76 + 90 };
    blocked.render();

    const clears = makeGame({ screen: 'game' });
    for (let x = 1; x < 8; x++) clears.model.board[0][x] = 1;
    clears.model.tray = [{ cells: [{ x: 0, y: 0 }], color: 0, special: 0, used: false }, ...clears.model.tray.slice(1)];
    clears.render();
    clears.dragIndex = 0;
    clears.dragPosition = { x: 56 + 0.5 * 76, y: 180 + 0.5 * 76 + 90 };
    clears.render();
});

test('the swipe highlight and tutorial strip draw', () => {
    const swipe = makeGame({ screen: 'game', shiftGesture: { startX: 300, startY: 500, cell: { x: 3, y: 4 }, axis: null } });
    swipe.render();
    swipe.shiftGesture.axis = 'row';
    swipe.model.shiftCharges = 0;
    swipe.render();

    const tutorial = makeGame({ screen: 'game', tutorialStep: 0 });
    tutorial.model.reset('classic');
    tutorial.render();
    assert.ok(tutorial.buttonHits.tutorial_skip);
});

test('the results and pause windows register their buttons', () => {
    const results = makeGame({ screen: 'game', modal: 'results' });
    results.render();
    assert.ok(results.buttonHits.modal_restart);
    assert.ok(results.buttonHits.modal_home);
    assert.equal(results.buttonHits.modal_share, undefined);

    const daily = makeGame({ screen: 'game', modal: 'results', mode: 'daily' });
    daily.render();
    assert.ok(daily.buttonHits.modal_share);

    const paused = makeGame({ screen: 'game', modal: 'paused' });
    paused.render();
    assert.ok(paused.buttonHits.modal_resume);
    assert.ok(paused.buttonHits.modal_restart);
    assert.ok(paused.buttonHits.modal_home);
});

test('tile colours are six distinct values', () => {
    assert.equal(new Set(TILE_COLORS).size, 6);
});
