# GridShift: Break & Build

A mobile-first browser puzzle game. Drag colorful polyominoes from the tray onto the 8×8 board, clear rows and columns, and use the crystals you earn to restore floating islands. Classic mode is endless; Fever Rush is timed. Scores, sound preference, crystals, and island restoration are stored in this browser on this device.

## Run in Spck Editor

Open this project folder in Spck and run its preview/server. The project is plain HTML, CSS, and JavaScript modules; there is no bundler or dependency install step.

## Run on a computer

With Python 3 installed, run `npm run dev` and open `http://localhost:4173`. Do not open `index.html` as a `file://` URL; browsers block some module and asset loading in that mode.

Run `npm run check` for syntax checks and `npm test` for the model and interaction tests.

## Visual identity and layout

The refreshed interface uses a bright, rounded candy palette with a soft blue **Candy** theme, berry pink **Berry** theme, and fresh green **Mint** theme. Nunito is used for readable UI text and Baloo 2 for playful headings. The game screen focuses on the score, board, short placement hint, and enlarged three-piece dock; direction controls are removed. The home screen keeps the island and play actions central. Theme choice is saved with the existing profile.

The visual implementation is in `src/gridshift/GridShiftRender.js`; high-density canvas scaling and theme validation are in `src/gridshift/GridShiftMain.js`; page framing and font loading are in `styles.css` and `index.html`.

## Gameplay and progression

Place pieces wherever they fit and clear full rows or columns to score and open board space. The run ends when none of the available pieces can fit. The undo button remains available for two crystals. Cloud City now increases crystal rewards by 5% per restored stage (up to 25%); the other island perks continue to grant crystals per run and starting score.

## Motion, sound, and haptics

Successful drops ease from the release point into their board cells with a small stagger. Clears use color-matched sparkle particles and one brief praise label, without redundant flash/burst overlays. The effect is capped at 60 live particles; reduced-motion preferences get shorter, sparser effects. Each move selects one haptic pattern through the browser Vibration API when supported. Music loads only when playback is first requested.

## Controls

- Drag one of the three offered pieces onto the board.
- Clear rows and columns to earn points and keep the board open.
- Use **Undo** to reverse the last move for two crystals.
- Use **Island Builder** to spend crystals on restoration stages.

The project uses only the optimized GridShift art and theme music under `assets/`; unrelated Plushie template assets and code are not part of this build.
