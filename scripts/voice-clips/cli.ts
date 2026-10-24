// `npm run voice-clips [-- <identities>]`: generates the missing Voice Clips,
// or regenerates exactly the listed identities. See README.md.
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { contentBank } from "../../src/content";
import { createAzureSynthesizer } from "./azure";
import { parseItemIds, readAzureConfig } from "./config";
import { generateVoiceClips } from "./generate";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const VOICE_DIR = join(ROOT, "public", "voice");
const ENV_FILE = join(ROOT, ".env.azure.local");

async function main(args: readonly string[]) {
  const option = args.find((arg) => arg.startsWith("-"));
  if (option) {
    console.log(
      "Usage: npm run voice-clips                    generate every missing Voice Clip\n" +
        "       npm run voice-clips -- <id> <id> ...   regenerate exactly these (as the review page copies them)",
    );
    return option === "--help" || option === "-h" ? 0 : 1;
  }
  const only = parseItemIds(args);
  const items = contentBank.spokenItems();

  const report = await generateVoiceClips({
    items,
    voiceDir: VOICE_DIR,
    ...(only.length > 0 ? { only } : {}),
    synthesizer: () => createAzureSynthesizer(readAzureConfig({ file: ENV_FILE, env: process.env })),
    onGenerated: (id, done, total) => console.log(`  ${done}/${total}  ${id}`),
  });

  for (const id of report.adopted) console.log(`Took the dropped-in file for ${id} into the manifest.`);
  for (const id of report.unlisted) console.log(`Dropped ${id} from the manifest: the Content Bank no longer says it (its file is kept).`);
  console.log(
    report.generated.length === 0
      ? `Nothing to generate: all ${items.length} spoken items have a Voice Clip.`
      : `Generated ${report.generated.length} Voice Clip(s) into public/voice/.`,
  );
  if (report.changed.length > 0) {
    console.log(
      `\n${report.changed.length} clip(s) were made from text that has changed since (a new pronunciation override?).\n` +
        `To regenerate them:\n  npm run voice-clips -- ${report.changed.join(" ")}`,
    );
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
