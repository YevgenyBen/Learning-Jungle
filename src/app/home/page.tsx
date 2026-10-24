import { SUBJECTS } from "@/menus/catalog";
import { Menu } from "@/menus/Menu";
import { ParentControl } from "@/shell/ParentControl";

export default function HomePage() {
  return (
    <Menu
      title="מה נלמד היום?"
      entries={SUBJECTS.map((subject) => ({
        id: subject.id,
        label: subject.name,
        icon: subject.glyph,
        href: `/subjects/${subject.id}`,
        color: `var(--color-subject-${subject.id})`,
      }))}
      footer={<ParentControl />}
    />
  );
}
