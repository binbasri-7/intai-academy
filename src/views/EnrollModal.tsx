import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useCollection } from '../lib/store';
import { useSettings } from '../lib/hooks';
import { enrollStudent } from '../lib/api';
import { CURRENCY_NAME, normalize, num, today } from '../lib/format';
import type { Course, Currency, Student } from '../lib/types';
import { Button, Field, Input, Modal, Select, cx, errorText, toast } from '../ui';
import StudentForm from './StudentForm';

export default function EnrollModal({ course, enrolledIds, onClose }: { course: Course; enrolledIds: string[]; onClose: () => void }) {
  const { profile } = useAuth();
  const settings = useSettings();
  const students = useCollection<Student>('students');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Student | null>(null);
  const [newStudent, setNewStudent] = useState(false);
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency);
  const [price, setPrice] = useState(currency === 'SAR' ? course.priceSAR : course.priceYER);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState(settings.paymentMethods[0] || 'نقدا');
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const n = normalize(q);
    return students.data
      .filter((s) => !enrolledIds.includes(s.id))
      .filter((s) => !n || normalize(s.name).includes(n) || (s.phone || '').includes(q.trim()))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
      .slice(0, 30);
  }, [students.data, q, enrolledIds]);

  const changeCurrency = (c: Currency) => {
    setCurrency(c);
    setPrice(c === 'SAR' ? course.priceSAR : course.priceYER);
  };

  const submit = async () => {
    if (!picked) return toast('اختر الطالب', true);
    setBusy(true);
    try {
      await enrollStudent(
        course,
        picked,
        {
          currency,
          price: Number(price) || 0,
          discount: Number(discount) || 0,
          firstPayment: Number(paid) > 0 ? { amount: Number(paid), date: today(), method, by: profile?.name || '' } : undefined,
        },
        profile?.name || ''
      );
      toast(`تم تسجيل ${picked.name} في الدورة`);
      onClose();
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  const due = Math.max(0, (Number(price) || 0) - (Number(discount) || 0));

  return (
    <>
      <Modal
        title="تسجيل طالب في الدورة"
        onClose={onClose}
        wide
        footer={
          <>
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={submit} busy={busy} disabled={!picked}>تسجيل</Button>
          </>
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-ink-2">1. اختر الطالب</span>
              <Button size="sm" variant="ghost" onClick={() => setNewStudent(true)}>طالب جديد</Button>
            </div>
            {picked ? (
              <div className="flex items-center justify-between rounded-lg border border-brand bg-brand-soft p-3">
                <div>
                  <div className="font-bold">{picked.name}</div>
                  <div className="ltr text-sm text-muted">{picked.phone}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPicked(null)}>تغيير</Button>
              </div>
            ) : (
              <>
                <Input placeholder="ابحث بالاسم أو الجوال" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                <div className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                  {list.length === 0 && <div className="p-4 text-center text-sm text-muted">لا توجد نتائج. أضف طالبا جديدا.</div>}
                  {list.map((s) => (
                    <button key={s.id} onClick={() => setPicked(s)} className="flex w-full justify-between px-3 py-2.5 text-right hover:bg-paper">
                      <span className="font-bold">{s.name}</span>
                      <span className="ltr text-sm text-muted">{s.phone}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={cx('space-y-4', !picked && 'opacity-60')}>
            <span className="block text-sm font-bold text-ink-2">2. الرسوم</span>
            <div className="grid grid-cols-2 gap-2">
              {(['SAR', 'YER'] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => changeCurrency(c)}
                  className={cx(
                    'h-10 rounded-lg border text-sm font-bold',
                    currency === c ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2'
                  )}
                >
                  {CURRENCY_NAME[c]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="السعر" hint="محدد من الدورة ويمكن تعديله">
                <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </Field>
              <Field label="الخصم">
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              </Field>
              <Field label="المبلغ المدفوع الآن">
                <Input type="number" min={0} value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
              </Field>
              <Field label="طريقة الدفع">
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  {settings.paymentMethods.map((m) => <option key={m}>{m}</option>)}
                </Select>
              </Field>
            </div>
            <div className="rounded-lg bg-paper p-3 text-sm">
              المستحق <b>{num(due)}</b> · المتبقي بعد الدفع <b>{num(due - (Number(paid) || 0))}</b>
            </div>
          </div>
        </div>
      </Modal>
      {newStudent && <StudentForm onClose={() => setNewStudent(false)} onSaved={(s) => setPicked(s)} />}
    </>
  );
}
