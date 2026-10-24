# Learning Jungle

A Hebrew-only, landscape-only learning app for a first-grade child (Kiska & Kot Interactive). Next.js without a server (`docs/adr/0001`); terms follow `GLOSSARY.md`.

- `npm run dev`: the app on port 3000, reachable from phones on the same Wi-Fi.
- `npm test`, `npm run test:e2e`, `npm run test:all`: unit tests, Playwright, everything.

## Generating Voice Clips

Every spoken item (Words, Letter Names, the shared sounds of Letter Sounds, numbers 0-100) gets a Voice Clip generated once with the Azure neural voice `he-IL-HilaNeural` (`docs/adr/0002`). The clips and their manifest (`public/voice/manifest.json`) are committed and shipped with the app. Until an item has a clip, the app uses Speech Fallback.

### Once: the Azure key

1. In the Azure portal, create a **Speech** resource (the free F0 tier is enough: its monthly allowance is far more than the few thousand characters all clips need).
2. Copy `.env.azure.example` to `.env.azure.local` in the repository root and fill in the resource's key and region (Keys and Endpoint page), for example `AZURE_SPEECH_REGION=westeurope`.

`.env.azure.local` is ignored by git. Never commit the key.

### Generate the missing clips

```
npm run voice-clips
```

It generates a clip for every spoken item that has none yet, saves it as `public/voice/<identity>.mp3` and updates the manifest after every clip, so an interrupted run can simply be started again. To stay within the free tier's rate, requests are about 3 seconds apart: the first full run (about 330 clips) takes roughly 17 minutes. Running it again generates nothing unless items are missing.

Then listen to the clips, and commit `public/voice/`.

### Listen and flag: the review page

With `npm run dev` running, open `http://localhost:3000/dev/voice-clips`. It lists every spoken item with its identity, text and a play button; items without a clip are greyed out and marked "חסר". Tick the bad clips and press "העתקה": the page copies the ready `npm run voice-clips -- <identities>` command (if the browser won't allow the clipboard, for example over plain http from a phone, the command is selected in its box to copy by hand). Flags live only on the page and are gone on reload.

The page exists only under `next dev`: development-only pages are named `page.dev.tsx`, which only the dev server routes (`next.config.ts`), and `npm run test:build` checks that a production build has neither the route nor its code.

### Regenerate flagged clips

Pass the identities to redo, separated by spaces, exactly as the Voice Clip review page copies them:

```
npm run voice-clips -- word-apple sound-ba number-21
```

Only those are generated, whether or not they already have a clip.

### Fix a pronunciation

Give the item a `pronunciation` in the Content Bank's data (`src/content/data/`); it is used only for generation, never shown. Then regenerate that item as above. A plain `npm run voice-clips` lists the clips whose text has changed since they were generated, with the command to regenerate them.

### Replace a clip with your own file

Delete the item's old file from `public/voice/`, put yours there under the same identity (`word-apple.wav`, `.mp3`, `.m4a`, `.ogg`, ...) and run `npm run voice-clips`: it takes the file into the manifest and generates nothing. Two files for one identity are refused. Regenerating that identity later replaces your file with a generated one.

### Beyond what #10 asked for

The script does a little more than generate missing clips and regenerate listed ones. Each is kept on purpose:

- **Adopts dropped-in files** into the manifest: so a hand-made clip needs no manual manifest edit.
- **Refuses two files for one identity** before generating anything: otherwise which one plays would be a guess.
- **Drops manifest entries for items no longer in the Content Bank**, keeping their files: the manifest stays exactly the spoken items, and nothing you made is deleted.
- **Reports clips made from text that has changed since**, with the command to regenerate them: a new pronunciation override is never silently ignored, and nothing is regenerated without you asking.
