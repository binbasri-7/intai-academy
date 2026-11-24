import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  busy,
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; busy?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || busy}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-[15px]',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-dark',
        variant === 'dark' && 'bg-ink text-white hover:bg-black',
        variant === 'outline' && 'border border-line bg-white text-ink hover:border-ink',
        variant === 'ghost' && 'text-brand hover:bg-brand-soft',
        variant === 'danger' && 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
        className
      )}
    >
      {busy ? 'جار الحفظ…' : children}
    </button>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-bold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full h-10 rounded-lg border border-line bg-white px-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-paper';

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cx(inputCls, className)} />
);

export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(inputCls, 'pl-8', className)}>
    {children}
  </select>
);

export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(inputCls, 'h-auto min-h-20 py-2', className)} />
);

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={cx(
          'flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm font-bold text-muted hover:bg-paper hover:text-ink">
            إغلاق
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-line bg-white', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-bold text-muted">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-ink">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-muted">{children}</div>;
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'blue' | 'green' | 'red' | 'amber' }) {
  return (
    <span
      className={cx(
        'inline-block rounded-md px-2 py-0.5 text-xs font-bold',
        tone === 'gray' && 'bg-paper text-ink-2',
        tone === 'blue' && 'bg-brand-soft text-brand-dark',
        tone === 'green' && 'bg-emerald-50 text-emerald-700',
        tone === 'red' && 'bg-red-50 text-red-700',
        tone === 'amber' && 'bg-amber-50 text-amber-700'
      )}
    >
      {children}
    </span>
  );
}

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full text-right text-[15px]">
        <thead>
          <tr className="border-b border-line bg-paper/60 text-sm text-muted">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2.5 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cx('px-3 py-2.5 align-middle', className)}>{children}</td>
);

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string }[] }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-[15px] font-bold',
            value === t.key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- إشعارات بسيطة ---------- */
type ToastMsg = { id: number; text: string; error?: boolean };
let pushToast: (t: ToastMsg) => void = () => {};
export const toast = (text: string, error = false) => pushToast({ id: Date.now() + Math.random(), text, error });

export function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      setList((l) => [...l.slice(-2), t]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 3500);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div
          key={t.id}
          className={cx('rounded-lg px-4 py-2.5 text-sm font-bold text-white shadow-lg', t.error ? 'bg-red-600' : 'bg-ink')}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function errorText(e: any): string {
  const code: string = e?.code || '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/user-not-found': 'اسم المستخدم غير موجود.',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلا ثم حاول مجددا.',
    'auth/email-already-in-use': 'اسم المستخدم مستخدم مسبقا.',
    'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل).',
    'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت.',
    'permission-denied': 'ليست لديك صلاحية لهذه العملية.',
    unavailable: 'لا يوجد اتصال بالإنترنت.',
  };
  return map[code] || e?.message || 'حدث خطأ غير متوقع.';
}

export async function confirmAction(text: string) {
  return window.confirm(text);
}

export { cx };
