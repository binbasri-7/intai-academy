import { useEffect, useState } from 'react';
import { useCollection, useDocument } from './store';
import { DEFAULT_SETTINGS } from './api';
import type { Settings, UserProfile } from './types';

export function useSettings(): Settings {
  const { data } = useDocument<Settings>('settings/main');
  return { ...DEFAULT_SETTINGS, ...(data || {}) };
}

export function useUsers() {
  return useCollection<UserProfile>('users');
}

export function useRoute() {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [parts, setParts] = useState(get);
  useEffect(() => {
    const f = () => {
      setParts(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return parts;
}

export const go = (path: string) => {
  window.location.hash = '/' + path.replace(/^\//, '');
};
