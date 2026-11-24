import { useEffect, useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { auth, db, usernameToEmail, validUsername } from '../lib/firebase';
import { nowISO } from '../lib/format';
import { Button, Field, Input, errorText } from '../ui';

export default function Login() {
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'meta', 'setup'))
      .then((s) => setSetupNeeded(!s.exists()))
      .catch(() => setSetupNeeded(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validUsername(username)) return setError('اسم المستخدم بالأحرف الإنجليزية والأرقام فقط (3 أحرف على الأقل).');
    setBusy(true);
    try {
      if (setupNeeded) {
        if (name.trim().length < 2) throw new Error('اكتب الاسم.');
        if (password.length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل.');
        const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
        const b = writeBatch(db);
        b.set(doc(db, 'users', cred.user.uid), {
          name: name.trim(),
          username: username.trim().toLowerCase(),
          role: 'admin',
          active: true,
          createdAt: nowISO(),
        });
        b.set(doc(db, 'meta', 'setup'), { done: true, at: nowISO() });
        await b.commit();
      } else {
        await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.png" alt="" className="h-24 w-24" />
          <h1 className="mt-3 text-xl font-extrabold">أكاديمية الذكاء الاصطناعي الدولية</h1>
          <p className="mt-1 text-sm text-muted">نظام إدارة الأكاديمية</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-6">
          {setupNeeded && (
            <div className="rounded-lg bg-brand-soft p-3 text-sm font-bold text-brand-dark">
              الإعداد الأول: أنشئ حساب الإدارة الرئيسي. بعدها تضيف بقية الموظفين من داخل النظام.
            </div>
          )}
          {setupNeeded && (
            <Field label="الاسم">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          <Field label="اسم المستخدم">
            <Input
              className="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label="كلمة المرور">
            <Input
              type="password"
              className="ltr"
              autoComplete={setupNeeded ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <div className="text-sm font-bold text-red-600">{error}</div>}
          <Button type="submit" className="w-full" busy={busy} disabled={setupNeeded === null}>
            {setupNeeded ? 'إنشاء حساب الإدارة' : 'دخول'}
          </Button>
        </form>
      </div>
    </div>
  );
}
