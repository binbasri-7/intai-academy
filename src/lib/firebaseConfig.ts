// إعدادات مشروع Firebase الخاص بالأكاديمية
// تُنسخ من: Firebase Console > Project settings > General > Your apps > Web app > SDK setup and configuration
// (هذه القيم ليست سرية، الحماية تتم عبر قواعد firestore.rules)
export const firebaseConfig = {
  apiKey: 'AIzaSyBecf4hfc6RWvkWSDEDcdexsv2EAM-HBdQ',
  authDomain: 'intai-academy.firebaseapp.com',
  projectId: 'intai-academy',
  storageBucket: 'intai-academy.firebasestorage.app',
  messagingSenderId: '829511510497',
  appId: '1:829511510497:web:44e4bd8004672b8e448aa0',
};

// نطاق داخلي يحوّل اسم المستخدم إلى بريد لتسجيل الدخول (لا يُرسل إليه أي بريد)
export const USER_DOMAIN = 'users.intai-academy.app';
