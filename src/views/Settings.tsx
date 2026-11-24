import { useEffect, useState } from 'react';
import { useSettings } from '../lib/hooks';
import { saveSettings } from '../lib/api';
import type { Currency, Settings } from '../lib/types';
import { Button, Card, Field, Input, PageHeader, Select, Textarea, errorText, toast } from '../ui';

export default function SettingsView() {
  const current = useSettings();
  const [f, setF] = useState<Settings>(current);
  const [methods, setMethods] = useState(current.paymentMethods.join('\n'));
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(current);
  useEffect(() => {
    setF(current);
    setMethods(current.paymentMethods.join('\n'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const submit = async () => {
    setBusy(true);
    try {
      await saveSettings({
        ...f,
        paymentMethods: methods.split('\n').map((m) => m.trim()).filter(Boolean),
      });
      toast('تم حفظ الإعدادات');
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="هذه البيانات تظهر في رأس الكشوفات المصدرة" />
      <Card className="max-w-2xl p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم الأكاديمية" className="sm:col-span-2">
            <Input value={f.academyName} onChange={(e) => setF({ ...f, academyName: e.target.value })} />
          </Field>
          <Field label="الاسم بالإنجليزية" className="sm:col-span-2">
            <Input className="ltr" value={f.academyNameEn} onChange={(e) => setF({ ...f, academyNameEn: e.target.value })} />
          </Field>
          <Field label="رقم التواصل">
            <Input className="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="العملة الافتراضية عند التسجيل">
            <Select value={f.defaultCurrency} onChange={(e) => setF({ ...f, defaultCurrency: e.target.value as Currency })}>
              <option value="SAR">ريال سعودي</option>
              <option value="YER">ريال يمني</option>
            </Select>
          </Field>
          <Field label="العنوان" className="sm:col-span-2">
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field label="طرق الدفع" hint="كل طريقة في سطر" className="sm:col-span-2">
            <Textarea rows={5} value={methods} onChange={(e) => setMethods(e.target.value)} />
          </Field>
        </div>
        <div className="mt-5">
          <Button onClick={submit} busy={busy}>حفظ الإعدادات</Button>
        </div>
      </Card>
    </>
  );
}
