import type { Role } from './types';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'الإدارة',
  deputy: 'نائب المدير',
  registrar: 'مسؤول التسجيل',
  secretary: 'السكرتير',
  trainer: 'المدرب',
};

export const ROLES: Role[] = ['admin', 'deputy', 'registrar', 'secretary', 'trainer'];

const is = (r: Role | undefined, list: Role[]) => !!r && list.includes(r);

export const can = {
  manageUsers: (r?: Role) => is(r, ['admin']),
  settings: (r?: Role) => is(r, ['admin', 'deputy']),
  deleteRecords: (r?: Role) => is(r, ['admin', 'deputy']),
  editCourses: (r?: Role) => is(r, ['admin', 'deputy', 'registrar']),
  removeEnrollment: (r?: Role) => is(r, ['admin', 'deputy', 'registrar']),
  editProducts: (r?: Role) => is(r, ['admin', 'deputy', 'registrar']),
  /** الطلاب، التسجيل، المدفوعات، المبيعات */
  staff: (r?: Role) => is(r, ['admin', 'deputy', 'registrar', 'secretary']),
  finance: (r?: Role) => is(r, ['admin', 'deputy', 'registrar', 'secretary']),
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'كل الصلاحيات، وإدارة المستخدمين والإعدادات',
  deputy: 'كل البيانات والإعدادات والحذف، دون إدارة المستخدمين',
  registrar: 'الطلاب، إنشاء وتعديل الدورات، التسجيل والمدفوعات، الحضور، المنتجات',
  secretary: 'الطلاب، التسجيل في الدورات والمدفوعات، الحضور، البيع',
  trainer: 'دوراته فقط: قائمة الطلاب وتحضير الحضور والغياب',
};
