import { notFound } from "next/navigation";
import { findSubject, gameHref, SUBJECTS } from "@/menus/catalog";
import { Menu } from "@/menus/Menu";

// Static export: every Subject Menu is generated at build time.
export const dynamicParams = false;

export function generateStaticParams() {
  return SUBJECTS.map((subject) => ({ subject: subject.id }));
}

export default async function SubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const subject = findSubject((await params).subject);
  if (!subject) notFound();

  return (
    <Menu
      title={subject.name}
      back={{ label: "חזרה", href: "/home" }}
      entries={subject.games.map((game) => ({
        id: game.id,
        label: game.name,
        icon: game.icon,
        href: game.available ? gameHref(game) : undefined,
        color: `var(--color-subject-${subject.id})`,
      }))}
    />
  );
}
