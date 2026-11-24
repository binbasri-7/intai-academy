export type Role = 'admin' | 'deputy' | 'registrar' | 'secretary' | 'trainer';
export type Currency = 'SAR' | 'YER';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  role: Role;
  active: boolean;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  gender?: string;
  city?: string;
  idNumber?: string;
  qualification?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
}

export type CourseStatus = 'open' | 'running' | 'done' | 'cancelled';

export interface Course {
  id: string;
  name: string;
  trainerId: string;
  trainerName: string;
  mode: string;
  location: string;
  time: string;
  startDate: string;
  daysCount: number;
  weekdays: number[];
  sessionDates: string[];
  priceSAR: number;
  priceYER: number;
  seats: number;
  status: CourseStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  trainerId: string;
  createdAt: string;
  createdBy?: string;
}

export interface Payment {
  amount: number;
  date: string;
  method: string;
  by: string;
  note?: string;
}

/** الحساب المالي للتسجيل (نفس معرف التسجيل) */
export interface Account {
  id: string;
  courseId: string;
  studentId: string;
  currency: Currency;
  price: number;
  discount: number;
  payments: Payment[];
  updatedAt?: string;
}

export type Mark = 'P' | 'A' | 'L' | 'E';

export interface AttendanceDay {
  id: string;
  courseId: string;
  trainerId: string;
  day: number;
  date: string;
  marks: Record<string, Mark>;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Product {
  id: string;
  name: string;
  priceSAR: number;
  priceYER: number;
  stock: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  buyer: string;
  qty: number;
  currency: Currency;
  unitPrice: number;
  total: number;
  paid: number;
  method: string;
  date: string;
  by: string;
  createdAt: string;
}

export interface Settings {
  academyName: string;
  academyNameEn: string;
  phone: string;
  address: string;
  paymentMethods: string[];
  defaultCurrency: Currency;
}
