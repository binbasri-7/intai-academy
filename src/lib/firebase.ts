import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { firebaseConfig, USER_DOMAIN } from './firebaseConfig';

// وضع التجربة المحلية (Firebase Emulator) عند التشغيل بـ VITE_EMULATOR=1
const EMULATOR = import.meta.env.VITE_EMULATOR === '1';
const config = EMULATOR ? { ...firebaseConfig, apiKey: 'demo-key', projectId: 'demo-intai', authDomain: 'localhost' } : firebaseConfig;

export const isConfigured = EMULATOR || !firebaseConfig.apiKey.startsWith('YOUR_');

export const app = initializeApp(config);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: EMULATOR ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
if (EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// تطبيق ثانوي لإنشاء حسابات الموظفين دون تسجيل خروج المدير
export function secondaryApp() {
  const existing = getApps().find((a) => a.name === 'secondary');
  if (existing) return existing;
  const sec = initializeApp(config, 'secondary');
  if (EMULATOR) connectAuthEmulator(getAuth(sec), 'http://127.0.0.1:9099', { disableWarnings: true });
  return sec;
}

export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${USER_DOMAIN}`;
export const validUsername = (u: string) => /^[a-z0-9._-]{3,30}$/.test(u.trim().toLowerCase());
