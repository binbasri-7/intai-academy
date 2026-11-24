import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '../lib/roles';
import { Button, Card, Field, Input, PageHeader, errorText, toast } from '../ui';

export default function AccountView() {
  const { user, profile, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const change = async () => {
    if (next.length < 6) return toast('كلمة المرور الجديدة 6 أحرف على الأقل', true);
    if (!user?.email) return;
    setBusy(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      setCurrent('');
      setNext('');
      toast('تم تغيير كلمة المرور');
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return null;
  return (
    <>
      <PageHeader title="حسابي" />
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="text-lg font-extrabold">{profile.name}</div>
          <div className="ltr mt-1 text-right text-muted">{profile.username}</div>
          <div className="mt-4 text-sm font-bold">{ROLE_LABELS[profile.role]}</div>
          <div className="text-sm text-muted">{ROLE_DESCRIPTIONS[profile.role]}</div>
          <Button variant="outline" className="mt-5" onClick={logout}>تسجيل الخروج</Button>
        </Card>
        <Card className="space-y-4 p-5">
          <div className="font-extrabold">تغيير كلمة المرور</div>
          <Field label="كلمة المرور الحالية">
            <Input type="password" className="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="كلمة المرور الجديدة">
            <Input type="password" className="ltr" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button onClick={change} busy={busy}>تغيير</Button>
        </Card>
      </div>
    </>
  );
}
