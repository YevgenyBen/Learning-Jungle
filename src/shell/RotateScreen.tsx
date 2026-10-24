import styles from "./RotateScreen.module.css";

/**
 * The app is landscape only. On a phone or tablet held upright this covers
 * everything with a big "turn the device" picture. It is pure CSS (see the
 * module), so it shows before any script runs and follows the device as it
 * turns. Computers (fine pointer) never see it, whatever the window shape.
 */
export function RotateScreen() {
  return (
    <div className={styles.rotate} data-testid="rotate-screen" role="alert">
      <svg className={styles.picture} viewBox="0 0 200 200" aria-hidden="true">
        <g className={styles.device}>
          <rect x="70" y="35" width="60" height="110" rx="10" />
          <circle cx="100" cy="132" r="5" />
        </g>
        <path className={styles.arrow} d="M150 80 A60 60 0 0 1 120 160" />
        <path className={styles.arrowHead} d="M108 150 L120 162 L130 147" />
      </svg>
      <p className={styles.message}>סובבו את המכשיר</p>
    </div>
  );
}
