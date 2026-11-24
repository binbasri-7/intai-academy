import { useState } from 'react';
import { saveCourse } from '../lib/api';
import { useUsers } from '../lib/hooks';
import { STATUS_LABEL, WEEKDAYS, fmtDate, generateDates, today, weekdayName } from '../lib/format';
import type { Course, CourseStatus } from '../lib/types';
import { Button, Field, Input, Modal, Select, Textarea, cx, errorText, toast } from '../ui';

type Draft = Omit<Course, 'id' | 'createdAt'> & { id?: string };

export default function CourseForm({ course, onClose, onSaved }: { course?: Course | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const users = useUsers();
  const trainers = users.data.filter((u) => u.active && (u.role === 'trainer' || u.id === course?.trainerId));
  const [f, setF] = useState<Draft>(() =>
    course
      ? { ...course }
      : {
          name: '',
          trainerId: '',
          trainerName: '',
          mode: 'حضوري',
          location: '',
          time: '',
          startDate: today(),
          daysCount: 5,
          weekdays: [6, 0, 1, 2, 3],
          sessionDates: generateDates(today(), 5, [6, 0, 1, 2, 3]),
          priceSAR: 0,
          priceYER: 0,
          seats: 20,
          status: 'open',
          notes: '',
        }
  );
  const [busy, setBusy] = useState(false);

  const regen = (patch: Partial<Draft>) => {
    const n = { ...f, ...patch };
    n.sessionDates = generateDates(n.startDate, Number(n.daysCount) || 0, n.weekdays);
    setF(n);
  };

  const toggleDay = (d: number) =>
    regen({ weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d] });

  const setDate = (i: number, v: string) => {
    const s = [...f.sessionDates];
    s[i] = v;
    setF({ ...f, sessionDates: s });
  };

  const submit = async () => {
    if (!f.name.trim()) return toast('اكتب اسم الدورة', true);
    if (!f.sessionDates.length || f.sessionDates.some((d) => !d)) return toast('تحقق من تواريخ أيام الدورة', true);
    setBusy(true);
    try {
      const t = users.data.find((u) => u.id === f.trainerId);
      const id = await saveCourse(
        {
          ...f,
          name: f.name.trim(),
          trainerName: t?.name || '',
          daysCount: f.sessionDates.length,
          priceSAR: Number(f.priceSAR) || 0,
          priceYER: Number(f.priceYER) || 0,
          seats: Number(f.seats) || 0,
        },
        course?.trainerId
      );
      toast(course ? 'تم حفظ التعديلات' : 'تم إنشاء الدورة');
      onSaved?.(id);
      onClose();
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  const order = [6, 0, 1, 2, 3, 4, 5];

  return (
    <Modal
      title={course ? 'تعديل الدورة' : 'دورة جديدة'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} busy={busy}>حفظ الدورة</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم الدورة" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="المدرب" hint={trainers.length ? undefined : 'أضف حساب مدرب من صفحة المستخدمين ليظهر هنا'}>
          <Select value={f.trainerId} onChange={(e) => setF({ ...f, trainerId: e.target.value })}>
            <option value="">بدون مدرب</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="الحالة">
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as CourseStatus })}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="نوع الدورة">
          <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
            <option>حضوري</option>
            <option>أونلاين</option>
          </Select>
        </Field>
        <Field label={f.mode === 'أونلاين' ? 'رابط القاعة' : 'المكان / القاعة'}>
          <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        </Field>
        <Field label="الوقت">
          <Input placeholder="مثال: 5:00 م - 8:00 م" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </Field>
        <Field label="عدد المقاعد">
          <Input type="number" min={0} value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} />
        </Field>
        <Field label="السعر بالريال السعودي">
          <Input type="number" min={0} value={f.priceSAR} onChange={(e) => setF({ ...f, priceSAR: Number(e.target.value) })} />
        </Field>
        <Field label="السعر بالريال اليمني">
          <Input type="number" min={0} value={f.priceYER} onChange={(e) => setF({ ...f, priceYER: Number(e.target.value) })} />
        </Field>
      </div>

      <div className="mt-6 rounded-xl border border-line p-4">
        <h3 className="mb-3 font-extrabold">أيام الدورة</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="تاريخ البداية">
            <Input type="date" value={f.startDate} onChange={(e) => regen({ startDate: e.target.value })} />
          </Field>
          <Field label="عدد الأيام">
            <Input type="number" min={1} max={200} value={f.daysCount} onChange={(e) => regen({ daysCount: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="mt-4">
          <span className="mb-1.5 block text-sm font-bold text-ink-2">أيام الأسبوع</span>
          <div className="flex flex-wrap gap-2">
            {order.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cx(
                  'rounded-lg border px-3 py-1.5 text-sm font-bold',
                  f.weekdays.includes(d) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2'
                )}
              >
                {WEEKDAYS[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <span className="mb-1.5 block text-sm font-bold text-ink-2">
            التواريخ ({f.sessionDates.length} يوم){f.sessionDates.length > 0 && ` · من ${fmtDate(f.sessionDates[0])} إلى ${fmtDate(f.sessionDates[f.sessionDates.length - 1])}`}
          </span>
          <p className="mb-2 text-xs text-muted">تتولد تلقائيا، ويمكنك تعديل أي يوم مباشرة.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {f.sessionDates.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm font-bold text-muted">اليوم {i + 1}</span>
                <Input type="date" value={d} onChange={(e) => setDate(i, e.target.value)} />
                <span className="w-14 shrink-0 text-xs text-muted">{d && weekdayName(d)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Field label="ملاحظات" className="mt-4">
        <Textarea value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
    </Modal>
  );
}
