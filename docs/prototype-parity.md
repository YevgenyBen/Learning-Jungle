# Prototype parity: the rabbit Game

The rabbit Game is a port of the single-page prototype `bunny-hop.html`, which was deleted once this checklist was complete (#12). Git history keeps it: `git show cacbc62:bunny-hop.html`. Line numbers (`L123`) refer to that file.

Each behaviour of the prototype is marked:

- **ported**: the port does the same, with where it lives.
- **deliberate change**: the port differs on purpose, with the reason (spec #1, an ADR, or a decision by the Parent).
- **dropped**: removed, with why.

Paths are relative to `src/`. The rabbit's model is `games/rabbit/model.ts`, its drawing `games/rabbit/draw.ts`, its DOM parts `games/rabbit/RabbitView.tsx` (+ `.module.css`).

## Physics and input

| Prototype behaviour | Status | Where / why |
|---|---|---|
| Gravity 2300, jump -760, short-hop cap -330, ground 290, rabbit x 160, logical 900x360 world (L274-275) | ported | `WORLD`, `GRAVITY`, `JUMP_VELOCITY`, `SHORT_HOP_VELOCITY` in the model |
| Variable jump height: releasing early caps the upward speed (L976-981) | ported | model `act("main-release")`; tested in `model.test.ts` "a longer press jumps higher" and `rabbit.spec.ts` |
| 120 ms jump buffer: a press just before landing jumps on landing (L971, L586-587) | ported | model `JUMP_BUFFER` |
| Time step per animation frame clamped to 0.033 s (L1028) | ported | `frame/GameFrame.tsx` `MAX_TICK_STEP`; the model also substeps at 1/30 s |
| Landing squash and rising stretch (L604, L831-834) | ported | model `rabbit.squash`; `drawRabbit` |
| Landing dust puff: six specks behind the feet (L558-562, L605) | ported (#12) | model `landings` (kept 0.5 s); `drawLandingDust` |
| Jump on Space, ArrowUp, W, tap or click; key repeat ignored; release on keyup or pointerup anywhere (L1000-1018) | ported | `frame/frameKeys.ts` (Space) + `mainActionKeys` in `games/rabbit/index.ts`; pointer on the play surface in `GameFrame.tsx` `Play` |
| Enter restarts in any state (L1006) | ported | `frameKeys.ts`. Spec #1 also lists Enter as a main action; the Parent decided Enter = restart in a Game (decisions), and Enter picks the focused choice on Menus and the Round Celebration screen |
| Digit keys 0-3 set the speed (L1007-1010) | deliberate change | Parent decision: no 0-3 speed keys; speed is set through the Game Frame's Difficulty control (button, or key D) |
| Holes, walking off an edge, falling, the fall sound, X eyes, the fall clip, the `over` state and "נפלת לבור!" overlay, the 450 ms restart guard (L276-277, L547-549, L589-608, L704-718, L725, L803, L811-816, L875, L942-957, L973) | deliberate change | spec #1 story 60 and Out of Scope: no holes or platforming, no game over |
| Canvas focusable, toolbar buttons hand focus back to it so Space keeps jumping (L375, L994-998) | ported (differently) | `frameKeys.ts` calls `preventDefault` on main-action keys, so Space never presses a focused control, wherever focus is |
| Stage `touch-action: manipulation`, `user-select: none` (L153-163) | ported | `app/globals.css`; the play surface uses `touch-action: none` (`GameFrame.module.css`) |

## Speed (the rabbit's Difficulty)

| Prototype behaviour | Status | Where / why |
|---|---|---|
| Slow 170, medium 280, fast 400 px/s; automatic is the default (L278-280) | ported | model `SPEEDS`; the ordered options in `games/rabbit/index.ts` |
| Automatic: slow + 30 px/s per two completed Words, capped at fast, easing at 40 px/s², frozen during a Celebration (L444-446, L566-571) | ported | model `autoSpeed`, `AUTO_SPEED_EASING`, `playing()` |
| A fixed speed applies at once (L988-992) | ported | model `configure` |
| Switching to automatic eases from the current speed toward the Words' speed (L988-992) | deliberate change | #8: a change of speed applies at once, so switching to automatic sets the speed the completed Words have earned straight away (model `configure`; tested). Only automatic's own step-ups after a Celebration ease in |
| Restart resets automatic speed (L387) | ported | restart makes a fresh model (`GameFrame.tsx` `restart`) |
| — (no Rounds) | deliberate change | spec #1: automatic speed carries into "another Round" (`nextRound`) |
| Speed not stored | deliberate change | spec #1 story 26 / #8: Difficulty is remembered per Game on the device (`frame/preferences.ts`) |
| Segmented speed control with four buttons (L241-247) | deliberate change | spec #1: one Difficulty control in the Game Frame that cycles the options (`frame/SettingsControls.tsx`, options in `games/rabbit/index.ts`) |

## Letter tiles

| Prototype behaviour | Status | Where / why |
|---|---|---|
| Tile spacing from `speed * airtime`: slot 70-280, gap `rand(1, 2.2) * speed * airtime + 90`; first slot at `W + 220` (L457-466, L391) | ported | model `spawn` |
| Tile height `ground - rand(104, 112)`: out of reach running, in reach of any jump (L474) | ported | model `TILE_HEIGHT`; tested |
| Needed letter 85% when none is still coming, else a decoy 40%; at most one needed tile ahead; a missed one comes again (L470-482) | ported | model `maybeTile`; tested "a missed needed letter comes again" |
| Decoys never the needed letter, drawn from the 22 base letters (L404, L479) | ported | model `pickDecoy`, decoys from the Content Bank's `letters()` without final forms |
| Letters from the 25 inline Words, spelled without Niqqud | deliberate change | spec #1 stories 51-52: the letters of the Voweled or Plain Spelling, per the Niqqud setting; with Niqqud on, tiles show the needed letter with its marks and decoys with its vowel |
| Tile bob `sin(4t) * 4` with a random phase; culled at x < -50 (L743, L578) | ported | model `bob`, `CULL_BEHIND`; `drawTile` |
| No tiles spawn during the Word's Celebration (L471) | ported | model `maybeTile` / `playing()`; tested |
| Tiles still on screen when a Word ends are live for the next Word (L613-618) | ported | kept on purpose (noted in the model) |

## Collecting letters

| Prototype behaviour | Status | Where / why |
|---|---|---|
| Reach box `|dx| < 32`, tile y within (feet - 95, feet + 30); nothing collected during a Celebration (L612-618) | ported | model `REACH`, `step`; tested |
| Right letter: fills its slot with a pop, collect beep, Letter Name said, cutting off the previous one (L522-538) | ported | model `touch` (`say` with `interrupt: true`, `sound: collect`); slot pop in `RabbitView.module.css`; voice via `voice/voicePlayer.ts` |
| Collected tile floats up 30 px, grows 1.4x and fades in a third of a second, orange (L742-761) | ported | model `COLLECTED_FADE`; `drawTile` |
| Wrong letter: collected in red, takes the last filled letter away, the lost slot shakes (L539-544) | deliberate change | ADR-0005 / spec #1 story 47: a wrong letter is not collected and removes nothing; the tile gives a soft shake and turns grey (`rejected`) |
| Mistake feedback: a sawtooth buzz (220 to 110 Hz) and a red flash over the meadow (L540-541, L921-924) | deliberate change | spec #1 story 33 "gentle feedback": a soft triangle "hm" (`sound/soundEffects.ts`) and the tile's shake; no red flash |
| — | deliberate change | spec #1 story 50: after two wrong letters in a Challenge, the Hint highlights the needed letter's tiles and its slot until the Challenge ends |

## Words and the word bar

| Prototype behaviour | Status | Where / why |
|---|---|---|
| Picture plus one slot per letter: faint outline, next slot dashed orange, filled slot orange (L425-442, CSS L63-92) | ported | `RabbitView.tsx` `WordBar` |
| Filled slots show the bare letter | deliberate change | with Niqqud on, every slot shows the letter with its marks |
| "האות הבאה:" with the next letter, and "כל הכבוד!" when the Word is complete (L236, L438-439) | dropped | it repeats what the dashed next slot already shows; spec #1 story 44 asks only for the next letter to be clearly marked, and the Celebration sign marks the win. Keeps the word bar short on phones |
| Win: carrot ring, slots hop with a 70 ms stagger, the Picture dances; off under reduced motion (L127-139, L434, L440-441) | ported | `RabbitView.module.css` (`data-complete`, `hop`, `party`, `prefers-reduced-motion`) |
| 25 inline fruit and vegetable Words with emoji | deliberate change | spec #1: Words come from the Content Bank (about 80, four Categories) with Twemoji Picture files |
| Shuffle bag, no repeat until all Words have come; survives restart (L409-423) | ported, improved | model `createWordBag`; a fresh bag never starts with the Word that ended the last one (spec #1 story 59). Restart makes a fresh model, so the bag starts afresh too; repeats within a Round are still impossible |
| `aria-live="polite"` on the word bar | dropped | the Word and letters are said aloud (Voice Clips); the slots carry an `aria-label` with the Word |

## The Word's Celebration

| Prototype behaviour | Status | Where / why |
|---|---|---|
| 1.6 s with no spawns and no collecting, then the next Word (L406, L531, L619) | ported | model `CELEBRATION_PAUSE`; tested |
| Star burst of 14 from the rabbit and 80 confetti pieces, with the prototype's numbers (L484-503) | ported | `drawParty` (worked out from the time since the Word, seeded per Celebration) |
| Backflip in 0.5 s, bounces settling over 1.4 s, happy "^" eye and smile (L819-829, L877-879) | ported | `drawRabbit` |
| Springy sign for 1.8 s with the Picture and the Word: back-out pop, wobble, fade from 1.3 s (L763-798) | ported | `CelebrationSign` in `RabbitView.tsx` (DOM over the canvas so the Picture file and Hebrew text render well; CSS keyframes approximate the pop and wobble) |
| "+50" on the sign (L791) | deliberate change | spec #1: no points |
| "מהירות עולה!" under the sign when automatic speed is about to rise (L530, L792-796) | ported | model `celebrated.speedRising`; `CelebrationSign`; tested |
| The Word said after its last Letter Name, queued (L529) | ported | model `say(word, interrupt: false)`; tested |
| C-E-G-C arpeggio; no collect beep for the last letter (L533) | ported | `sound: challenge-complete`, `soundEffects.ts` `ARPEGGIO` |
| — (endless run) | deliberate change | spec #1 stories 28-31, 55: a Round is three Words; the third ends it with a Round Celebration request, the "round-complete" Sound Effect and the Frame's screen with "עוד סיבוב" / "חזרה" (`frame/RoundCelebration.tsx`) |
| — | deliberate change | spec #1 story 29: Round progress (Words out of three) shown (`frame/RoundProgress.tsx`) |

## Points and storage

| Prototype behaviour | Status | Where / why |
|---|---|---|
| Distance points, +5 per letter, +50 per Word; score, Words and best chips; best score in `localStorage['bunny-hop-best']` (L227-229, L302-305, L405, L448-455, L572, L950-955) | deliberate change | spec #1 / story 27: no points, scores or best score; Round progress replaces them, and nothing about play is stored |
| Nothing else stored | deliberate change | spec #1 story 26: mute, Niqqud and Difficulty per Game are remembered, read defensively (`frame/preferences.ts`) |

## Sound and voice

| Prototype behaviour | Status | Where / why |
|---|---|---|
| `beep()` oscillator tones made in code, skipped silently on failure (L318-334) | ported | `sound/soundEffects.ts`, behind named effects (jump, collect, mistake, challenge-complete, round-complete) |
| Jump `380 to 760 Hz, 0.14 s, square`; collect `880 to 1320 Hz, 0.12 s, sine`; arpeggio (L555, L536, L533) | ported | `soundEffects.ts` `RECIPES` |
| Browser `speechSynthesis` with a Hebrew voice, rate 0.9; Letter Names inline (L341-373) | deliberate change | ADR-0002: Voice Clips first, Speech Fallback (the same browser voice) second (`voice/voicePlayer.ts`); Letter Names live in the Content Bank (`content/data/letters.ts`) |
| "No Hebrew voice in this browser" note (L238, L355-361) | dropped | ADR-0002 / ADR-0004: Voice Clips ship with the app, and sound is optional; nothing asks the Player about it |
| Mute button and M key silence effects and speech (L335-340, L1013) | ported | `frame/output.ts`, `FrameControls.tsx`, `frameKeys.ts`; now remembered on the device (#8) |
| Arpeggio scheduled with `setTimeout`, ignoring a later mute or pause | deliberate change | tones are scheduled on the audio clock and cut off by mute, pause, restart or leaving (`SoundEffects.stop`) |

## Frame and flow

| Prototype behaviour | Status | Where / why |
|---|---|---|
| P or Esc toggles pause; tab hidden or window blur pauses; Space resumes (L959-972, L1011, L1020-1021) | ported | `GameFrame.tsx` (`useAutoPause`, `main` while paused), `frameKeys.ts`, `PauseScreen.tsx` |
| Restart (button and Enter) works in any state, cuts off speech, starts fresh (L983-986) | ported | `GameFrame.tsx` `restart` |
| Canvas sized to its box at up to 2x device pixels, drawn in logical coordinates (L308-316) | ported | `Meadow` in `RabbitView.tsx` (plus a ResizeObserver) |
| Start overlay "מוכנים לקפוץ?" whose text describes the old rules, and the "התחילו" button (L254-260) | deliberate change | spec #1: the Game starts from the Menu's tap, click or key, which also allows full screen; no start screen, and the old rules no longer apply |
| Pause overlay text "הארנב מחכה לכם…" (L962) | deliberate change | `PauseScreen.tsx`: a big "המשך" button, readable without reading (ADR-0004) |
| Key legend under the meadow (L263-269) | dropped | spec #1 stories 4, 25: every action has a big on-screen control, and a pre-reader can't read a legend; the key layout is shared by every Game |
| Title header "ארנב קופץ" | deliberate change | the Game's name is its Menu icon and the screen's accessible name (`main aria-label`) |
| — | deliberate change | spec #1: back to Menu, Niqqud control, full screen and landscape lock, the rotate screen (`frame/`, `shell/RotateScreen.tsx`) |
| No test hook (#1 and #3 assumed one) | deliberate change | spec #1 testing: a dev/test-only hook, `window.__learningJungleGame` (`frame/testHook.ts`), absent from production builds (`npm run test:build`) |

## Meadow and rabbit drawing

| Prototype behaviour | Status | Where / why |
|---|---|---|
| Sky gradient, sun with halo, two parallax hill layers, soil, pebbles, grass band, tufts and flowers (L643-740 without holes) | ported | `drawSky`, `drawHills`, `drawGround` |
| Five clouds drifting with the meadow, each respawned at random when it leaves (L384, L581-584) | ported (differently) | `drawSky` works the clouds out from distance and time with fixed per-cloud values, so drawing keeps no state of its own; they wrap instead of respawning at random |
| Rabbit parts, run cycle, ear tilt, ground shadow (L800-891 without the fall) | ported | `drawRabbit` |
| Draw order: sky, hills, ground, tiles, dust, rabbit, sign (L912-925) | ported | `drawMeadow`; the sign is DOM above the canvas |
| Red tile for a wrong letter (L752) | deliberate change | wrong letters aren't collected (ADR-0005): a grey, shaking tile instead |

## Deliberate additions beyond the spec

Kept on purpose, though spec #1 doesn't ask for them:

| Addition | Where | Why it stays |
|---|---|---|
| Space (the main action) resumes a pause, as in the prototype (L970-972) | `GameFrame.tsx` (`main` while paused) | A keyboard Player resumes with the key they already play with, without finding "המשך" |
| N switches Niqqud on or off, D moves on to the next Difficulty | `frame/frameKeys.ts` | A Parent at a keyboard can change the settings without the mouse; no Game uses N or D |
| Integrity test: every Plain Spelling is its Voweled Spelling's letters with only ו and י added | `content/bank.test.ts` | Stricter than the glossary's "not simply the marks removed": it catches a Word whose two spellings disagree on a letter, a typo the Player would see |
| The Voice Clip script adopts dropped-in files, drops entries for removed items, refuses two files for one identity, and reports clips made from changed text | `scripts/voice-clips/` | See README.md, "Generating Voice Clips" |

## Covered by tests

- Seam 1 (`games/rabbit/model.test.ts`): the rules above marked tested, including landing dust.
- Seam 3 (`tests/e2e/round.spec.ts`): a whole Round played with real jumps (Space on desktop Chromium, taps on mobile Chromium and mobile WebKit) up to the Round Celebration screen; other specs cover the Frame, settings, voice and Menus.
