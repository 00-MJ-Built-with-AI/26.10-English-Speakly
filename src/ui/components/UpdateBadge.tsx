import { useEffect, useState } from 'react';
import { BUILD_ID } from '../../config.ts';

/** Shows "Update available" when a newer build is online; tapping reloads into it. */
export function UpdateBadge() {
  const [newer, setNewer] = useState(false);
  useEffect(() => {
    if (BUILD_ID === 'dev') return;
    const check = () =>
      fetch('/version.json', { cache: 'no-store' })
        .then((r) => r.json())
        .then((v: { id: string }) => setNewer(v.id !== BUILD_ID))
        .catch(() => {});
    check();
    const t = setInterval(check, 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  if (!newer) return null;
  return (
    <button
      className="chip brand"
      onClick={async () => {
        const reg = await navigator.serviceWorker?.getRegistration();
        reg?.waiting?.postMessage('skipWaiting');
        location.reload();
      }}
    >
      Update available
    </button>
  );
}
