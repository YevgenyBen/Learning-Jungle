import styles from "./Logo.module.css";

/** The company logo, from public/logo/. */
export function Logo() {
  return (
    // A plain <img>, like WordPicture: the app is a static export, so
    // next/image can't optimise anyway.
    <img
      src="/logo/logo.png"
      alt="קיסקה וקוט"
      width={500}
      height={500}
      className={styles.logo}
      data-testid="logo"
      draggable={false}
    />
  );
}
