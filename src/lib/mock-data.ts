export interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
}

// Simulasi 50 Soal (Sampel 10 untuk efisiensi kode, struktur tetap untuk 50+)
export const mockQuestions: Question[] = [
  { id: 'q1', questionText: 'Apa fungsi utama dari Firebase Realtime Database?', options: ['Penyimpanan File', 'Sinkronisasi Data Real-time', 'Editing Video', 'Mining Bitcoin'], correctAnswerIndex: 1 },
  { id: 'q2', questionText: 'Bahasa pemrograman apa yang digunakan Flutter?', options: ['Java', 'Dart', 'Python', 'C++'], correctAnswerIndex: 1 },
  { id: 'q3', questionText: 'Siapa penemu world wide web?', options: ['Steve Jobs', 'Bill Gates', 'Tim Berners-Lee', 'Mark Zuckerberg'], correctAnswerIndex: 2 },
  { id: 'q4', questionText: 'Next.js dikembangkan oleh perusahaan apa?', options: ['Google', 'Meta', 'Vercel', 'Microsoft'], correctAnswerIndex: 2 },
  { id: 'q5', questionText: 'Apa itu Tailwind CSS?', options: ['Database', 'Framework CSS Utility-first', 'Bahasa Pemrograman', 'Sistem Operasi'], correctAnswerIndex: 1 },
  { id: 'q6', questionText: 'Manakah yang merupakan NoSQL Database?', options: ['MySQL', 'PostgreSQL', 'MongoDB', 'Oracle'], correctAnswerIndex: 2 },
  { id: 'q7', questionText: 'Port default untuk aplikasi React adalah?', options: ['3000', '8080', '9000', '5000'], correctAnswerIndex: 0 },
  { id: 'q8', questionText: 'Apa kepanjangan dari API?', options: ['Application Programming Interface', 'Apple Product Indonesia', 'Applied Protocol Internet', 'Advanced Program Integration'], correctAnswerIndex: 0 },
  { id: 'q9', questionText: 'Siapa CEO Tesla saat ini?', options: ['Elon Musk', 'Jeff Bezos', 'Tim Cook', 'Satya Nadella'], correctAnswerIndex: 0 },
  { id: 'q10', questionText: 'Apa fungsi dari perintah "git push"?', options: ['Menarik kode', 'Menghapus kode', 'Mengirim kode ke repositori remote', 'Membuat folder baru'], correctAnswerIndex: 2 }
];
