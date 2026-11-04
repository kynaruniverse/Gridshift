import test from 'node:test';
import assert from 'node:assert/strict';
import { pushPraise, nextPraise } from '../src/gridshift/GridShiftPraise.js';
import { migrateProfile, PROFILE_VERSION } from '../src/gridshift/GridShiftProfile.js';
import { makeContracts } from '../src/gridshift/GridShiftContracts.js';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';

test('praise: a Surge call-out waits for COMBO instead of erasing it', () => {
    const game = { praise: null, praiseQueue: [], clock: 10 };
    pushPraise(game, 'COMBO ×3');
    game.clock = 10.1;
    pushPraise(game, 'SURGE ×8!');
    assert.equal(game.praise.text, 'COMBO ×3');
    assert.deepEqual(game.praiseQueue, ['SURGE ×8!']);
    game.clock = 11;
    nextPraise(game);
    assert.equal(game.praise.text, 'SURGE ×8!');
    nextPraise(game);
    assert.equal(game.praise, null);
});

test('praise: an old call-out is replaced straight away, and the queue is capped', () => {
    const game = { praise: { text: 'OLD', start: 0 }, praiseQueue: [], clock: 5 };
    pushPraise(game, 'NEW');
    assert.equal(game.praise.text, 'NEW');
    pushPraise(game, 'A'); pushPraise(game, 'B'); pushPraise(game, 'C'); pushPraise(game, 'D');
    assert.equal(game.praiseQueue.length, 2);
});

test('profile migration: a v1 save gains the v2 fields and keeps everything else', () => {
    const v1 = { muted: true, bestScores: { shift: 900 }, stars: 12, stats: { linesCleared: 40, maxCombo: 5 } };
    const { data, migrated } = migrateProfile(v1);
    assert.equal(migrated, true);
    assert.equal(data.version, PROFILE_VERSION);
    assert.equal(data.stars, 12);
    assert.equal(data.stats.linesCleared, 40);
    assert.equal(data.stats.runs, 0);
    assert.deepEqual(data.boons, []);
    assert.equal(v1.version, undefined, 'the input is not mutated');
    assert.equal(migrateProfile(data).migrated, false, 'a current profile is left alone');
});

test('profile migration never throws on junk', () => {
    for (const junk of [null, undefined, 5, 'text', []]) {
        assert.doesNotThrow(() => migrateProfile(junk));
    }
    assert.equal(migrateProfile({ version: 99, stars: 3 }).data.stars, 3, 'a newer save is passed through');
});

test('score contracts scale with the player, but never in the Daily default', () => {
    const rand = () => 0;   // always pick the first eligible type, so the scoring type is chosen deterministically
    const pick = scale => {
        for (let seed = 0; seed < 400; seed++) {
            let s = seed;
            const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
            const found = makeContracts('classic', r, scale).find(c => c.type === 'score');
            if (found) return found;
        }
        return null;
    };
    const base = pick(1), hard = pick(2.5), easy = pick(0.6);
    assert.ok(base && hard && easy);
    assert.equal(hard.target, Math.round(base.target * 2.5 / 100) * 100);
    assert.ok(easy.target < base.target);
    assert.ok(easy.target >= 500);
    assert.equal(typeof rand(), 'number');
});

test('a started run is seeded, logged, and replays to the same score', async () => {
    const { GridShiftModel } = await import('../src/gridshift/GridShiftModel.js');
    const { replayRun } = await import('../src/gridshift/GridShiftReplay.js');
    const P = GridShiftMain.prototype;
    const noop = () => {};
    const game = Object.assign(Object.create(P), {
        model: new GridShiftModel(), bestScores: { classic: 0, shift: 0, daily: 0 }, audio: { unlockAndPlay: noop, setHeat: noop },
        dailyKey: () => '2026-11-04', activeBoons: () => ['twist'], tutorialDone: true, tutorialStep: -1,
        setStatus: noop, snapAnimations: new Map(), screen: 'home', modal: ''
    });
    game.startRun('classic');
    assert.ok(Number.isInteger(game.runLog.seed));
    assert.equal(game.runLog.rules.rotate, true);
    assert.equal(game.model.rules.rotate, true);
    const m = game.model;
    for (let i = 0; i < 12; i++) {
        let placed = false;
        for (let slot = 0; slot < 3 && !placed; slot++) {
            if (m.tray[slot].used) continue;
            for (let y = 0; y < 8 && !placed; y++) for (let x = 0; x < 8 && !placed; x++) {
                if (m.placePiece(slot, { x, y }).ok) { game.logMove({ t: 'p', slot, x, y }); placed = true; }
            }
        }
    }
    assert.ok(game.exportRun().moves.length >= 10);
    assert.equal(replayRun(game.exportRun()).score, m.score);
});

test('every game module is precached by the service worker, so offline play cannot break', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
    const files = readdirSync(new URL('../src/gridshift/', import.meta.url)).filter(f => f.endsWith('.js'));
    assert.ok(files.length >= 12);
    for (const file of files) assert.ok(sw.includes(`./src/gridshift/${file}`), `${file} is missing from sw.js CORE`);
});
