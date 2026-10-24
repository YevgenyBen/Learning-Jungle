import Link from "next/link";
import styles from "./ParentControl.module.css";

/**
 * The small Parent control on the Home Menu: it leads to the credits screen.
 * Kept small and quiet in a corner so it stays out of the Player's way.
 */
export function ParentControl() {
  return (
    <Link href="/credits" className={styles.parent}>
      להורים
    </Link>
  );
}
