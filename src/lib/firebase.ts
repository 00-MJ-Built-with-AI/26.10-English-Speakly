import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type Auth, type User } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseConfig, hasFirebase } from '../config.ts';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

function init(): void {
  if (app || !hasFirebase) return;
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Offline cache: practice keeps working on a bad connection and syncs later.
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  storage = getStorage(app);
}

export function firebase(): { auth: Auth; db: Firestore; storage: FirebaseStorage } {
  init();
  if (!auth || !db || !storage) throw new Error('Firebase is not configured');
  return { auth, db, storage };
}

export function watchUser(cb: (u: User | null) => void): () => void {
  init();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<void> {
  const { auth } = firebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

export async function signOutUser(): Promise<void> {
  if (auth) await signOut(auth);
}

/** Fresh ID token for calls to our own /api functions. */
export async function idToken(): Promise<string | null> {
  init();
  return auth?.currentUser ? auth.currentUser.getIdToken() : null;
}
