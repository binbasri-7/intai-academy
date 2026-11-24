import type { Settings } from './types';
import { fmtDate, num, today } from './format';

export interface Report {
  title: string;
  /** سطور معلومات أعلى الكشف: [العنوان، القيمة] */
  info?: [string, string][];
  headers: string[];
  rows: (string | number)[][];
  /** صف إجماليات اختياري */
  totals?: (string | number)[];
  orientation?: 'portrait' | 'landscape';
  filename: string;
  /** أعمدة تُعرض بخط أصغر/أضيق (مثل أعمدة الأيام في كشف الحضور) */
  compactFrom?: number;
  /** ألوان خلايا اختيارية حسب القيمة */
  cellColor?: (value: string | number, col: number) => string | undefined;
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_');

/* ================= Excel ================= */
export async function exportExcel(r: Report, settings: Settings) {
  const XLSX = await import('xlsx');
  const aoa: (string | number)[][] = [];
  aoa.push([settings.academyName]);
  aoa.push([r.title]);
  (r.info || []).forEach(([k, v]) => aoa.push([`${k}: ${v}`]));
  aoa.push([`تاريخ الإصدار: ${fmtDate(today())}`]);
  aoa.push([]);
  const headerRow = aoa.length;
  aoa.push(r.headers);
  r.rows.forEach((row) => aoa.push(row));
  if (r.totals) aoa.push(r.totals);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = r.headers.map((h, i) => {
    const max = Math.max(h.length, ...r.rows.map((row) => String(row[i] ?? '').length));
    return { wch: Math.min(40, Math.max(6, max + 2)) };
  });
  ws['!merges'] = aoa
    .slice(0, headerRow - 1)
    .map((_, i) => ({ s: { r: i, c: 0 }, e: { r: i, c: Math.max(0, r.headers.length - 1) } }));
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + r.rows.length, c: r.headers.length - 1 } }),
  };
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] } as any;
  XLSX.utils.book_append_sheet(wb, ws, 'الكشف');
  XLSX.writeFile(wb, `${safe(r.filename)}.xlsx`);
}

/* ================= PDF ================= */
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function exportPdf(r: Report, settings: Settings) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas-pro')]);
  await document.fonts.ready;

  const landscape = r.orientation === 'landscape';
  const W = landscape ? 1123 : 794;
  const H = landscape ? 794 : 1123;
  const PAD = 36;
  const compact = r.compactFrom ?? Infinity;
  const fs = r.headers.length > 14 ? 11 : r.headers.length > 9 ? 12 : 13;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;z-index:-1;';
  document.body.appendChild(host);

  const css = `
    .pg{width:${W}px;height:${H}px;padding:${PAD}px;box-sizing:border-box;background:#fff;color:#0a0a0a;
        font-family:Tajawal,system-ui,sans-serif;direction:rtl;display:flex;flex-direction:column;}
    .hd{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1a73e9;padding-bottom:12px;margin-bottom:12px;}
    .hd img{width:58px;height:58px;object-fit:contain}
    .hd .n{font-size:19px;font-weight:800;line-height:1.3}
    .hd .e{font-size:12px;color:#6b6f76;direction:ltr;text-align:right}
    .hd .d{margin-right:auto;text-align:left;font-size:12px;color:#6b6f76;line-height:1.6}
    .tt{font-size:18px;font-weight:800;margin:2px 0 8px}
    .inf{display:flex;flex-wrap:wrap;gap:4px 22px;font-size:13px;margin-bottom:10px;color:#333}
    .inf b{color:#0a0a0a}
    table{width:100%;border-collapse:collapse;font-size:${fs}px}
    th{background:#0a0a0a;color:#fff;font-weight:700;padding:6px 5px;border:1px solid #0a0a0a;text-align:center;white-space:nowrap}
    td{padding:5px 5px;border:1px solid #d9dce1;text-align:center}
    td.l{text-align:right}
    tr:nth-child(even) td{background:#f7f8fa}
    tr.tot td{background:#e8f1fd;font-weight:800}
    th.c,td.c{padding:4px 2px;min-width:22px}
    .body{flex:1;overflow:hidden}
    .ft{display:flex;justify-content:space-between;font-size:11px;color:#6b6f76;border-top:1px solid #e4e6ea;padding-top:6px;margin-top:8px}
  `;

  const headerHtml = `
    <div class="hd">
      <img src="/logo.png" />
      <div><div class="n">${esc(settings.academyName)}</div><div class="e">${esc(settings.academyNameEn)}</div></div>
      <div class="d">${settings.phone ? `<div class="ltr">${esc(settings.phone)}</div>` : ''}${settings.address ? `<div>${esc(settings.address)}</div>` : ''}<div>تاريخ الإصدار: ${fmtDate(today())}</div></div>
    </div>`;
  const infoHtml =
    `<div class="tt">${esc(r.title)}</div>` +
    (r.info?.length ? `<div class="inf">${r.info.map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`).join('')}</div>` : '');
  const thead = `<thead><tr>${r.headers.map((h, i) => `<th class="${i >= compact ? 'c' : ''}">${esc(h)}</th>`).join('')}</tr></thead>`;
  const rowHtml = (row: (string | number)[], cls = '') =>
    `<tr class="${cls}">${row
      .map((v, i) => {
        const bg = r.cellColor?.(v, i);
        const text = typeof v === 'number' && i > 0 ? num(v) : v;
        return `<td class="${i >= compact ? 'c' : i === 1 ? 'l' : ''}"${bg ? ` style="background:${bg}"` : ''}>${esc(text)}</td>`;
      })
      .join('')}</tr>`;

  const newPage = (first: boolean) => {
    const pg = document.createElement('div');
    pg.className = 'pg';
    pg.innerHTML = `<style>${css}</style>${headerHtml}<div class="body">${first ? infoHtml : `<div class="tt">${esc(r.title)}</div>`}<table>${thead}<tbody></tbody></table></div><div class="ft"><span>${esc(settings.academyName)}</span><span class="pn"></span></div>`;
    host.appendChild(pg);
    return pg;
  };

  const pages: HTMLDivElement[] = [];
  let pg = newPage(true);
  pages.push(pg);
  const all = r.rows.map((row) => rowHtml(row));
  if (r.totals) all.push(rowHtml(r.totals, 'tot'));
  if (!all.length) all.push(`<tr><td colspan="${r.headers.length}">لا توجد بيانات</td></tr>`);

  for (const html of all) {
    let body = pg.querySelector('.body') as HTMLDivElement;
    let tbody = pg.querySelector('tbody')!;
    tbody.insertAdjacentHTML('beforeend', html);
    if (body.scrollHeight > body.clientHeight && tbody.rows.length > 1) {
      tbody.lastElementChild!.remove();
      pg = newPage(false);
      pages.push(pg);
      body = pg.querySelector('.body') as HTMLDivElement;
      tbody = pg.querySelector('tbody')!;
      tbody.insertAdjacentHTML('beforeend', html);
    }
  }
  pages.forEach((p, i) => ((p.querySelector('.pn') as HTMLElement).textContent = `صفحة ${i + 1} من ${pages.length}`));

  // انتظار تحميل الشعار
  await Promise.all(
    pages.map((p) => {
      const img = p.querySelector('img')!;
      return img.complete ? Promise.resolve() : new Promise((res) => ((img.onload = res), (img.onerror = res)));
    })
  );

  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  try {
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, ph);
    }
    pdf.save(`${safe(r.filename)}.pdf`);
  } finally {
    host.remove();
  }
}
