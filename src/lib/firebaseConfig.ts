// إعدادات مشروع Firebase الخاص بالأكاديمية
// تُنسخ من: Firebase Console > Project settings > General > Your apps > Web app > SDK setup and configuration
// (هذه القيم ليست سرية، الحماية تتم عبر قواعد firestore.rules)
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// نطاق داخلي يحوّل اسم المستخدم إلى بريد لتسجيل الدخول (لا يُرسل إليه أي بريد)
export const USER_DOMAIN = 'users.intai-academy.app';
