# GridShift: Break & Build

A mobile-first browser puzzle game. Drag polyominoes from the tray onto the 8×8 board, clear rows and columns to earn Shift Charges, then use a direction button and tap a board line to wrap-shift it. Classic mode is endless; Fever Rush is timed. Scores, sound preference, crystals, and island restoration are stored in the browser on this device.

## Run in Spck Editor

Open this project folder in Spck and run its preview/server. The project is plain HTML, CSS, and JavaScript modules; there is no bundler or dependency install step.

## Run on a computer

With Python 3 installed, run `npm run dev` and open `http://localhost:4173`. Do not open `index.html` as a `file://` URL; browsers block some module and asset loading in that mode.

Run `npm run check` for syntax checks and `npm test` for the model tests.

## Visual redesign

This build keeps the existing GridShift puzzle rules and supplied island/tile artwork, but refreshes the visual identity and screen hierarchy. The home screen focuses on the island and one primary Play action; the gameplay screen groups score controls, the framed board, shift controls, and piece tray into clearer surfaces; Island Builder uses larger horizontal restoration cards instead of narrow columns. Canvas rendering is scaled for high-density screens, and the Classic, Vaporwave, and Cyberpunk palettes now affect the full interface. Use the small theme control on Home or Island Builder to cycle themes. The selected theme is saved with the existing local profile.

The main visual implementation is in `src/gridshift/GridShiftRender.js`; high-density canvas scaling and stored-theme validation are in `src/gridshift/GridShiftMain.js`; page framing and the Nunito font link are in `styles.css` and `index.html`. Game mechanics and progression rules were not intentionally changed.

## Motion and haptics

Successful drops ease from the release point into their board cells with a small stagger and settle. Clears use color-matched sparkle particles and one brief praise label, without the redundant full-board flash/burst overlay or generic success toast. The effect is capped at 60 live particles; users who request reduced motion get shorter, sparser effects. Each move selects one haptic pattern (ordinary placement, special, or clear/combo) through the browser Vibration API when supported.

The background music source is assigned and loaded only when the first unmuted playback is requested, rather than being preloaded on the home screen.

## Controls

- Drag one of the three offered pieces onto the board.
- Clearing lines grants Shift Charges (two per line in Fever Rush).
- Tap **SHIFT** or one of the four direction buttons, then tap a cell in the row or column to move it one cell with wraparound.
- Use **Island Builder** to spend earned crystals on restoration stages.

The project uses only the optimized GridShift art and theme music under `assets/`; unrelated Plushie template assets and code are not part of this build.
