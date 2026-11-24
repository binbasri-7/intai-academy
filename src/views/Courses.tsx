import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useCollection } from '../lib/store';
import { can } from '../lib/roles';
import { go } from '../lib/hooks';
import { STATUS_LABEL, fmtDate, money, normalize } from '../lib/format';
import type { Course, CourseStatus, Enrollment } from '../lib/types';
import { Badge, Button, Card, Empty, Input, PageHeader, cx } from '../ui';
import CourseForm from './CourseForm';

export const statusTone = (s: CourseStatus) =>
  s === 'running' ? 'blue' : s === 'open' ? 'green' : s === 'cancelled' ? 'red' : 'gray';

export function useMyCourses() {
  const { profile } = useAuth();
  const trainer = profile?.role === 'trainer';
  const filters: [string, any][] = trainer ? [['trainerId', profile!.id]] : [];
  const courses = useCollection<Course>('courses', filters);
  const enrollments = useCollection<Enrollment>('enrollments', filters);
  return { courses, enrollments, trainer };
}

export default function Courses() {
  const { profile } = useAuth();
  const { courses, enrollments, trainer } = useMyCourses();
  const [filter, setFilter] = useState<'active' | CourseStatus | 'all'>('active');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(false);
  const finance = can.finance(profile?.role);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    enrollments.data.forEach((e) => m.set(e.courseId, (m.get(e.courseId) || 0) + 1));
    return m;
  }, [enrollments.data]);

  const list = useMemo(() => {
    const n = normalize(q);
    return courses.data
      .filter((c) => (filter === 'all' ? true : filter === 'active' ? c.status === 'open' || c.status === 'running' : c.status === filter))
      .filter((c) => !n || normalize(c.name).includes(n) || normalize(c.trainerName || '').includes(n))
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }, [courses.data, filter, q]);

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'active', label: 'الحالية' },
    { key: 'open', label: 'التسجيل مفتوح' },
    { key: 'running', label: 'جارية' },
    { key: 'done', label: 'منتهية' },
    { key: 'all', label: 'الكل' },
  ];

  return (
    <>
      <PageHeader
        title={trainer ? 'دوراتي' : 'الدورات'}
        subtitle={`${courses.data.length} دورة`}
        actions={can.editCourses(profile?.role) && <Button onClick={() => setForm(true)}>دورة جديدة</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cx(
              'rounded-lg border px-3 py-1.5 text-sm font-bold',
              filter === f.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-ink'
            )}
          >
            {f.label}
          </button>
        ))}
        <Input className="sm:mr-auto sm:max-w-xs" placeholder="بحث باسم الدورة أو المدرب" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {courses.loading ? (
        <Empty>جار التحميل…</Empty>
      ) : list.length === 0 ? (
        <Card><Empty>لا توجد دورات هنا.</Empty></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const n = counts.get(c.id) || 0;
            const dates = c.sessionDates || [];
            return (
              <button
                key={c.id}
                onClick={() => go(`courses/${c.id}`)}
                className="flex flex-col rounded-xl border border-line bg-white p-4 text-right transition-colors hover:border-brand"
              >
                <div className="flex items-start gap-3">
                  <img src="/logo.png" alt="" className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold leading-snug">{c.name}</div>
                    <div className="mt-0.5 text-sm text-muted">{c.trainerName || 'بدون مدرب'}</div>
                  </div>
                  <Badge tone={statusTone(c.status) as any}>{STATUS_LABEL[c.status]}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
                  <span className="text-muted">البداية</span>
                  <span className="font-bold">{fmtDate(dates[0] || c.startDate)}</span>
                  <span className="text-muted">الأيام</span>
                  <span className="font-bold">{dates.length} يوم · {c.mode}</span>
                  <span className="text-muted">الطلاب</span>
                  <span className="font-bold">{n}{c.seats ? ` من ${c.seats}` : ''}</span>
                  {finance && (
                    <>
                      <span className="text-muted">السعر</span>
                      <span className="font-bold">{money(c.priceSAR, 'SAR')} / {money(c.priceYER, 'YER')}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {form && <CourseForm onClose={() => setForm(false)} onSaved={(id) => go(`courses/${id}`)} />}
    </>
  );
}
