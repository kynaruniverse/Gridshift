import { GridShiftModel } from './gridshift/GridShiftModel.js';
import { GridShiftAudio } from './gridshift/GridShiftAudio.js';
import { GridShiftMain } from './gridshift/GridShiftMain.js';
import { renderMethods } from './gridshift/GridShiftRender.js';

Object.assign(GridShiftMain.prototype, renderMethods);

const container = document.querySelector('#game-container');
if (!container) throw new Error('Missing #game-container element');

const model = new GridShiftModel();
model.reset('classic');
const audio = new GridShiftAudio();
audio.init(container);
const game = new GridShiftMain(model, audio, container);

['touchend', 'pointerup'].forEach(type => {
    document.addEventListener(type, () => audio.resumeContext(), { passive: true });
});

let previous = 0;
function frame(timestamp) {
    const delta = previous ? Math.min((timestamp - previous) / 1000, 0.1) : 0;
    previous = timestamp;
    game.trackFrame(timestamp);
    game.update(delta);
    game.render();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Offline caching is only for the standalone site; portals host the game in their own iframe.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && window.self === window.top) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(error => {
            console.warn('GridShift offline support unavailable:', error);
        });
    });
}