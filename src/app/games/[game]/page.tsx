import { notFound } from "next/navigation";
import { GameScreen } from "@/frame/GameScreen";
import { availableGames } from "@/menus/catalog";

// Static export: every available Game's page is generated at build time.
export const dynamicParams = false;

export function generateStaticParams() {
  return availableGames().map(({ game }) => ({ game: game.id }));
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const id = (await params).game;
  const found = availableGames().find(({ game }) => game.id === id);
  if (!found) notFound();

  return (
    <GameScreen gameId={found.game.id} backHref={`/subjects/${found.subject.id}`} />
  );
}
