import { SUBJECTS } from "@/menus/catalog";
import { Menu } from "@/menus/Menu";

export default function HomePage() {
  return (
    <Menu
      title="מה נלמד היום?"
      choices={SUBJECTS.map((subject) => ({
        id: subject.id,
        label: subject.name,
        icon: subject.glyph,
        href: `/subjects/${subject.id}`,
        color: `var(--color-subject-${subject.id})`,
      }))}
    />
  );
}
