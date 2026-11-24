import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useCollection } from '../lib/store';
import { useSettings } from '../lib/hooks';
import { can } from '../lib/roles';
import { addSale, deleteProduct, deleteSale, saveProduct, updateSalePaid } from '../lib/api';
import { CURRENCY_LABEL, CURRENCY_NAME, fmtDate, money, today } from '../lib/format';
import { exportExcel, exportPdf, type Report } from '../lib/exporter';
import type { Currency, Product, Sale, Student } from '../lib/types';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, Textarea, cx, errorText, toast } from '../ui';

export default function Products() {
  const { profile } = useAuth();
  const role = profile?.role;
  const settings = useSettings();
  const products = useCollection<Product>('products');
  const sales = useCollection<Sale>('sales');
  const [tab, setTab] = useState<'products' | 'sales'>('products');
  const [form, setForm] = useState<Product | 'new' | null>(null);
  const [sell, setSell] = useState<Product | null>(null);

  const list = [...products.data].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const salesList = [...sales.data].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

  const productsReport = (): Report => ({
    title: 'كشف المنتجات',
    headers: ['م', 'المنتج', 'السعر بالسعودي', 'السعر باليمني', 'المتوفر'],
    rows: list.map((p, i) => [i + 1, p.name, p.priceSAR || 0, p.priceYER || 0, p.stock]),
    filename: 'كشف_المنتجات',
  });
  const salesReport = (): Report => {
    const t = { SAR: 0, YER: 0 };
    salesList.forEach((s) => (t[s.currency] += s.total));
    return {
      title: 'كشف المبيعات',
      info: [['الإجمالي', `${money(t.SAR, 'SAR')} · ${money(t.YER, 'YER')}`]],
      headers: ['م', 'المنتج', 'المشتري', 'الكمية', 'العملة', 'الإجمالي', 'المدفوع', 'المتبقي', 'التاريخ'],
      rows: salesList.map((s, i) => [i + 1, s.productName, s.buyer, s.qty, CURRENCY_LABEL[s.currency], s.total, s.paid, s.total - s.paid, fmtDate(s.date)]),
      filename: 'كشف_المبيعات',
    };
  };
  const report = tab === 'products' ? productsReport : salesReport;

  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle={`${products.data.length} منتج`}
        actions={
          <>
            <Button variant="outline" onClick={() => exportPdf(report(), settings)}>تصدير PDF</Button>
            <Button variant="outline" onClick={() => exportExcel(report(), settings)}>تصدير Excel</Button>
            {can.editProducts(role) && <Button onClick={() => setForm('new')}>إضافة منتج</Button>}
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'products', label: 'المنتجات' },
          { key: 'sales', label: `المبيعات (${sales.data.length})` },
        ]}
      />
      {tab === 'products' ? (
        <Card>
          {list.length === 0 ? (
            <Empty>{products.loading ? 'جار التحميل…' : 'لا توجد منتجات بعد.'}</Empty>
          ) : (
            <Table head={['المنتج', 'السعر بالسعودي', 'السعر باليمني', 'المتوفر', '']}>
              {list.map((p) => (
                <tr key={p.id}>
                  <Td className="font-bold">{p.name}{p.notes && <div className="text-xs font-normal text-muted">{p.notes}</div>}</Td>
                  <Td>{money(p.priceSAR, 'SAR')}</Td>
                  <Td>{money(p.priceYER, 'YER')}</Td>
                  <Td>{p.stock > 0 ? p.stock : <Badge tone="red">نفد</Badge>}</Td>
                  <Td className="whitespace-nowrap text-left">
                    <Button size="sm" variant="ghost" onClick={() => setSell(p)} disabled={p.stock <= 0}>بيع</Button>
                    {can.editProducts(role) && <Button size="sm" variant="ghost" onClick={() => setForm(p)}>تعديل</Button>}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
        <Card>
          {salesList.length === 0 ? (
            <Empty>لا توجد مبيعات.</Empty>
          ) : (
            <Table head={['المنتج', 'المشتري', 'الكمية', 'الإجمالي', 'المتبقي', 'التاريخ', '']}>
              {salesList.map((s) => (
                <SaleRow key={s.id} s={s} canDelete={can.deleteRecords(role)} />
              ))}
            </Table>
          )}
        </Card>
      )}
      {form && <ProductForm product={form === 'new' ? null : form} canDelete={can.deleteRecords(role)} onClose={() => setForm(null)} />}
      {sell && <SellModal product={sell} onClose={() => setSell(null)} />}
    </>
  );
}

function SaleRow({ s, canDelete }: { s: Sale; canDelete: boolean }) {
  const rem = s.total - s.paid;
  const settle = async () => {
    try {
      await updateSalePaid(s.id, s.total);
      toast('تم تسديد المبلغ');
    } catch (e) {
      toast(errorText(e), true);
    }
  };
  const remove = async () => {
    if (!window.confirm('حذف عملية البيع وإرجاع الكمية للمخزون؟')) return;
    try {
      await deleteSale(s);
      toast('تم الحذف');
    } catch (e) {
      toast(errorText(e), true);
    }
  };
  return (
    <tr>
      <Td className="font-bold">{s.productName}</Td>
      <Td>{s.buyer}</Td>
      <Td>{s.qty}</Td>
      <Td className="whitespace-nowrap">{money(s.total, s.currency)}</Td>
      <Td className="whitespace-nowrap">{rem > 0 ? <span className="font-bold text-amber-700">{money(rem, s.currency)}</span> : <Badge tone="green">مسدد</Badge>}</Td>
      <Td className="whitespace-nowrap">{fmtDate(s.date)}</Td>
      <Td className="whitespace-nowrap text-left">
        {rem > 0 && <Button size="sm" variant="ghost" onClick={settle}>تسديد</Button>}
        {canDelete && <Button size="sm" variant="ghost" className="!text-red-600" onClick={remove}>حذف</Button>}
      </Td>
    </tr>
  );
}

function ProductForm({ product, canDelete, onClose }: { product: Product | null; canDelete: boolean; onClose: () => void }) {
  const [f, setF] = useState({
    name: product?.name || '',
    priceSAR: product?.priceSAR || 0,
    priceYER: product?.priceYER || 0,
    stock: product?.stock || 0,
    notes: product?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!f.name.trim()) return toast('اكتب اسم المنتج', true);
    setBusy(true);
    try {
      await saveProduct({ ...f, id: product?.id, name: f.name.trim(), priceSAR: +f.priceSAR || 0, priceYER: +f.priceYER || 0, stock: +f.stock || 0 });
      toast('تم الحفظ');
      onClose();
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!product || !window.confirm('حذف المنتج؟')) return;
    try {
      await deleteProduct(product.id);
      toast('تم الحذف');
      onClose();
    } catch (e) {
      toast(errorText(e), true);
    }
  };
  return (
    <Modal
      title={product ? 'تعديل المنتج' : 'إضافة منتج'}
      onClose={onClose}
      footer={
        <>
          {product && canDelete && <Button variant="danger" onClick={remove} className="ml-auto">حذف</Button>}
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} busy={busy}>حفظ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم المنتج" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="السعر بالريال السعودي">
          <Input type="number" min={0} value={f.priceSAR} onChange={(e) => setF({ ...f, priceSAR: +e.target.value })} />
        </Field>
        <Field label="السعر بالريال اليمني">
          <Input type="number" min={0} value={f.priceYER} onChange={(e) => setF({ ...f, priceYER: +e.target.value })} />
        </Field>
        <Field label="الكمية المتوفرة">
          <Input type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: +e.target.value })} />
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function SellModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { profile } = useAuth();
  const settings = useSettings();
  const students = useCollection<Student>('students');
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency);
  const [unit, setUnit] = useState(currency === 'SAR' ? product.priceSAR : product.priceYER);
  const [qty, setQty] = useState(1);
  const [buyer, setBuyer] = useState('');
  const [paidAll, setPaidAll] = useState(true);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState(settings.paymentMethods[0] || 'نقدا');
  const [busy, setBusy] = useState(false);
  const total = (Number(unit) || 0) * (Number(qty) || 0);
  const names = useMemo(() => students.data.map((s) => s.name), [students.data]);

  const submit = async () => {
    if (!(qty > 0) || qty > product.stock) return toast('الكمية غير صحيحة', true);
    if (!buyer.trim()) return toast('اكتب اسم المشتري', true);
    setBusy(true);
    try {
      await addSale({
        productId: product.id,
        productName: product.name,
        buyer: buyer.trim(),
        qty: Number(qty),
        currency,
        unitPrice: Number(unit) || 0,
        total,
        paid: paidAll ? total : Math.min(total, Number(paid) || 0),
        method,
        date: today(),
        by: profile?.name || '',
      });
      toast('تم تسجيل البيع');
      onClose();
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`بيع: ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} busy={busy}>تسجيل البيع</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['SAR', 'YER'] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => {
                setCurrency(c);
                setUnit(c === 'SAR' ? product.priceSAR : product.priceYER);
              }}
              className={cx('h-10 rounded-lg border text-sm font-bold', currency === c ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}
            >
              {CURRENCY_NAME[c]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="سعر الوحدة">
            <Input type="number" min={0} value={unit} onChange={(e) => setUnit(+e.target.value)} />
          </Field>
          <Field label={`الكمية (المتوفر ${product.stock})`}>
            <Input type="number" min={1} max={product.stock} value={qty} onChange={(e) => setQty(+e.target.value)} />
          </Field>
        </div>
        <Field label="المشتري">
          <Input list="buyers" value={buyer} onChange={(e) => setBuyer(e.target.value)} />
          <datalist id="buyers">{names.map((n, i) => <option key={i} value={n} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الدفع">
            <Select value={paidAll ? 'all' : 'part'} onChange={(e) => setPaidAll(e.target.value === 'all')}>
              <option value="all">مدفوع كاملا</option>
              <option value="part">مدفوع جزئيا / آجل</option>
            </Select>
          </Field>
          {!paidAll ? (
            <Field label="المدفوع">
              <Input type="number" min={0} value={paid} onChange={(e) => setPaid(+e.target.value)} />
            </Field>
          ) : (
            <Field label="طريقة الدفع">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {settings.paymentMethods.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <div className="rounded-lg bg-paper p-3 text-sm">الإجمالي <b>{money(total, currency)}</b></div>
      </div>
    </Modal>
  );
}
