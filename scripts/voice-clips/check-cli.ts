// `npm run voice-check [-- <identities>]`: has Azure speech to text listen to
// every Voice Clip not checked yet, or exactly the listed identities, and
// lists the suspect clips. See README.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { contentBank } from "../../src/content";
import { regenerationCommand } from "../../src/voice/review/command";
import { suspectClips, type ClipChecks } from "../../src/voice/review/suspects";
import { createAzureTranscriber } from "./azure";
import { checkVoiceClips } from "./check";
import { parseItemIds, readAzureConfig } from "./config";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const VOICE_DIR = join(ROOT, "public", "voice");
const REPORT = join(ROOT, "src", "voice", "review", "clipChecks.json");
const ENV_FILE = join(ROOT, ".env.azure.local");

async function main(args: readonly string[]) {
  const option = args.find((arg) => arg.startsWith("-"));
  if (option) {
    console.log(
      "Usage: npm run voice-check                    check every Voice Clip not checked yet\n" +
        "       npm run voice-check -- <id> <id> ...   check exactly these again",
    );
    return option === "--help" || option === "-h" ? 0 : 1;
  }
  const only = parseItemIds(args);
  const items = contentBank.spokenItems();

  const report = await checkVoiceClips({
    items,
    voiceDir: VOICE_DIR,
    reportPath: REPORT,
    ...(only.length > 0 ? { only } : {}),
    transcriber: () => createAzureTranscriber(readAzureConfig({ file: ENV_FILE, env: process.env })),
    onChecked: (id, done, total) => console.log(`  ${done}/${total}  ${id}`),
  });

  console.log(
    report.checked.length === 0
      ? "Nothing to check: every Voice Clip was checked as it is now."
      : `Checked ${report.checked.length} Voice Clip(s).`,
  );

  const checks = JSON.parse(readFileSync(REPORT, "utf8")) as ClipChecks;
  const suspects = suspectClips(contentBank, checks);
  if (suspects.size === 0) {
    console.log("No suspect clips.");
    return 0;
  }
  console.log(`\n${suspects.size} suspect clip(s), marked on the review page (/dev/voice-clips). Listen before regenerating:`);
  for (const [id, suspicion] of suspects) {
    console.log(`  ${id.padEnd(24)} ${suspicion === "silent" ? "no speech heard" : `heard: ${checks.checks[id].heard}`}`);
  }
  console.log(`\nTo regenerate them all:\n  ${regenerationCommand([...suspects.keys()])}`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
