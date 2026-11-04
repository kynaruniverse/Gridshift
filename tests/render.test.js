import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';
import { renderMethods, skinColors } from '../src/gridshift/GridShiftRender.js';
import { makeContracts } from '../src/gridshift/GridShiftContracts.js';

// A drawing surface that accepts every canvas call and draws nothing. These tests only
// check that each screen can be drawn without errors and registers the buttons that
// the input code expects.
function fakeContext() {
    const target = {
        measureText: text => ({ width: String(text).length * 11 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} })
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
        muted: false, bestScores: { classic: 0, shift: 120, daily: 0 }, stars: 12, runStars: 3, newUnlocks: [],
        tileSkin: 'primary', undosLeft: 1, contracts: makeContracts('shift', () => 0.3),
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
    for (const name of ['start_shift', 'start_classic', 'start_daily', 'open_locker', 'sound_toggle']) {
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

test('classic and daily modes draw their own header', () => {
    for (const mode of ['classic', 'daily']) {
        const game = makeGame({ screen: 'game', mode });
        game.model.reset(mode === 'classic' ? 'classic' : 'shift');
        game.contracts = makeContracts(mode === 'classic' ? 'classic' : 'shift', () => 0.5);
        game.render();
        assert.equal(game.trayRects.length, 3);
    }
});

test('every heat level draws, with praise, particles, a flash and the fps counter', () => {
    for (let heat = 1; heat <= 8; heat++) {
        const game = makeGame({
            screen: 'game', showFps: true, flashTimer: 0.2,
            praise: { text: 'HEAT', start: 3.0 },
            particles: [{ x: 300, y: 300, age: 0.1, life: 0.6, radius: 4, color: skinColors('primary')[0], vx: 0, vy: 0 }]
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
    blocked.model.tray = [{ cells: [{ x: 0, y: 0 }], color: 0, used: false }, ...blocked.model.tray.slice(1)];
    blocked.render();
    blocked.dragIndex = 0;
    blocked.dragPosition = { x: 56 + 3.5 * 76, y: 180 + 3.5 * 76 + 90 };
    blocked.render();

    const clears = makeGame({ screen: 'game' });
    for (let x = 1; x < 8; x++) clears.model.board[0][x] = 1;
    clears.model.tray = [{ cells: [{ x: 0, y: 0 }], color: 0, used: false }, ...clears.model.tray.slice(1)];
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

test('every tile skin has six distinct colours, and unknown skins fall back to primary', () => {
    for (const skin of ['primary', 'candy', 'retro']) assert.equal(new Set(skinColors(skin)).size, 6);
    assert.deepEqual(skinColors('nope'), skinColors('primary'));
});

test('the game screen shows one chip per contract, including finished ones', () => {
    const game = makeGame({ screen: 'game' });
    game.contracts[0].progress = game.contracts[0].target;
    game.contracts[0].awarded = true;
    game.contracts[0].doneAt = 3.0;
    game.render();
    assert.equal(game.contracts.length, 3);
});

test('the undo button works with and without an undo left', () => {
    const game = makeGame({ screen: 'game' });
    game.model.history = [{}];
    game.render();
    game.undosLeft = 0;
    game.render();
    assert.ok(game.buttonHits.undo_move);
});

test('the locker draws, registers a card for every theme and skin, and every skin and theme can be equipped', () => {
    for (const skin of ['primary', 'candy', 'retro']) {
        for (const theme of ['classic', 'vaporwave', 'cyberpunk']) {
            const game = makeGame({ screen: 'locker', tileSkin: skin, theme, stars: 100 });
            game.render();
            for (const id of ['classic', 'vaporwave', 'cyberpunk']) assert.ok(game.buttonHits[`theme_${id}`], `theme_${id}`);
            for (const id of ['primary', 'candy', 'retro']) assert.ok(game.buttonHits[`skin_${id}`], `skin_${id}`);
            assert.ok(game.buttonHits.back_home);
        }
    }
    const fresh = makeGame({ screen: 'locker', stars: 0 });
    fresh.render();
    assert.ok(fresh.buttonHits.theme_cyberpunk, 'locked cards are still tappable so they can explain themselves');
});

test('the results window shows unlocks and keeps its buttons on screen', () => {
    const game = makeGame({ screen: 'game', modal: 'results', mode: 'daily', newUnlocks: [{ id: 'vaporwave', name: 'BERRY', kind: 'theme', stars: 10 }] });
    game.render();
    for (const name of ['modal_restart', 'modal_share', 'modal_home']) {
        const hit = game.buttonHits[name];
        assert.ok(hit, name);
        assert.ok(hit.y >= 0 && hit.y + hit.height <= 1280, `${name} is on screen`);
    }
});
