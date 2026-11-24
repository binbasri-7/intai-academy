import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useUsers } from '../lib/hooks';
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../lib/roles';
import { createStaffUser, updateUser } from '../lib/api';
import { validUsername } from '../lib/firebase';
import type { Role, UserProfile } from '../lib/types';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Table, Td, errorText, toast } from '../ui';

export default function Users() {
  const { profile } = useAuth();
  const users = useUsers();
  const [form, setForm] = useState<UserProfile | 'new' | null>(null);
  const list = [...users.data].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name, 'ar'));

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="الموظفون الذين يدخلون النظام. الطلاب لا يدخلون النظام."
        actions={<Button onClick={() => setForm('new')}>إضافة مستخدم</Button>}
      />
      <Card className="mb-6">
        {list.length === 0 ? (
          <Empty>جار التحميل…</Empty>
        ) : (
          <Table head={['الاسم', 'اسم المستخدم', 'الصلاحية', 'الحالة', '']}>
            {list.map((u) => (
              <tr key={u.id}>
                <Td className="font-bold">{u.name}{u.id === profile?.id && <span className="text-xs font-normal text-muted"> (أنت)</span>}</Td>
                <Td className="ltr">{u.username}</Td>
                <Td>{ROLE_LABELS[u.role]}</Td>
                <Td>{u.active ? <Badge tone="green">فعال</Badge> : <Badge tone="red">موقوف</Badge>}</Td>
                <Td className="text-left">
                  <Button size="sm" variant="ghost" onClick={() => setForm(u)}>تعديل</Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <h2 className="mb-3 text-lg font-extrabold">الصلاحيات</h2>
      <Card>
        <div className="divide-y divide-line">
          {ROLES.map((r) => (
            <div key={r} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-6">
              <div className="w-36 shrink-0 font-extrabold">{ROLE_LABELS[r]}</div>
              <div className="text-sm text-ink-2">{ROLE_DESCRIPTIONS[r]}</div>
            </div>
          ))}
        </div>
      </Card>
      {form && <UserForm user={form === 'new' ? null : form} self={profile?.id} onClose={() => setForm(null)} />}
    </>
  );
}

function UserForm({ user, self, onClose }: { user: UserProfile | null; self?: string; onClose: () => void }) {
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role || 'secretary');
  const [phone, setPhone] = useState(user?.phone || '');
  const [active, setActive] = useState(user?.active ?? true);
  const [busy, setBusy] = useState(false);
  const isSelf = user?.id === self;

  const submit = async () => {
    if (name.trim().length < 2) return toast('اكتب الاسم', true);
    setBusy(true);
    try {
      if (user) {
        await updateUser(user.id, { name: name.trim(), role, phone, active });
        toast('تم الحفظ');
      } else {
        if (!validUsername(username)) throw new Error('اسم المستخدم بالأحرف الإنجليزية الصغيرة والأرقام فقط (3 أحرف على الأقل).');
        if (password.length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل.');
        await createStaffUser({ name: name.trim(), username, password, role, phone });
        toast('تم إنشاء الحساب. أرسل اسم المستخدم وكلمة المرور للموظف.');
      }
      onClose();
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={user ? 'تعديل المستخدم' : 'إضافة مستخدم'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} busy={busy}>{user ? 'حفظ' : 'إنشاء الحساب'}</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="الاسم">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="اسم المستخدم (للدخول)" hint={user ? 'لا يمكن تغيير اسم المستخدم' : 'أحرف إنجليزية صغيرة وأرقام، مثل: ahmed'}>
          <Input className="ltr" autoCapitalize="none" value={username} disabled={!!user} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
        </Field>
        {!user && (
          <Field label="كلمة المرور" hint="6 أحرف على الأقل. يستطيع الموظف تغييرها من صفحة حسابي.">
            <Input className="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        <Field label="الصلاحية" hint={ROLE_DESCRIPTIONS[role]}>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
        </Field>
        <Field label="رقم الجوال">
          <Input className="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {user && !isSelf && (
          <Field label="حالة الحساب" hint="الحساب الموقوف لا يستطيع الدخول. استخدمه بدل الحذف، أو عند نسيان كلمة المرور أنشئ حسابا جديدا وأوقف القديم.">
            <Select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
              <option value="1">فعال</option>
              <option value="0">موقوف</option>
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
