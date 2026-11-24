import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useCollection } from '../lib/store';
import { useSettings } from '../lib/hooks';
import { can } from '../lib/roles';
import { deleteCourse, removeEnrollment, setMarks } from '../lib/api';
import {
  CURRENCY_LABEL,
  MARKS,
  MARK_LABEL,
  MARK_SHORT,
  STATUS_LABEL,
  accountTotals,
  fmtDate,
  money,
  num,
  today,
  weekdayName,
} from '../lib/format';
import { exportExcel, exportPdf, type Report } from '../lib/exporter';
import type { Account, AttendanceDay, Course, Currency, Enrollment, Mark } from '../lib/types';
import { go } from '../lib/hooks';
import { Badge, Button, Card, Empty, PageHeader, Table, Tabs, Td, cx, errorText, toast } from '../ui';
import { statusTone, useMyCourses } from './Courses';
import CourseForm from './CourseForm';
import EnrollModal from './EnrollModal';
import AccountModal from './AccountModal';

type Tab = 'students' | 'attend' | 'sheet' | 'reports' | 'info';

export default function CourseDetail({ id }: { id: string }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const finance = can.finance(role);
  const { courses, enrollments, trainer } = useMyCourses();
  const course = courses.data.find((c) => c.id === id);
  const roster = useMemo(
    () => enrollments.data.filter((e) => e.courseId === id).sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar')),
    [enrollments.data, id]
  );
  const accounts = useCollection<Account>('accounts', [['courseId', id]], finance);
  const attendance = useCollection<AttendanceDay>(
    'attendance',
    trainer ? [['courseId', id], ['trainerId', profile!.id]] : [['courseId', id]]
  );
  const [tab, setTab] = useState<Tab>(trainer ? 'attend' : 'students');
  const [edit, setEdit] = useState(false);

  if (courses.loading || (!course && courses.error)) return <Empty>جار التحميل…</Empty>;
  if (!course)
    return (
      <Card>
        <Empty>
          الدورة غير موجودة أو ليست لديك صلاحية لعرضها.
          <div className="mt-3"><Button variant="outline" onClick={() => go('courses')}>العودة للدورات</Button></div>
        </Empty>
      </Card>
    );

  const accMap = new Map(accounts.data.map((a) => [a.id, a]));
  const attByDay = new Map(attendance.data.map((a) => [a.day, a]));

  const tabs: { key: Tab; label: string }[] = [
    { key: 'students', label: `الطلاب (${roster.length})` },
    { key: 'attend', label: 'التحضير' },
    { key: 'sheet', label: 'كشف الحضور' },
    { key: 'reports', label: 'الكشوفات' },
    { key: 'info', label: 'بيانات الدورة' },
  ];

  return (
    <>
      <button onClick={() => go('courses')} className="mb-3 text-sm font-bold text-muted hover:text-ink">
        ‹ {trainer ? 'دوراتي' : 'الدورات'}
      </button>
      <div className="flex items-start gap-3 sm:gap-4">
        <img src="/logo.png" alt="" className="h-10 w-10 shrink-0 sm:h-14 sm:w-14" />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={course.name}
            subtitle={
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(course.status) as any}>{STATUS_LABEL[course.status]}</Badge>
                <span>{course.trainerName || 'بدون مدرب'}</span>
                <span>·</span>
                <span>{course.sessionDates.length} يوم</span>
                <span>·</span>
                <span>{fmtDate(course.sessionDates[0])} - {fmtDate(course.sessionDates[course.sessionDates.length - 1])}</span>
              </span>
            }
          />
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} items={tabs} />

      {tab === 'students' && <Roster course={course} roster={roster} accMap={accMap} attByDay={attByDay} />}
      {tab === 'attend' && <TakeAttendance course={course} roster={roster} attByDay={attByDay} />}
      {tab === 'sheet' && <Sheet course={course} roster={roster} attByDay={attByDay} />}
      {tab === 'reports' && <Reports course={course} roster={roster} accMap={accMap} attByDay={attByDay} />}
      {tab === 'info' && (
        <Info
          course={course}
          finance={finance}
          canEdit={can.editCourses(role)}
          canDelete={can.deleteRecords(role)}
          enrolled={roster.length}
          onEdit={() => setEdit(true)}
        />
      )}
      {edit && <CourseForm course={course} onClose={() => setEdit(false)} />}
    </>
  );
}

/* ================= حساب الحضور ================= */
function studentStats(sid: string, course: Course, attByDay: Map<number, AttendanceDay>) {
  let P = 0, A = 0, L = 0, E = 0, taken = 0;
  course.sessionDates.forEach((_, i) => {
    const m = attByDay.get(i + 1)?.marks?.[sid];
    if (!m) return;
    taken++;
    if (m === 'P') P++;
    else if (m === 'A') A++;
    else if (m === 'L') L++;
    else E++;
  });
  const rate = taken ? Math.round(((P + L) / taken) * 100) : null;
  return { P, A, L, E, taken, rate };
}

/* ================= الطلاب ================= */
function Roster({
  course,
  roster,
  accMap,
  attByDay,
}: {
  course: Course;
  roster: Enrollment[];
  accMap: Map<string, Account>;
  attByDay: Map<number, AttendanceDay>;
}) {
  const { profile } = useAuth();
  const role = profile?.role;
  const finance = can.finance(role);
  const [enroll, setEnroll] = useState(false);
  const [acc, setAcc] = useState<Enrollment | null>(null);

  const totals = useMemo(() => {
    const t: Record<Currency, { due: number; paid: number; remaining: number }> = {
      SAR: { due: 0, paid: 0, remaining: 0 },
      YER: { due: 0, paid: 0, remaining: 0 },
    };
    roster.forEach((e) => {
      const a = accMap.get(e.id);
      if (!a) return;
      const x = accountTotals(a);
      t[a.currency].due += x.due;
      t[a.currency].paid += x.paid;
      t[a.currency].remaining += x.remaining;
    });
    return t;
  }, [roster, accMap]);

  const remove = async (e: Enrollment) => {
    if (!window.confirm(`إزالة "${e.studentName}" من الدورة؟ سيتم حذف حسابه المالي في هذه الدورة.`)) return;
    try {
      await removeEnrollment(e.id);
      toast('تمت الإزالة من الدورة');
    } catch (err) {
      toast(errorText(err), true);
    }
  };

  return (
    <>
      {finance && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {(['SAR', 'YER'] as Currency[]).map((c) => (
            <Card key={c} className="p-4">
              <div className="text-sm font-bold text-muted">بالـ{c === 'SAR' ? 'ريال السعودي' : 'ريال اليمني'}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-muted">المستحق</div><div className="text-lg font-extrabold">{num(totals[c].due)}</div></div>
                <div><div className="text-muted">المدفوع</div><div className="text-lg font-extrabold text-emerald-700">{num(totals[c].paid)}</div></div>
                <div><div className="text-muted">المتبقي</div><div className="text-lg font-extrabold text-amber-700">{num(totals[c].remaining)}</div></div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <div className="font-extrabold">
            الطلاب المسجلون{course.seats ? ` (${roster.length} من ${course.seats})` : ''}
          </div>
          {can.staff(role) && <Button onClick={() => setEnroll(true)}>تسجيل طالب في الدورة</Button>}
        </div>
        {roster.length === 0 ? (
          <Empty>لا يوجد طلاب مسجلون في هذه الدورة بعد.</Empty>
        ) : (
          <Table
            head={
              finance
                ? ['م', 'الطالب', 'الجوال', 'الحضور', 'العملة', 'المستحق', 'المدفوع', 'المتبقي', '']
                : ['م', 'الطالب', 'الجوال', 'الحضور']
            }
          >
            {roster.map((e, i) => {
              const a = accMap.get(e.id);
              const t = accountTotals(a);
              const s = studentStats(e.studentId, course, attByDay);
              return (
                <tr key={e.id}>
                  <Td className="text-muted">{i + 1}</Td>
                  <Td className="font-bold">{e.studentName}</Td>
                  <Td className="ltr whitespace-nowrap">{e.studentPhone}</Td>
                  <Td className="whitespace-nowrap">{s.rate === null ? '—' : `${s.rate}%`}</Td>
                  {finance && (
                    <>
                      <Td>{a ? CURRENCY_LABEL[a.currency] : '—'}</Td>
                      <Td>{num(t.due)}</Td>
                      <Td className="text-emerald-700">{num(t.paid)}</Td>
                      <Td>
                        {t.remaining > 0 ? (
                          <span className="font-bold text-amber-700">{num(t.remaining)}</span>
                        ) : (
                          <Badge tone="green">مسدد</Badge>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-left">
                        <Button size="sm" variant="ghost" onClick={() => setAcc(e)}>الدفعات</Button>
                        {can.removeEnrollment(role) && (
                          <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => remove(e)}>إزالة</Button>
                        )}
                      </Td>
                    </>
                  )}
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      {enroll && <EnrollModal course={course} enrolledIds={roster.map((r) => r.studentId)} onClose={() => setEnroll(false)} />}
      {acc && <AccountModal enrollment={acc} account={accMap.get(acc.id)} course={course} onClose={() => setAcc(null)} />}
    </>
  );
}

/* ================= التحضير ================= */
function TakeAttendance({
  course,
  roster,
  attByDay,
}: {
  course: Course;
  roster: Enrollment[];
  attByDay: Map<number, AttendanceDay>;
}) {
  const { profile } = useAuth();
  const dates = course.sessionDates;
  const initialDay = () => {
    const t = today();
    const i = dates.indexOf(t);
    if (i >= 0) return i + 1;
    const next = dates.findIndex((d) => d >= t);
    return next >= 0 ? next + 1 : dates.length || 1;
  };
  const [day, setDay] = useState(initialDay);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.getElementById(`day-${day}`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [day]);

  const rec = attByDay.get(day);
  const marks = rec?.marks || {};
  const date = dates[day - 1];

  const mark = async (sid: string, m: Mark) => {
    try {
      await setMarks(course, day, date, { [sid]: marks[sid] === m ? null : m }, profile?.name || '');
    } catch (e) {
      toast(errorText(e), true);
    }
  };

  const allPresent = async () => {
    setBusy(true);
    try {
      const m: Record<string, Mark> = {};
      roster.forEach((r) => {
        if (!marks[r.studentId]) m[r.studentId] = 'P';
      });
      await setMarks(course, day, date, m, profile?.name || '');
      toast('تم تحضير الباقين حاضرين');
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };

  const counts = MARKS.map((m) => ({ ...m, n: roster.filter((r) => marks[r.studentId] === m.key).length }));
  const unmarked = roster.filter((r) => !marks[r.studentId]).length;

  if (!dates.length) return <Card><Empty>لم تحدد أيام لهذه الدورة.</Empty></Card>;

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {dates.map((d, i) => {
          const done = attByDay.has(i + 1) && Object.keys(attByDay.get(i + 1)!.marks || {}).length > 0;
          return (
            <button
              id={`day-${i + 1}`}
              key={i}
              onClick={() => setDay(i + 1)}
              className={cx(
                'shrink-0 rounded-lg border px-3 py-2 text-center',
                day === i + 1 ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:border-ink',
                d === today() && day !== i + 1 && 'border-brand'
              )}
            >
              <div className="text-sm font-extrabold">اليوم {i + 1}{done ? ' ✓' : ''}</div>
              <div className={cx('text-xs', day === i + 1 ? 'text-white/80' : 'text-muted')}>{fmtDate(d).slice(0, 5)}</div>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
          <div>
            <div className="font-extrabold">اليوم {day} · {weekdayName(date)} {fmtDate(date)}</div>
            <div className="mt-0.5 text-sm text-muted">
              {counts.map((c) => `${c.label} ${c.n}`).join(' · ')}{unmarked ? ` · لم يحضّر ${unmarked}` : ''}
            </div>
          </div>
          <Button variant="dark" onClick={allPresent} busy={busy} disabled={!unmarked}>تحضير الباقين حاضرين</Button>
        </div>
        {roster.length === 0 ? (
          <Empty>لا يوجد طلاب مسجلون في الدورة.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {roster.map((r, i) => (
              <div key={r.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-bold">
                  <span className="ml-2 text-sm text-muted">{i + 1}</span>
                  {r.studentName}
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:w-96">
                  {MARKS.map((m) => {
                    const on = marks[r.studentId] === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => mark(r.studentId, m.key)}
                        className={cx(
                          'h-10 rounded-lg border text-sm font-bold transition-colors',
                          on && m.key === 'P' && 'border-emerald-600 bg-emerald-600 text-white',
                          on && m.key === 'A' && 'border-red-600 bg-red-600 text-white',
                          on && m.key === 'L' && 'border-amber-500 bg-amber-500 text-white',
                          on && m.key === 'E' && 'border-brand bg-brand text-white',
                          !on && 'border-line bg-white text-ink-2 hover:border-ink'
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="mt-3 text-sm text-muted">يُحفظ التحضير تلقائيا عند كل ضغطة. الضغط على الحالة المختارة مرة أخرى يلغيها.</p>
    </>
  );
}

/* ================= كشف الحضور ================= */
const markColor: Record<Mark, string> = { P: '#d1fae5', A: '#fee2e2', L: '#fef3c7', E: '#e8f1fd' };

function attendanceReport(course: Course, roster: Enrollment[], attByDay: Map<number, AttendanceDay>): Report {
  const days = course.sessionDates;
  return {
    title: `كشف الحضور والغياب - ${course.name}`,
    info: [
      ['المدرب', course.trainerName || '—'],
      ['عدد الطلاب', String(roster.length)],
      ['المدة', `${days.length} يوم (${fmtDate(days[0])} - ${fmtDate(days[days.length - 1])})`],
      ['الرموز', 'ح حاضر · غ غائب · م متأخر · ع بعذر'],
    ],
    headers: ['م', 'اسم الطالب', ...days.map((_, i) => `${i + 1}`), 'حضور', 'غياب', 'النسبة'],
    rows: roster.map((r, i) => {
      const s = studentStats(r.studentId, course, attByDay);
      return [
        i + 1,
        r.studentName,
        ...days.map((_, d) => {
          const m = attByDay.get(d + 1)?.marks?.[r.studentId];
          return m ? MARK_SHORT[m] : '';
        }),
        s.P + s.L,
        s.A,
        s.rate === null ? '' : `${s.rate}%`,
      ];
    }),
    orientation: days.length > 6 ? 'landscape' : 'portrait',
    compactFrom: 2,
    cellColor: (v, col) => {
      if (col < 2 || col >= 2 + days.length) return undefined;
      const k = (Object.keys(MARK_SHORT) as Mark[]).find((m) => MARK_SHORT[m] === v);
      return k ? markColor[k] : undefined;
    },
    filename: `كشف_الحضور_${course.name}`,
  };
}

function Sheet({ course, roster, attByDay }: { course: Course; roster: Enrollment[]; attByDay: Map<number, AttendanceDay> }) {
  const settings = useSettings();
  const days = course.sessionDates;
  const cls: Record<Mark, string> = {
    P: 'bg-emerald-100 text-emerald-800',
    A: 'bg-red-100 text-red-700',
    L: 'bg-amber-100 text-amber-800',
    E: 'bg-brand-soft text-brand-dark',
  };
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
        <div className="text-sm text-muted">ح حاضر · غ غائب · م متأخر · ع بعذر</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportPdf(attendanceReport(course, roster, attByDay), settings)}>تصدير PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportExcel(attendanceReport(course, roster, attByDay), settings)}>تصدير Excel</Button>
        </div>
      </div>
      {roster.length === 0 ? (
        <Empty>لا يوجد طلاب.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="border-b border-line bg-paper/60 text-muted">
                <th className="px-2 py-2">م</th>
                <th className="sticky right-0 bg-paper px-3 py-2 text-right">الطالب</th>
                {days.map((d, i) => (
                  <th key={i} className="px-1 py-2 font-bold" title={fmtDate(d)}>
                    <div>{i + 1}</div>
                    <div className="text-[10px] font-normal">{fmtDate(d).slice(0, 5)}</div>
                  </th>
                ))}
                <th className="px-2 py-2">حضور</th>
                <th className="px-2 py-2">غياب</th>
                <th className="px-2 py-2">النسبة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {roster.map((r, i) => {
                const s = studentStats(r.studentId, course, attByDay);
                return (
                  <tr key={r.id}>
                    <td className="px-2 py-2 text-muted">{i + 1}</td>
                    <td className="sticky right-0 whitespace-nowrap bg-white px-3 py-2 text-right font-bold">{r.studentName}</td>
                    {days.map((_, d) => {
                      const m = attByDay.get(d + 1)?.marks?.[r.studentId];
                      return (
                        <td key={d} className="px-0.5 py-1.5">
                          {m ? (
                            <span title={MARK_LABEL[m]} className={cx('inline-flex h-7 w-7 items-center justify-center rounded-md font-bold', cls[m])}>
                              {MARK_SHORT[m]}
                            </span>
                          ) : (
                            <span className="text-line">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 font-bold">{s.P + s.L}</td>
                    <td className="px-2 py-2 font-bold">{s.A}</td>
                    <td className="px-2 py-2 font-bold">{s.rate === null ? '—' : `${s.rate}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ================= الكشوفات ================= */
function Reports({
  course,
  roster,
  accMap,
  attByDay,
}: {
  course: Course;
  roster: Enrollment[];
  accMap: Map<string, Account>;
  attByDay: Map<number, AttendanceDay>;
}) {
  const { profile } = useAuth();
  const settings = useSettings();
  const finance = can.finance(profile?.role);
  const [busy, setBusy] = useState('');

  const namesReport = (): Report => ({
    title: `كشف أسماء الطلاب - ${course.name}`,
    info: [
      ['المدرب', course.trainerName || '—'],
      ['عدد الطلاب', String(roster.length)],
      ['البداية', fmtDate(course.sessionDates[0])],
      ['الوقت', course.time || '—'],
    ],
    headers: ['م', 'اسم الطالب', 'الجوال', 'التوقيع'],
    rows: roster.map((r, i) => [i + 1, r.studentName, r.studentPhone, '']),
    filename: `كشف_أسماء_${course.name}`,
  });

  const financeReport = (): Report => {
    const t: Record<Currency, { due: number; paid: number; rem: number }> = {
      SAR: { due: 0, paid: 0, rem: 0 },
      YER: { due: 0, paid: 0, rem: 0 },
    };
    const rows = roster.map((r, i) => {
      const a = accMap.get(r.id);
      const x = accountTotals(a);
      if (a) {
        t[a.currency].due += x.due;
        t[a.currency].paid += x.paid;
        t[a.currency].rem += x.remaining;
      }
      return [
        i + 1,
        r.studentName,
        r.studentPhone,
        a ? CURRENCY_LABEL[a.currency] : '',
        a?.price || 0,
        a?.discount || 0,
        x.due,
        x.paid,
        x.remaining,
      ];
    });
    return {
      title: `الكشف المالي - ${course.name}`,
      info: [
        ['عدد الطلاب', String(roster.length)],
        ['الإجمالي بالسعودي', `مستحق ${money(t.SAR.due, 'SAR')} · مدفوع ${money(t.SAR.paid, 'SAR')} · متبقي ${money(t.SAR.rem, 'SAR')}`],
        ['الإجمالي باليمني', `مستحق ${money(t.YER.due, 'YER')} · مدفوع ${money(t.YER.paid, 'YER')} · متبقي ${money(t.YER.rem, 'YER')}`],
      ],
      headers: ['م', 'اسم الطالب', 'الجوال', 'العملة', 'السعر', 'الخصم', 'المستحق', 'المدفوع', 'المتبقي'],
      rows,
      filename: `الكشف_المالي_${course.name}`,
    };
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(errorText(e), true);
    } finally {
      setBusy('');
    }
  };

  const items = [
    { key: 'names', title: 'كشف أسماء الطلاب', desc: 'الأسماء وأرقام الجوال مع عمود للتوقيع', report: namesReport },
    { key: 'att', title: 'كشف الحضور والغياب', desc: 'جميع أيام الدورة مع نسبة حضور كل طالب', report: () => attendanceReport(course, roster, attByDay) },
    ...(finance ? [{ key: 'fin', title: 'الكشف المالي', desc: 'المستحق والمدفوع والمتبقي لكل طالب بالعملتين', report: financeReport }] : []),
  ];

  return (
    <div className="grid gap-3">
      {items.map((it) => (
        <Card key={it.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-extrabold">{it.title}</div>
            <div className="text-sm text-muted">{it.desc}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" busy={busy === it.key + 'p'} onClick={() => run(it.key + 'p', () => exportPdf(it.report(), settings))}>PDF</Button>
            <Button variant="outline" busy={busy === it.key + 'x'} onClick={() => run(it.key + 'x', () => exportExcel(it.report(), settings))}>Excel</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ================= بيانات الدورة ================= */
function Info({
  course,
  finance,
  canEdit,
  canDelete,
  enrolled,
  onEdit,
}: {
  course: Course;
  finance: boolean;
  canEdit: boolean;
  canDelete: boolean;
  enrolled: number;
  onEdit: () => void;
}) {
  const remove = async () => {
    const msg = enrolled
      ? `الدورة فيها ${enrolled} طالب. حذفها سيحذف تسجيلاتهم وحساباتهم وسجل الحضور. متأكد؟`
      : 'حذف الدورة نهائيا؟';
    if (!window.confirm(msg)) return;
    try {
      await deleteCourse(course.id);
      toast('تم حذف الدورة');
      go('courses');
    } catch (e) {
      toast(errorText(e), true);
    }
  };
  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-left font-bold">{v || '—'}</span>
    </div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        {row('المدرب', course.trainerName)}
        {row('النوع', course.mode)}
        {row(course.mode === 'أونلاين' ? 'الرابط' : 'المكان', course.location)}
        {row('الوقت', course.time)}
        {row('عدد الأيام', `${course.sessionDates.length} يوم`)}
        {row('المقاعد', course.seats ? `${enrolled} من ${course.seats}` : String(enrolled))}
        {finance && row('السعر بالسعودي', money(course.priceSAR, 'SAR'))}
        {finance && row('السعر باليمني', money(course.priceYER, 'YER'))}
        {course.notes && <p className="mt-3 rounded-lg bg-paper p-3 text-sm">{course.notes}</p>}
        {(canEdit || canDelete) && (
          <div className="mt-4 flex gap-2">
            {canEdit && <Button variant="outline" onClick={onEdit}>تعديل الدورة</Button>}
            {canDelete && <Button variant="danger" onClick={remove}>حذف الدورة</Button>}
          </div>
        )}
      </Card>
      <Card className="p-4">
        <h3 className="mb-2 font-extrabold">جدول الأيام</h3>
        <div className="grid grid-cols-2 gap-x-6 text-sm sm:grid-cols-2">
          {course.sessionDates.map((d, i) => (
            <div key={i} className={cx('flex justify-between border-b border-line py-1.5', d === today() && 'font-bold text-brand')}>
              <span>اليوم {i + 1}</span>
              <span>{weekdayName(d)} {fmtDate(d)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
