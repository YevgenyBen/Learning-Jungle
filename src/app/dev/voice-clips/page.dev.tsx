import { VoiceClipReview } from "@/voice/review/VoiceClipReview";

// Development only: `.dev.tsx` pages are routed by `next dev` alone
// (next.config.ts), so a production build has no /dev/voice-clips.
export default function VoiceClipReviewPage() {
  return <VoiceClipReview />;
}
