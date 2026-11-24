import { useMemo, useState } from 'react';
import { useCollection } from '../lib/store';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/hooks';
import { can } from '../lib/roles';
import { deleteStudent } from '../lib/api';
import { accountTotals, fmtDate, money, normalize } from '../lib/format';
import { exportExcel, exportPdf, type Report } from '../lib/exporter';
import type { Account, Enrollment, Student } from '../lib/types';
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Table, Td, errorText, toast } from '../ui';
import StudentForm from './StudentForm';

export default function Students() {
  const { profile } = useAuth();
  const settings = useSettings();
  const students = useCollection<Student>('students');
  const enrollments = useCollection<Enrollment>('enrollments');
  const accounts = useCollection<Account>('accounts');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Student | null | 'new'>(null);
  const [view, setView] = useState<Student | null>(null);

  const byStudent = useMemo(() => {
    const m = new Map<string, Enrollment[]>();
    enrollments.data.forEach((e) => m.set(e.studentId, [...(m.get(e.studentId) || []), e]));
    return m;
  }, [enrollments.data]);
  const accMap = useMemo(() => new Map(accounts.data.map((a) => [a.id, a])), [accounts.data]);

  const balance = (sid: string) => {
    const r = { SAR: 0, YER: 0 };
    (byStudent.get(sid) || []).forEach((e) => {
      const a = accMap.get(e.id);
      if (a) r[a.currency] += accountTotals(a).remaining;
    });
    return r;
  };

  const list = useMemo(() => {
    const n = normalize(q);
    return [...students.data]
      .filter((s) => !n || normalize(s.name).includes(n) || (s.phone || '').includes(q.trim()) || (s.idNumber || '').includes(q.trim()))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [students.data, q]);

  const report = (): Report => ({
    title: 'كشف الطلاب',
    info: [['عدد الطلاب', String(list.length)]],
    headers: ['م', 'اسم الطالب', 'الجوال', 'الواتساب', 'الجنس', 'المدينة', 'المؤهل', 'عدد الدورات', 'تاريخ الإضافة'],
    rows: list.map((s, i) => [
      i + 1,
      s.name,
      s.phone || '',
      s.whatsapp || '',
      s.gender || '',
      s.city || '',
      s.qualification || '',
      (byStudent.get(s.id) || []).length,
      fmtDate(s.createdAt),
    ]),
    filename: 'كشف_الطلاب',
  });

  return (
    <>
      <PageHeader
        title="الطلاب"
        subtitle={`${students.data.length} طالب مسجل في قاعدة البيانات`}
        actions={
          <>
            <Button variant="outline" onClick={() => exportPdf(report(), settings)}>تصدير PDF</Button>
            <Button variant="outline" onClick={() => exportExcel(report(), settings)}>تصدير Excel</Button>
            <Button onClick={() => setForm('new')}>إضافة طالب</Button>
          </>
        }
      />
      <Card>
        <div className="border-b border-line p-3">
          <Input placeholder="بحث بالاسم أو الجوال أو رقم الهوية" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {students.loading ? (
          <Empty>جار التحميل…</Empty>
        ) : list.length === 0 ? (
          <Empty>{students.data.length ? 'لا توجد نتائج' : 'لا يوجد طلاب بعد. ابدأ بإضافة أول طالب.'}</Empty>
        ) : (
          <Table head={['م', 'الاسم', 'الجوال', 'المدينة', 'الدورات', 'المتبقي عليه', '']}>
            {list.map((s, i) => {
              const b = balance(s.id);
              return (
                <tr key={s.id} className="hover:bg-paper/50">
                  <Td className="text-muted">{i + 1}</Td>
                  <Td>
                    <button className="font-bold hover:text-brand" onClick={() => setView(s)}>{s.name}</button>
                  </Td>
                  <Td className="ltr whitespace-nowrap">{s.phone}</Td>
                  <Td>{s.city}</Td>
                  <Td>{(byStudent.get(s.id) || []).length}</Td>
                  <Td className="whitespace-nowrap">
                    {b.SAR > 0 && <Badge tone="amber">{money(b.SAR, 'SAR')}</Badge>}{' '}
                    {b.YER > 0 && <Badge tone="amber">{money(b.YER, 'YER')}</Badge>}
                    {b.SAR <= 0 && b.YER <= 0 && <span className="text-muted">—</span>}
                  </Td>
                  <Td className="whitespace-nowrap text-left">
                    <Button size="sm" variant="ghost" onClick={() => setView(s)}>عرض</Button>
                    <Button size="sm" variant="ghost" onClick={() => setForm(s)}>تعديل</Button>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {form && <StudentForm student={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {view && (
        <StudentView
          student={students.data.find((s) => s.id === view.id) || view}
          enrollments={byStudent.get(view.id) || []}
          accMap={accMap}
          canDelete={can.deleteRecords(profile?.role)}
          onEdit={() => {
            setForm(view);
            setView(null);
          }}
          onClose={() => setView(null)}
        />
      )}
    </>
  );
}

function StudentView({
  student: s,
  enrollments,
  accMap,
  canDelete,
  onEdit,
  onClose,
}: {
  student: Student;
  enrollments: Enrollment[];
  accMap: Map<string, Account>;
  canDelete: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const remove = async () => {
    if (!window.confirm(`حذف الطالب "${s.name}" نهائيا؟`)) return;
    try {
      await deleteStudent(s.id);
      toast('تم حذف الطالب');
      onClose();
    } catch (e) {
      toast(errorText(e), true);
    }
  };
  const row = (k: string, v?: string) =>
    v ? (
      <div className="flex justify-between gap-4 border-b border-line py-2 text-[15px] last:border-0">
        <span className="text-muted">{k}</span>
        <span className="font-bold">{v}</span>
      </div>
    ) : null;
  return (
    <Modal
      title={s.name}
      onClose={onClose}
      wide
      footer={
        <>
          {canDelete && <Button variant="danger" onClick={remove}>حذف الطالب</Button>}
          <Button variant="outline" onClick={onEdit}>تعديل البيانات</Button>
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          {row('الجوال', s.phone)}
          {row('الواتساب', s.whatsapp)}
          {row('الجنس', s.gender)}
          {row('المدينة', s.city)}
          {row('رقم الهوية', s.idNumber)}
          {row('المؤهل / الوظيفة', s.qualification)}
          {row('تاريخ الإضافة', fmtDate(s.createdAt))}
          {s.notes && <p className="mt-3 rounded-lg bg-paper p-3 text-sm">{s.notes}</p>}
        </div>
        <div>
          <h3 className="mb-2 font-extrabold">الدورات المسجل فيها</h3>
          {enrollments.length === 0 && <p className="text-sm text-muted">غير مسجل في أي دورة.</p>}
          <div className="space-y-2">
            {enrollments.map((e) => {
              const a = accMap.get(e.id);
              const t = accountTotals(a);
              return (
                <a key={e.id} href={`#/courses/${e.courseId}`} className="block rounded-lg border border-line p-3 hover:border-brand">
                  <div className="font-bold">{e.courseName}</div>
                  {a && (
                    <div className="mt-1 text-sm text-muted">
                      المستحق {money(t.due, a.currency)} · المدفوع {money(t.paid, a.currency)} ·{' '}
                      <span className={t.remaining > 0 ? 'font-bold text-amber-700' : 'text-emerald-700'}>
                        {t.remaining > 0 ? `المتبقي ${money(t.remaining, a.currency)}` : 'مسدد'}
                      </span>
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
