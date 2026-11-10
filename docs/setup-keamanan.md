# Setup Keamanan EduQuiz (Spark plan)

Versi baru memakai **Firebase Auth + Realtime Database Rules**. Tidak butuh Cloud Functions (jadi tetap jalan di Spark).

## Langkah satu kali

1. **Authentication → Sign-in method**
   - Aktifkan **Anonymous** (untuk siswa).
   - Aktifkan **Email/Password** (untuk operator).
2. **Authentication → Users → Add user**: buat akun operator (email + password kuat). Salin **User UID**-nya.
3. **Realtime Database → Data**: tambahkan node
   ```
   admins
     └── <UID operator>: true
   ```
   Node `admins` hanya bisa ditulis lewat console (rules menolak tulis dari klien).
4. **Realtime Database → Rules**: tempel isi `database.rules.json`, lalu **Publish**.
   (Uji dulu di tab *Rules Playground*.)
5. Hapus node lama `config/admin_settings/secret_code` (PIN lama sudah tidak dipakai).
6. Hapus room lama yang dibuat dengan struktur lama (`rooms/*` tanpa `meta`). Struktur lama tidak kompatibel.

## Struktur data baru

```
admins/{uid}: true
roomIndex/{ROOM}: createdAt                 (untuk pembersihan room > 24 jam)
roomAssets/{ROOM}/{kunciGambar}: dataURL    (gambar WebP base64, dimuat per soal)
rooms/{ROOM}/
  meta/        quizTitle, duration, status, totalQuestions, hasPdf, settings{isExamMode,...}
  questions/   teks soal + opsi + imageKey (TANPA kunci jawaban)
  secret/      password, key[]                (hanya admin)
  review/pdf   PDF pembahasan base64          (siswa baru bisa baca jika Mode Anti-Cheat dimatikan)
  members/{uid}/      name, pw                (bukti siswa tahu password room)
  submissions/{uid}/  answers, violations, isLocked, isFinished, score
```

## Cara kerja

- Siswa masuk dengan menulis `members/{uid}` berisi password. Rules membandingkannya dengan `secret/password` di server, jadi password dan kunci jawaban **tidak pernah dikirim ke browser siswa**.
- Siswa hanya bisa membaca/menulis submission miliknya. Setelah `isFinished = true`, submission terkunci.
- **Skor dihitung oleh dashboard operator** (yang memegang kunci) lalu ditulis ke `submissions/{uid}/score`. Dashboard operator harus terbuka selama ujian agar nilai siswa muncul.
- Password pembuka anti-cheat diganti tombol **Buka Kunci** per siswa di dashboard.

## Keterbatasan (jujur)

- Anti-cheat berbasis browser hanya penghalang, bukan jaminan.
- Password room 6 karakter masih bisa ditebak lewat percobaan berulang; pakai password yang cukup panjang.
- Spark: RTDB dibatasi sekitar 100 koneksi bersamaan, 1 GB simpanan, 10 GB unduhan/bulan (cek ulang di halaman pricing Firebase).
