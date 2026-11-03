import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftAudio } from '../src/gridshift/GridShiftAudio.js';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';

test('a move selects exactly one ordinary or clear haptic', () => {
    const pulses = [];
    const game = {
        vibrate: pattern => pulses.push(pattern),
        hapticClear(lines, combo) { this.vibrate(`clear:${lines}:${combo}`); }
    };
    const hapticForMove = GridShiftMain.prototype.hapticForMove;

    hapticForMove.call(game, 0, 0);
    hapticForMove.call(game, 2, 1);

    assert.deepEqual(pulses, [12, 'clear:2:1']);
});

test('music has no source at initialization and loads only when playback is requested', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    let loadCount = 0;
    const element = {
        paused: true,
        setAttribute() {},
        load() { loadCount++; },
        play() { this.paused = false; return Promise.resolve(); },
        pause() { this.paused = true; }
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { createElement: () => element }
    });

    try {
        const audio = new GridShiftAudio();
        audio.init({ appendChild() {} });
        assert.equal(element.preload, 'none');
        assert.equal(element.src, undefined);
        assert.equal(loadCount, 0);

        audio.unlockAndPlay();
        assert.equal(element.src, './assets/gridshift_theme.ogg');
        assert.equal(loadCount, 1);

        audio.unlockAndPlay();
        assert.equal(loadCount, 1);
    } finally {
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else delete globalThis.window;
        if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
        else delete globalThis.document;
    }
});


test('finishing a run records the best score, saves, and opens the results window', () => {
    let saved = 0;
    let heat = null;
    const game = {
        model: { score: 2600 },
        mode: 'shift',
        runFinalized: false,
        tutorialStep: -1,
        bestScores: { classic: 0, shift: 900, daily: 0 },
        saveProfile() { saved++; },
        audio: { setHeat: value => { heat = value; } }
    };
    GridShiftMain.prototype.finishRun.call(game, 'stuck');
    assert.equal(game.bestScores.shift, 2600);
    assert.equal(game.modal, 'results');
    assert.equal(game.endReason, 'stuck');
    assert.equal(saved, 1);
    assert.equal(heat, 1);
    GridShiftMain.prototype.finishRun.call(game, 'stuck');
    assert.equal(saved, 1, 'a finished run is only recorded once');
});

test('a lower score never replaces the best score', () => {
    const game = {
        model: { score: 500 },
        mode: 'classic',
        runFinalized: false,
        tutorialStep: -1,
        bestScores: { classic: 900, shift: 0, daily: 0 },
        saveProfile() {},
        audio: { setHeat() {} }
    };
    GridShiftMain.prototype.finishRun.call(game, 'stuck');
    assert.equal(game.bestScores.classic, 900);
});
