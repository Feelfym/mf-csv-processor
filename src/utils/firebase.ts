import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  Auth,
  User,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase Web アプリの公開設定（アクセス制御は Firestore Security Rules と承認済みドメインで保護されます）
// 環境変数 VITE_FIREBASE_* が設定されている場合はそちらを優先します
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAwsS2ZLnq8qJGSaRKgb_E2h2VBDrM0-7w',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mf-csv-processor.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mf-csv-processor',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mf-csv-processor.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '214288296127',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:214288296127:web:fadbc8ad2309c4d3357e0a',
};

/** Firebase の環境変数が設定されているか */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

export { auth, db };
export type { User as FirebaseUser };

export const signInWithGoogle = async (): Promise<User> => {
  if (!auth || !googleProvider) {
    throw new Error('Firebase の設定がまだ完了していません。');
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    if (err?.code === 'auth/unauthorized-domain') {
      throw new Error(
        `現在のドメイン（${window.location.hostname}）が Firebase の承認済みドメインに登録されていません。Firebase Console の Authentication > Settings > 承認済みドメイン に追加してください。`
      );
    }
    throw err;
  }
};

export const signOutGoogle = async (): Promise<void> => {
  if (!auth) return;
  await signOut(auth);
};

export const subscribeAuthState = (
  callback: (user: User | null) => void
): (() => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};
