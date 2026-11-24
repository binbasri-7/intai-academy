import { useState } from 'react';
import { useAuth } from './lib/auth';
import { isConfigured } from './lib/firebase';
import { can, ROLE_LABELS } from './lib/roles';
import { go, useRoute } from './lib/hooks';
import { Button, Toaster, cx } from './ui';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Students from './views/Students';
import Courses from './views/Courses';
import CourseDetail from './views/CourseDetail';
import Products from './views/Products';
import Users from './views/Users';
import SettingsView from './views/Settings';
import AccountView from './views/Account';
import type { Role } from './lib/types';

interface NavItem {
  key: string;
  label: string;
  show: (r: Role) => boolean;
}

const NAV: NavItem[] = [
  { key: '', label: 'الرئيسية', show: () => true },
  { key: 'students', label: 'الطلاب', show: (r) => can.staff(r) },
  { key: 'courses', label: 'الدورات', show: () => true },
  { key: 'products', label: 'المنتجات', show: (r) => can.staff(r) },
  { key: 'users', label: 'المستخدمون', show: (r) => can.manageUsers(r) },
  { key: 'settings', label: 'الإعدادات', show: (r) => can.settings(r) },
  { key: 'account', label: 'حسابي', show: () => true },
];

function Splash({ text }: { text?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white p-6 text-center">
      <img src="/logo.png" alt="" className="h-20 w-20" />
      <div className="text-muted">{text || 'جار التحميل…'}</div>
    </div>
  );
}

export default function App() {
  const { user, profile, loading, problem, logout } = useAuth();
  const route = useRoute();
  const [menu, setMenu] = useState(false);

  if (!isConfigured)
    return (
      <Splash text="لم يتم ربط النظام بمشروع Firebase بعد. أضف إعدادات المشروع في الملف src/lib/firebaseConfig.ts" />
    );
  if (loading) return <Splash />;
  if (!user) return (<><Login /><Toaster /></>);
  if (!profile)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white p-6 text-center">
        <img src="/logo.png" alt="" className="h-20 w-20" />
        <p className="font-bold">{problem}</p>
        <Button variant="outline" onClick={logout}>تسجيل الخروج</Button>
      </div>
    );

  const role = profile.role;
  const items = NAV.filter((n) => n.show(role));
  const section = route[0] || '';
  const allowed = items.some((i) => i.key === section);

  let page;
  if (!allowed) page = <Dashboard />;
  else if (section === 'students') page = <Students />;
  else if (section === 'courses') page = route[1] ? <CourseDetail id={route[1]} /> : <Courses />;
  else if (section === 'products') page = <Products />;
  else if (section === 'users') page = <Users />;
  else if (section === 'settings') page = <SettingsView />;
  else if (section === 'account') page = <AccountView />;
  else page = <Dashboard />;

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((i) => (
        <a
          key={i.key}
          href={`#/${i.key}`}
          onClick={() => setMenu(false)}
          className={cx(
            'rounded-lg px-4 py-2.5 text-[15px] font-bold transition-colors',
            section === i.key || (!allowed && i.key === '')
              ? 'bg-brand-soft text-brand'
              : 'text-ink-2 hover:bg-paper hover:text-ink'
          )}
        >
          {i.label}
        </a>
      ))}
    </nav>
  );

  const userBox = (
    <div className="border-t border-line pt-4">
      <div className="px-1 text-sm font-bold">{profile.name}</div>
      <div className="px-1 text-xs text-muted">{ROLE_LABELS[role]}</div>
      <button onClick={logout} className="mt-3 w-full rounded-lg border border-line py-2 text-sm font-bold text-ink-2 hover:border-ink">
        تسجيل الخروج
      </button>
    </div>
  );

  const brand = (
    <button onClick={() => go('')} className="flex items-center gap-3 text-right">
      <img src="/logo.png" alt="" className="h-11 w-11" />
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold">أكاديمية الذكاء الاصطناعي</div>
        <div className="text-xs font-bold text-brand">الدولية</div>
      </div>
    </button>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* الشريط الجانبي (شاشات كبيرة) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between border-l border-line bg-white p-5 lg:flex">
        <div className="flex flex-col gap-6">
          {brand}
          {nav}
        </div>
        {userBox}
      </aside>

      {/* الشريط العلوي (الجوال) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        {brand}
        <Button variant="outline" size="sm" onClick={() => setMenu(true)}>القائمة</Button>
      </header>

      {menu && (
        <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col justify-between bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                {brand}
                <button className="text-sm font-bold text-muted" onClick={() => setMenu(false)}>إغلاق</button>
              </div>
              {nav}
            </div>
            {userBox}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{page}</div>
      </main>
      <Toaster />
    </div>
  );
}
