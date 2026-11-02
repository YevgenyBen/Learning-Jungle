import styles from "./Logo.module.css";

/**
 * Where the logo is shown. The Opening Screen shows it big and alone; the
 * Home Menu shows it above the Subjects; Subject Menus show it small in the
 * header; the pause screen shows it above Continue. Never during play.
 */
export type LogoPlace = "opening" | "home" | "menu" | "pause";

/** The company logo, from public/logo/. */
export function Logo({ place = "opening" }: { readonly place?: LogoPlace }) {
  const opening = place === "opening";
  return (
    // A plain <img>, like WordPicture: the app is a static export, so
    // next/image can't optimise anyway.
    <img
      src="/logo/logo.png"
      // Named once, on the Opening Screen; elsewhere it is decoration.
      alt={opening ? "קיסקה וקוט" : ""}
      width={500}
      height={500}
      className={`${styles.logo} ${styles[place]}`}
      data-testid={opening ? "logo" : `logo-${place}`}
      draggable={false}
    />
  );
}
