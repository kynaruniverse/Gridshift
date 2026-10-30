# GridShift: Break & Build

A mobile-first browser puzzle game. Drag polyominoes from the tray onto the 8×8 board, clear rows and columns to earn Shift Charges, then use a direction button and tap a board line to wrap-shift it. Classic mode is endless; Fever Rush is timed. Scores, sound preference, crystals, and island restoration are stored in the browser on this device.

## Run in Spck Editor

Open this project folder in Spck and run its preview/server. The project is plain HTML, CSS, and JavaScript modules; there is no bundler or dependency install step.

## Run on a computer

With Python 3 installed, run `npm run dev` and open `http://localhost:4173`. Do not open `index.html` as a `file://` URL; browsers block some module and asset loading in that mode.

Run `npm run check` for syntax checks and `npm test` for the model tests.

## Controls

- Drag one of the three offered pieces onto the board.
- Clearing lines grants Shift Charges (two per line in Fever Rush).
- Tap **SHIFT** or one of the four direction buttons, then tap a cell in the row or column to move it one cell with wraparound.
- Use **Island Builder** to spend earned crystals on restoration stages.

The project uses only the optimized GridShift art and theme music under `assets/`; unrelated Plushie template assets and code are not part of this build.
