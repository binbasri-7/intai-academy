import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, getAuth } from 'firebase/auth';
import { db, secondaryApp, usernameToEmail } from './firebase';
import type {
  Account,
  Course,
  Currency,
  Enrollment,
  Mark,
  Payment,
  Product,
  Role,
  Sale,
  Settings,
  Student,
  UserProfile,
} from './types';
import { nowISO } from './format';

const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/* ---------- الطلاب ---------- */
export async function saveStudent(s: Partial<Student> & { name: string }, by: string) {
  const { id, ...data } = s;
  if (id) {
    await updateDoc(doc(db, 'students', id), clean({ ...data, updatedAt: nowISO() }));
    // تحديث الاسم والجوال في تسجيلات الطالب
    const enr = await getDocs(query(collection(db, 'enrollments'), where('studentId', '==', id)));
    if (!enr.empty) {
      const b = writeBatch(db);
      enr.docs.forEach((d) => b.update(d.ref, { studentName: s.name, studentPhone: s.phone || '' }));
      await b.commit();
    }
    return id;
  }
  const ref = await addDoc(collection(db, 'students'), clean({ ...data, createdAt: nowISO(), createdBy: by }));
  return ref.id;
}

export async function deleteStudent(id: string) {
  const enr = await getDocs(query(collection(db, 'enrollments'), where('studentId', '==', id)));
  if (!enr.empty) throw new Error('لا يمكن حذف طالب مسجل في دورات. احذفه من الدورات أولا.');
  await deleteDoc(doc(db, 'students', id));
}

/* ---------- الدورات ---------- */
export async function saveCourse(c: Omit<Course, 'id' | 'createdAt'> & { id?: string }, previousTrainerId?: string) {
  const { id, ...data } = c;
  if (id) {
    await updateDoc(doc(db, 'courses', id), clean({ ...data, updatedAt: nowISO() }));
    const [enr, att] = await Promise.all([
      getDocs(query(collection(db, 'enrollments'), where('courseId', '==', id))),
      previousTrainerId !== c.trainerId
        ? getDocs(query(collection(db, 'attendance'), where('courseId', '==', id)))
        : Promise.resolve(null),
    ]);
    const b = writeBatch(db);
    enr.docs.forEach((d) => b.update(d.ref, { courseName: c.name, trainerId: c.trainerId }));
    att?.docs.forEach((d) => b.update(d.ref, { trainerId: c.trainerId }));
    if (!enr.empty || (att && !att.empty)) await b.commit();
    return id;
  }
  const ref = await addDoc(collection(db, 'courses'), clean({ ...data, createdAt: nowISO() }));
  return ref.id;
}

export async function deleteCourse(id: string) {
  const [enr, att] = await Promise.all([
    getDocs(query(collection(db, 'enrollments'), where('courseId', '==', id))),
    getDocs(query(collection(db, 'attendance'), where('courseId', '==', id))),
  ]);
  const b = writeBatch(db);
  enr.docs.forEach((d) => {
    b.delete(d.ref);
    b.delete(doc(db, 'accounts', d.id));
  });
  att.docs.forEach((d) => b.delete(d.ref));
  b.delete(doc(db, 'courses', id));
  await b.commit();
}

/* ---------- التسجيل والحسابات ---------- */
export async function enrollStudent(
  course: Course,
  student: Student,
  acc: { currency: Currency; price: number; discount: number; firstPayment?: Payment },
  by: string
) {
  const existing = await getDocs(
    query(collection(db, 'enrollments'), where('courseId', '==', course.id), where('studentId', '==', student.id))
  );
  if (!existing.empty) throw new Error('الطالب مسجل في هذه الدورة مسبقا.');
  const ref = doc(collection(db, 'enrollments'));
  const b = writeBatch(db);
  const enrollment: Omit<Enrollment, 'id'> = {
    courseId: course.id,
    courseName: course.name,
    studentId: student.id,
    studentName: student.name,
    studentPhone: student.phone || '',
    trainerId: course.trainerId || '',
    createdAt: nowISO(),
    createdBy: by,
  };
  b.set(ref, enrollment);
  const account: Omit<Account, 'id'> = {
    courseId: course.id,
    studentId: student.id,
    currency: acc.currency,
    price: acc.price,
    discount: acc.discount,
    payments: acc.firstPayment && acc.firstPayment.amount > 0 ? [acc.firstPayment] : [],
    updatedAt: nowISO(),
  };
  b.set(doc(db, 'accounts', ref.id), account);
  await b.commit();
}

export async function removeEnrollment(id: string) {
  const b = writeBatch(db);
  b.delete(doc(db, 'enrollments', id));
  b.delete(doc(db, 'accounts', id));
  await b.commit();
}

export async function saveAccount(a: Account) {
  const { id, ...data } = a;
  await setDoc(doc(db, 'accounts', id), { ...data, updatedAt: nowISO() });
}

/* ---------- الحضور ---------- */
export async function setMarks(
  course: Course,
  day: number,
  date: string,
  marks: Record<string, Mark | null>,
  by: string
) {
  const ref = doc(db, 'attendance', `${course.id}_${day}`);
  const m: Record<string, any> = {};
  Object.entries(marks).forEach(([sid, v]) => (m[sid] = v));
  // setDoc مع merge يدمج الخريطة الداخلية؛ القيم null تُحذف بعدها
  await setDoc(
    ref,
    { courseId: course.id, trainerId: course.trainerId || '', day, date, marks: m, updatedAt: nowISO(), updatedBy: by },
    { merge: true }
  );
  const removed = Object.entries(marks).filter(([, v]) => v === null);
  if (removed.length) {
    const { deleteField } = await import('firebase/firestore');
    await updateDoc(ref, Object.fromEntries(removed.map(([sid]) => [`marks.${sid}`, deleteField()])));
  }
}

/* ---------- المنتجات والمبيعات ---------- */
export async function saveProduct(p: Omit<Product, 'id' | 'createdAt'> & { id?: string }) {
  const { id, ...data } = p;
  if (id) return updateDoc(doc(db, 'products', id), clean({ ...data, updatedAt: nowISO() }));
  await addDoc(collection(db, 'products'), clean({ ...data, createdAt: nowISO() }));
}

export const deleteProduct = (id: string) => deleteDoc(doc(db, 'products', id));

export async function addSale(s: Omit<Sale, 'id' | 'createdAt'>) {
  const b = writeBatch(db);
  b.set(doc(collection(db, 'sales')), { ...s, createdAt: nowISO() });
  b.update(doc(db, 'products', s.productId), { stock: increment(-s.qty), updatedAt: nowISO() });
  await b.commit();
}

export async function updateSalePaid(id: string, paid: number) {
  await updateDoc(doc(db, 'sales', id), { paid });
}

export async function deleteSale(s: Sale) {
  const b = writeBatch(db);
  b.delete(doc(db, 'sales', s.id));
  b.update(doc(db, 'products', s.productId), { stock: increment(s.qty), updatedAt: nowISO() });
  await b.commit();
}

/* ---------- المستخدمون ---------- */
export async function createStaffUser(u: { name: string; username: string; password: string; role: Role; phone?: string }) {
  const sec = getAuth(secondaryApp());
  const cred = await createUserWithEmailAndPassword(sec, usernameToEmail(u.username), u.password);
  await signOut(sec);
  const profile: Omit<UserProfile, 'id'> = {
    name: u.name,
    username: u.username.trim().toLowerCase(),
    role: u.role,
    active: true,
    phone: u.phone || '',
    createdAt: nowISO(),
  };
  await setDoc(doc(db, 'users', cred.user.uid), profile);
}

export const updateUser = (id: string, data: Partial<UserProfile>) =>
  updateDoc(doc(db, 'users', id), clean({ ...data, updatedAt: nowISO() }));

/* ---------- الإعدادات ---------- */
export const DEFAULT_SETTINGS: Settings = {
  academyName: 'أكاديمية الذكاء الاصطناعي الدولية',
  academyNameEn: 'International AI Academy',
  phone: '',
  address: '',
  paymentMethods: ['نقدا', 'تحويل بنكي', 'الكريمي', 'أونلاين'],
  defaultCurrency: 'SAR',
};

export const saveSettings = (s: Settings) => setDoc(doc(db, 'settings', 'main'), s);
