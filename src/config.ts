/** Firebase web settings come from VITE_FIREBASE_* (see .env.example). They are public by design. */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

/** Without Firebase settings the app runs in local test mode: progress stays in this browser. */
export const hasFirebase = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

declare global {
  const __BUILD_ID__: string;
  const __BUILT_AT__: string;
}
export const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
export const BUILT_AT = typeof __BUILT_AT__ === 'string' ? __BUILT_AT__ : new Date().toISOString();
