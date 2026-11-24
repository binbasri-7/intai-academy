import { useState } from 'react';
import { saveStudent } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Student } from '../lib/types';
import { Button, Field, Input, Modal, Select, Textarea, errorText, toast } from '../ui';

export default function StudentForm({
  student,
  onClose,
  onSaved,
}: {
  student?: Student | null;
  onClose: () => void;
  onSaved?: (s: Student) => void;
}) {
  const { profile } = useAuth();
  const [f, setF] = useState<Partial<Student>>(
    student || { name: '', phone: '', whatsapp: '', gender: '', city: '', idNumber: '', qualification: '', notes: '' }
  );
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Student) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (!f.name?.trim()) return toast('اكتب اسم الطالب', true);
    setBusy(true);
    try {
      const data = { ...f, name: f.name.trim(), phone: (f.phone || '').trim() };
      const id = await saveStudent(data as Student, profile?.name || '');
      toast(student ? 'تم حفظ التعديلات' : 'تمت إضافة الطالب');
      onSaved?.({ ...(data as Student), id, createdAt: student?.createdAt || new Date().toISOString() });
      onClose();
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={student ? 'تعديل بيانات الطالب' : 'إضافة طالب'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} busy={busy}>حفظ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" className="sm:col-span-2">
          <Input value={f.name || ''} onChange={set('name')} autoFocus />
        </Field>
        <Field label="رقم الجوال">
          <Input className="ltr" inputMode="tel" value={f.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="رقم الواتساب">
          <Input className="ltr" inputMode="tel" value={f.whatsapp || ''} onChange={set('whatsapp')} />
        </Field>
        <Field label="الجنس">
          <Select value={f.gender || ''} onChange={set('gender')}>
            <option value="">—</option>
            <option>ذكر</option>
            <option>أنثى</option>
          </Select>
        </Field>
        <Field label="المدينة">
          <Input value={f.city || ''} onChange={set('city')} />
        </Field>
        <Field label="رقم الهوية">
          <Input className="ltr" value={f.idNumber || ''} onChange={set('idNumber')} />
        </Field>
        <Field label="المؤهل / الوظيفة">
          <Input value={f.qualification || ''} onChange={set('qualification')} />
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <Textarea value={f.notes || ''} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
}
