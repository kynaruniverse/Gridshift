import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';
import { makeContracts, isDone, CONTRACT_TYPES } from '../src/gridshift/GridShiftContracts.js';

const proto = GridShiftMain.prototype;
const noop = () => {};

function gameStub(extra = {}) {
    const calls = { status: [], vibrate: [], saves: 0, contractSound: 0 };
    const game = {
        calls,
        clock: 10,
        stars: 0,
        runStars: 0,
        newUnlocks: [],
        undosLeft: 1,
        contracts: [],
        statHistory: [],
        stats: { linesCleared: 0, maxCombo: 0 },
        model: { heat: 1, score: 0, history: [], undo: () => true },
        audio: { playContract: () => { calls.contractSound++; }, playUndo: noop, unlockAndPlay: noop, setHeat: noop },
        saveProfile: () => { calls.saves++; },
        vibrate: pattern => calls.vibrate.push(pattern),
        setStatus: message => calls.status.push(message),
        ...extra
    };
    return game;
}

const move = (extra = {}) => ({ lines: 0, combo: 0, surge: false, ...extra });

test('finishing a contract awards its stars straight away and saves', () => {
    const game = gameStub({ contracts: [{ type: 'lines', tier: 2, stars: 2, target: 2, progress: 0, awarded: false }] });
    proto.recordMove.call(game, 'place', move({ lines: 2 }));
    assert.equal(game.stars, 2);
    assert.equal(game.runStars, 2);
    assert.equal(game.calls.saves, 1);
    assert.equal(game.calls.contractSound, 1);
    assert.match(game.calls.status[0], /\+2 stars/);
    assert.equal(game.contracts[0].doneAt, 10);
});

test('a move that finishes nothing changes nothing', () => {
    const game = gameStub({ contracts: [{ type: 'lines', tier: 1, stars: 1, target: 8, progress: 0, awarded: false }] });
    proto.recordMove.call(game, 'place', move({ lines: 1 }));
    assert.equal(game.stars, 0);
    assert.equal(game.calls.saves, 0);
    assert.equal(game.calls.contractSound, 0);
});

test('crossing a star threshold announces the unlock', () => {
    const game = gameStub({ stars: 9, contracts: [{ type: 'lines', tier: 1, stars: 1, target: 1, progress: 0, awarded: false }] });
    proto.recordMove.call(game, 'place', move({ lines: 1 }));
    assert.equal(game.stars, 10);
    assert.equal(game.newUnlocks.length, 1);
    assert.equal(game.newUnlocks[0].id, 'vaporwave');
    assert.match(game.calls.status[0], /NEW UNLOCK: BERRY THEME/);
});

test('two contracts finishing on one move are both paid', () => {
    const game = gameStub({
        contracts: [
            { type: 'lines', tier: 1, stars: 1, target: 1, progress: 0, awarded: false },
            { type: 'heat', tier: 3, stars: 3, target: 5, progress: 0, awarded: false }
        ],
        model: { heat: 6, score: 0, history: [], undo: () => true }
    });
    proto.recordMove.call(game, 'place', move({ lines: 1 }));
    assert.equal(game.stars, 4);
});

test('a surge flag reaches the contracts', () => {
    const game = gameStub({ contracts: [{ type: 'surge', tier: 3, stars: 3, target: 1, progress: 0, awarded: false }] });
    proto.recordMove.call(game, 'place', move({ lines: 1, surge: true }));
    assert.equal(game.stars, 3);
});

test('undo rewinds contract progress, spends the one undo, and refuses a second', () => {
    const contracts = [{ type: 'lines', tier: 1, stars: 1, target: 8, progress: 5, awarded: false }];
    const game = gameStub({
        contracts,
        stats: { linesCleared: 5, maxCombo: 2 },
        model: { history: [{}], undo() { return true; } },
        statHistory: [{ linesCleared: 3, maxCombo: 1, contracts: [3] }]
    });
    proto.handleUndo.call(game);
    assert.equal(game.undosLeft, 0);
    assert.equal(contracts[0].progress, 3);
    assert.equal(game.stats.linesCleared, 3);

    game.model.history = [{}];
    proto.handleUndo.call(game);
    assert.match(game.calls.status.at(-1), /No undos left/);
});

test('undo with nothing to undo says so and keeps the undo', () => {
    const game = gameStub({ model: { history: [], undo: () => true } });
    proto.handleUndo.call(game);
    assert.equal(game.undosLeft, 1);
    assert.match(game.calls.status[0], /No moves to undo/);
});

test('undo cannot take back an earned contract', () => {
    const contracts = [{ type: 'lines', tier: 1, stars: 1, target: 3, progress: 3, awarded: true }];
    const game = gameStub({
        contracts,
        model: { history: [{}], undo() { return true; } },
        statHistory: [{ linesCleared: 0, maxCombo: 0, contracts: [1] }]
    });
    proto.handleUndo.call(game);
    assert.equal(isDone(contracts[0]), true);
    assert.equal(contracts[0].progress, 3);
});

function runStub(day) {
    return gameStub({
        model: new GridShiftModel(),
        dailyKey: () => day,
        tutorialDone: true,
        tutorialStep: -1,
        audio: { unlockAndPlay: noop, setHeat: noop }
    });
}

test('each mode starts with three contracts, one undo and a clean slate', () => {
    for (const mode of ['classic', 'shift', 'daily']) {
        const game = runStub('2026-11-03');
        game.undosLeft = 0;
        game.runStars = 5;
        game.newUnlocks = [{}];
        proto.startRun.call(game, mode);
        assert.equal(game.contracts.length, 3);
        assert.equal(game.undosLeft, 1);
        assert.equal(game.runStars, 0);
        assert.deepEqual(game.newUnlocks, []);
        assert.equal(game.screen, 'game');
    }
});

test('classic plays without Shift, and shift and daily play with it', () => {
    const classic = runStub('2026-11-03');
    proto.startRun.call(classic, 'classic');
    assert.equal(classic.model.shiftEnabled, false);
    assert.ok(classic.contracts.every(c => !CONTRACT_TYPES[c.type].shiftOnly));
    for (const mode of ['shift', 'daily']) {
        const game = runStub('2026-11-03');
        proto.startRun.call(game, mode);
        assert.equal(game.model.shiftEnabled, true);
    }
});

test('the Daily gives everyone the same pieces and contracts on a given day', () => {
    const a = runStub('2026-11-03');
    const b = runStub('2026-11-03');
    const c = runStub('2026-11-04');
    proto.startRun.call(a, 'daily');
    proto.startRun.call(b, 'daily');
    proto.startRun.call(c, 'daily');
    assert.deepEqual(a.contracts, b.contracts);
    assert.equal(JSON.stringify(a.model.tray), JSON.stringify(b.model.tray));
    assert.notEqual(JSON.stringify(a.model.tray), JSON.stringify(c.model.tray));
});

test('equipping a locked theme or skin is refused with the stars still needed', () => {
    const game = gameStub({ theme: 'classic', tileSkin: 'primary', stars: 4 });
    proto.equipTheme.call(game, 'vaporwave');
    assert.equal(game.theme, 'classic');
    assert.match(game.calls.status[0], /6 more stars/);
    proto.equipSkin.call(game, 'candy');
    assert.equal(game.tileSkin, 'primary');
    assert.match(game.calls.status[1], /21 more stars/);
    assert.equal(game.calls.saves, 0);
});

test('equipping an unlocked theme or skin works and saves; unknown ids are ignored', () => {
    const game = gameStub({ theme: 'classic', tileSkin: 'primary', stars: 80 });
    proto.equipTheme.call(game, 'cyberpunk');
    proto.equipSkin.call(game, 'retro');
    assert.equal(game.theme, 'cyberpunk');
    assert.equal(game.tileSkin, 'retro');
    assert.equal(game.calls.saves, 2);
    proto.equipTheme.call(game, 'nonsense');
    proto.equipSkin.call(game, 'nonsense');
    assert.equal(game.theme, 'cyberpunk');
    assert.equal(game.tileSkin, 'retro');
});

function withStorage(value, run) {
    const original = globalThis.localStorage;
    const store = { gridshift_profile: value };
    globalThis.localStorage = { getItem: key => store[key] ?? null, setItem: (key, v) => { store[key] = v; } };
    try { return run(store); } finally { globalThis.localStorage = original; }
}

test('an old profile loads cleanly: scores kept, island and crystal data ignored', () => {
    const old = JSON.stringify({
        crystals: 40, islandLevels: [5, 3, 1], cloudCarry: 20, theme: 'vaporwave', muted: true,
        bestScores: { classic: 4200, fever: 9000 }, unlockedThemes: { vaporwave: true }
    });
    withStorage(old, () => {
        const game = { bestScores: {}, daily: {} };
        proto.loadProfile.call(game);
        assert.equal(game.bestScores.classic, 4200);
        assert.equal(game.bestScores.fever, undefined);
        assert.equal(game.bestScores.shift, 0);
        assert.equal(game.stars, 0);
        assert.equal(game.theme, 'classic', 'a locked theme falls back to the default');
        assert.equal(game.tileSkin, 'primary');
        assert.equal(game.muted, true);
        assert.equal(game.tutorialDone, true);
        assert.equal(game.crystals, undefined);
    });
});

test('stars, an unlocked theme and a skin survive a save and a load', () => {
    const game = { muted: false, bestScores: { classic: 1, shift: 2, daily: 3 }, stats: { linesCleared: 4, maxCombo: 5 }, stars: 50, theme: 'cyberpunk', tileSkin: 'candy', tutorialDone: true, daily: { date: '', best: 0, claimed: false, streak: 0, bestStreak: 0, lastDate: '' } };
    withStorage(null, store => {
        proto.saveProfile.call(game);
        const loaded = { bestScores: {}, daily: {} };
        proto.loadProfile.call(loaded);
        assert.equal(loaded.stars, 50);
        assert.equal(loaded.theme, 'cyberpunk');
        assert.equal(loaded.tileSkin, 'candy');
        assert.deepEqual(loaded.bestScores, { classic: 1, shift: 2, daily: 3 });
        assert.ok(store.gridshift_profile.length > 10);
    });
});

test('a corrupted profile is ignored without crashing', () => {
    withStorage('{not json', () => {
        const game = { stars: 7 };
        assert.doesNotThrow(() => proto.loadProfile.call(game));
        assert.equal(game.stars, 7);
    });
});

test('contracts built for a run match their definitions', () => {
    for (const mode of ['classic', 'shift']) {
        const list = makeContracts(mode, Math.random);
        for (const contract of list) assert.equal(contract.progress, 0);
    }
});
