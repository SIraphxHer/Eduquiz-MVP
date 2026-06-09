<<<<<<< HEAD
# EduQuiz MVP

Ini adalah aplikasi kuis cerdas berbasis Next.js yang ditenagai oleh AI (Genkit).

## Cara Menjalankan Lokal (Tanpa Deploy)

Untuk menjalankan aplikasi di komputer Anda sendiri:

1.  **Instal Dependensi**:
    Pastikan Anda sudah menginstal semua paket yang diperlukan:
    ```bash
    npm install
    ```

2.  **Jalankan Server Pengembangan**:
    Gunakan perintah berikut untuk memulai aplikasi:
    ```bash
    npm run dev
    ```
    Aplikasi akan berjalan di [http://localhost:9002](http://localhost:9002).

3.  **Jalankan Genkit Developer UI**:
    Untuk mencoba dan debug flow AI secara visual:
    ```bash
    npm run genkit:dev
    ```
    UI ini biasanya tersedia di [http://localhost:4000](http://localhost:4000).

## Konfigurasi Environment

Pastikan Anda memiliki file `.env` yang berisi kunci API yang diperlukan:
- `GEMINI_API_KEY`: Kunci API Google AI Anda untuk menjalankan fitur analisis kuis.

## Struktur Proyek

- `src/app`: Halaman dan layout utama menggunakan Next.js App Router.
- `src/components`: Komponen UI (termasuk ShadCN) dan logika kuis.
- `src/ai`: Konfigurasi Genkit dan AI flows untuk penjelasan kuis.
- `src/lib`: Data simulasi (mock data) dan fungsi utilitas.
=======
# Eduquiz-MVP
EduQuiz MVP - A high-performance, real-time online examination platform with robust anti-cheat systems, automated WebP image compression, and serverless architecture. Powered by Next.js, Firebase, and Kyuremm.
>>>>>>> b2524af693edccbdd75e2e5bfee8fc72a83c2684
