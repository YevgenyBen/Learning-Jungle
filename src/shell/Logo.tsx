import styles from "./Logo.module.css";

/**
 * The company logo. Until the Parent supplies the real file (it will live in
 * public/logo/), this is a text placeholder. To switch, render
 * <img src="/logo/logo.svg" alt="קיסקה וקוט"> here instead; nothing else
 * needs to change.
 */
export function Logo() {
  return (
    <div className={styles.logo} data-testid="logo" role="img" aria-label="קיסקה וקוט">
      <span className={styles.mark} aria-hidden="true">
        🐾
      </span>
      <span className={styles.name}>קיסקה וקוט</span>
      <span className={styles.tagline}>משחקי לימוד</span>
    </div>
  );
}
