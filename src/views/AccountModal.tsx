import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/hooks';
import { can } from '../lib/roles';
import { saveAccount } from '../lib/api';
import { CURRENCY_NAME, accountTotals, fmtDate, money, num, today } from '../lib/format';
import type { Account, Course, Currency, Enrollment } from '../lib/types';
import { Button, Field, Input, Modal, Select, cx, errorText, toast } from '../ui';

export default function AccountModal({
  enrollment,
  account,
  course,
  onClose,
}: {
  enrollment: Enrollment;
  account?: Account;
  course: Course;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const settings = useSettings();
  const base: Account = account || {
    id: enrollment.id,
    courseId: course.id,
    studentId: enrollment.studentId,
    currency: settings.defaultCurrency,
    price: settings.defaultCurrency === 'SAR' ? course.priceSAR : course.priceYER,
    discount: 0,
    payments: [],
  };
  const [currency, setCurrency] = useState<Currency>(base.currency);
  const [price, setPrice] = useState(base.price);
  const [discount, setDiscount] = useState(base.discount);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState(settings.paymentMethods[0] || 'نقدا');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const canDelete = can.deleteRecords(profile?.role);

  const t = accountTotals({ price, discount, payments: base.payments });
  const changed = currency !== base.currency || price !== base.price || discount !== base.discount;

  const save = async (payments = base.payments, msg = 'تم الحفظ') => {
    setBusy(true);
    try {
      await saveAccount({ ...base, currency, price: Number(price) || 0, discount: Number(discount) || 0, payments });
      toast(msg);
      return true;
    } catch (e) {
      toast(errorText(e), true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addPayment = async () => {
    if (!(Number(amount) > 0)) return toast('اكتب المبلغ', true);
    const ok = await save([...base.payments, { amount: Number(amount), date, method, by: profile?.name || '', note }], 'تم تسجيل الدفعة');
    if (ok) {
      setAmount(0);
      setNote('');
    }
  };

  const removePayment = async (i: number) => {
    if (!window.confirm('حذف هذه الدفعة؟')) return;
    await save(base.payments.filter((_, j) => j !== i), 'تم حذف الدفعة');
  };

  return (
    <Modal title={`الحساب المالي: ${enrollment.studentName}`} onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['SAR', 'YER'] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCurrency(c);
                  setPrice(c === 'SAR' ? course.priceSAR : course.priceYER);
                }}
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
            <Field label="السعر">
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </Field>
            <Field label="الخصم">
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </Field>
          </div>
          {changed && <Button variant="dark" onClick={() => save()} busy={busy}>حفظ تعديل الرسوم</Button>}
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-paper p-3 text-sm">
            <div><div className="text-muted">المستحق</div><b>{money(t.due, currency)}</b></div>
            <div><div className="text-muted">المدفوع</div><b className="text-emerald-700">{money(t.paid, currency)}</b></div>
            <div><div className="text-muted">المتبقي</div><b className="text-amber-700">{money(t.remaining, currency)}</b></div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-bold text-ink-2">تسجيل دفعة جديدة</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`المبلغ (${CURRENCY_NAME[currency]})`}>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </Field>
            <Field label="التاريخ">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="طريقة الدفع">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {settings.paymentMethods.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="ملاحظة / رقم الحوالة">
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <Button onClick={addPayment} busy={busy} className="w-full">تسجيل الدفعة</Button>
        </div>
      </div>

      <h3 className="mb-2 mt-6 font-extrabold">سجل الدفعات</h3>
      {base.payments.length === 0 ? (
        <p className="text-sm text-muted">لا توجد دفعات.</p>
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line">
          {base.payments.map((p, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div>
                <b>{num(p.amount)}</b> · {p.method} · {fmtDate(p.date)}
                {p.note && <span className="text-muted"> · {p.note}</span>}
                <span className="text-muted"> · بواسطة {p.by}</span>
              </div>
              {canDelete && (
                <button className="text-sm font-bold text-red-600" onClick={() => removePayment(i)}>حذف</button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
