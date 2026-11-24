import { useMemo } from 'react';
import { useAuth } from '../lib/auth';
import { useCollection } from '../lib/store';
import { can } from '../lib/roles';
import { go } from '../lib/hooks';
import { accountTotals, fmtDate, num, today, weekdayName } from '../lib/format';
import type { Account, Student } from '../lib/types';
import { Button, Card, Empty, PageHeader, Stat } from '../ui';
import { useMyCourses } from './Courses';

export default function Dashboard() {
  const { profile } = useAuth();
  const staff = can.staff(profile?.role);
  const { courses, enrollments, trainer } = useMyCourses();
  const students = useCollection<Student>('students', [], staff);
  const accounts = useCollection<Account>('accounts', [], staff);
  const t = today();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    enrollments.data.forEach((e) => m.set(e.courseId, (m.get(e.courseId) || 0) + 1));
    return m;
  }, [enrollments.data]);

  const active = courses.data.filter((c) => c.status === 'open' || c.status === 'running');
  const todays = courses.data
    .filter((c) => c.status !== 'cancelled' && (c.sessionDates || []).includes(t))
    .map((c) => ({ c, day: c.sessionDates.indexOf(t) + 1 }));
  const upcoming = courses.data
    .filter((c) => c.status !== 'cancelled' && (c.sessionDates?.[0] || '') > t)
    .sort((a, b) => a.sessionDates[0].localeCompare(b.sessionDates[0]))
    .slice(0, 5);

  const remaining = useMemo(() => {
    const r = { SAR: 0, YER: 0 };
    accounts.data.forEach((a) => {
      const x = accountTotals(a).remaining;
      if (x > 0) r[a.currency] += x;
    });
    return r;
  }, [accounts.data]);

  const hour = new Date().getHours();
  return (
    <>
      <PageHeader
        title={`${hour < 12 ? 'صباح الخير' : 'مساء الخير'}، ${profile?.name.split(' ')[0] || ''}`}
        subtitle={`${weekdayName(t)} ${fmtDate(t)}`}
      />

      {staff && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="الطلاب" value={num(students.data.length)} />
          <Stat label="الدورات الحالية" value={num(active.length)} sub={`${num(active.reduce((s, c) => s + (counts.get(c.id) || 0), 0))} طالب مسجل`} />
          <Stat label="المتبقي بالسعودي" value={num(remaining.SAR)} sub="ريال سعودي" />
          <Stat label="المتبقي باليمني" value={num(remaining.YER)} sub="ريال يمني" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-line p-4 font-extrabold">دورات اليوم</div>
          {todays.length === 0 ? (
            <Empty>لا توجد أيام تدريبية اليوم.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {todays.map(({ c, day }) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-bold">{c.name}</div>
                    <div className="text-sm text-muted">
                      اليوم {day} من {c.sessionDates.length}
                      {c.time && ` · ${c.time}`}
                      {!trainer && c.trainerName && ` · ${c.trainerName}`}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => go(`courses/${c.id}`)}>التحضير</Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="border-b border-line p-4 font-extrabold">{trainer ? 'دوراتي الحالية' : 'تبدأ قريبا'}</div>
          {(trainer ? active : upcoming).length === 0 ? (
            <Empty>لا توجد دورات.</Empty>
          ) : (
            <div className="divide-y divide-line">
              {(trainer ? active : upcoming).map((c) => (
                <button key={c.id} onClick={() => go(`courses/${c.id}`)} className="flex w-full items-center justify-between gap-3 p-4 text-right hover:bg-paper/50">
                  <div>
                    <div className="font-bold">{c.name}</div>
                    <div className="text-sm text-muted">
                      تبدأ {fmtDate(c.sessionDates[0])} · {counts.get(c.id) || 0} طالب
                    </div>
                  </div>
                  <span className="text-sm font-bold text-brand">فتح</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
