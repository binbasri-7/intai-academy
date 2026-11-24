import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from './types';
import { resetStore } from './store';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  problem?: string;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ user: null, profile: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, (u) => {
      unsubProfile?.();
      setUser(u);
      setProblem(undefined);
      if (!u) {
        setProfile(null);
        setLoading(false);
        resetStore();
        return;
      }
      setLoading(true);
      unsubProfile = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => {
          if (!snap.exists()) {
            setProfile(null);
            setProblem('هذا الحساب غير مضاف في النظام. تواصل مع الإدارة.');
          } else {
            const p = { id: snap.id, ...snap.data() } as UserProfile;
            if (!p.active) {
              setProfile(null);
              setProblem('تم إيقاف هذا الحساب. تواصل مع الإدارة.');
            } else setProfile(p);
          }
          setLoading(false);
        },
        () => {
          setProfile(null);
          setProblem('تعذر قراءة بيانات الحساب.');
          setLoading(false);
        }
      );
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  const logout = async () => {
    resetStore();
    await signOut(auth);
  };

  return <Ctx.Provider value={{ user, profile, loading, problem, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
