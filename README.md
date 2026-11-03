# GridShift

The block puzzle where you can slide the board. Drag pieces onto an 8×8 board, clear rows and columns, build Heat for bigger scores, and finish contracts to earn stars that unlock new looks. It is a mobile-first browser game written in plain HTML, CSS and JavaScript modules, with no bundler, no dependencies and no image files. Scores, stars and settings are stored in this browser on this device.

## Run in Spck Editor

Open this project folder in Spck and run its preview/server. There is no install step.

## Run on a computer

With Python 3 installed, run `npm run dev` and open `http://localhost:4173`. Do not open `index.html` as a `file://` URL; browsers block module loading in that mode. Run `npm run check` for syntax checks and `npm test` for the tests. Add `?fps` to the address to show a frame-rate counter.

## How it plays

- **Place:** drag one of the three offered pieces onto the board. Fill a row or column to clear it. The run ends when no piece fits (and, in Shift mode, no single slide would help).
- **Shift:** swipe along a row or column to slide it one cell with wraparound. A slide costs one charge. You start with one charge, earn another for every three lines cleared, and hold at most three. Slides that clear lines count; slides that clear nothing never break your Heat.
- **Heat:** every clear raises a score multiplier up to ×8, and every move scores at the Heat you had before it. Two lines at once raise it by two. The first move without a clear is free; later ones cool it a step. At ×8 the next clear is a Surge: it also sweeps the fullest remaining line, scores a bonus, and drops Heat to ×5.
- **Contracts:** every run has three goals, one easy (1 star), one medium (2) and one hard (3). Stars are yours the moment a contract is done, even if the run ends badly.
- **Undo:** each run allows one undo.

## Modes

- **Shift:** the main mode, with slides.
- **Classic:** the same board without slides.
- **Daily:** Shift rules with the same pieces and the same contracts for everyone on a given UTC day. It keeps a streak and a share button.

## The Locker

Stars unlock looks only; nothing changes how the game plays.

| Unlock | Stars |
|---|---|
| Berry board theme | 10 |
| Candy tile skin | 25 |
| Mint board theme | 45 |
| Retro tile skin | 70 |

## Code map

- `src/gridshift/GridShiftModel.js`: the board, pieces, scoring, Heat, Surge and Shift rules. No drawing.
- `src/gridshift/GridShiftContracts.js`: contract types, targets and progress. Pure logic.
- `src/gridshift/GridShiftUnlocks.js`: what stars unlock. Pure logic.
- `src/gridshift/GridShiftMain.js`: input, game flow, profile saving, effects.
- `src/gridshift/GridShiftRender.js`: every screen, drawn in code (tiles, panels, themes and skins included).
- `src/gridshift/GridShiftAudio.js`: music and sound effects.
- `sw.js`: offline caching. Bump the version in it whenever you ship a change.

The only assets are the app icons, the share image, and the theme music under `assets/`.
