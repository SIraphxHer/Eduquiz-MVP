# EduQuiz
EduQuiz is a real-time, cloud-based interactive quiz and examination platform built using **Next.js** and **Firebase Realtime Database**. Designed for modern classrooms and online assessments, it enables teachers to effortlessly publish visually rich quizzes and allows students to participate securely with minimal setup.
## 🚀 Features
 * **Real-Time Synchronization:** Powered by Firebase Realtime Database to instantly sync quiz actions, session timers, and student submissions.
 * **Smart Image Encoding:** Incorporates a local Python automation script to compress and inject exam images directly into JSON schemas using Base64 data strings.
 * **Role-Based Access Control (RBAC):** Distinct dashboards and features tailored for **Admin**, **Teachers (Guru)**, and **Students (Siswa)**.
 * **Student Focus Security:** Includes an "Izin Toilet" (Temporary Leave) protocol that locks the student's viewport to maintain examination integrity.
 * **Optimized Mobile UX:** Implements pure CSS text-transform filters on critical fields like Room ID to bypass mobile predictive keyboard bugs (e.g., Gboard/iOS numeric layer bugs).
## 🛠️ Tech Stack
 * **Frontend Framework:** Next.js (React)
 * **Styling:** Tailwind CSS
 * **Database & Auth:** Firebase Realtime Database
 * **Data Processing:** Python 3 (Base64 & JSON utilities)
## 📁 Project Directory Structure
```text
eduquiz/
├── app/                     # Next.js App Router
│   ├── admin/               # Admin Dashboard view and controllers
│   ├── guru/                # Teacher Dashboard view and data management
│   ├── student/             # Student Examination layout and live state
│   └── page.tsx             # Main Landing Page / Entry portal
├── components/              # Reusable UI Components
├── lib/                     # Firebase configuration and initializations
└── local-utilities/         # Offline pipeline tools
    └── converter.py         # Base64 image injector script

```
## 📖 User Guide (How to Use)
### 👨‍🎓 For Students (Peserta Ujian)
 1. **Access the Portal:** Open your mobile or desktop browser and navigate to the official EduQuiz link provided by your teacher.
 2. **Enter Credentials:** Type your **Full Name** (use your official registration name) and the specific **Room ID** (e.g., AJGCZ2). Enter the password if required.
 3. **Wait in Lobby:** Click **"MASUK UJIAN"** to enter the live waiting lobby. Wait until your teacher officially starts the examination session.
 4. **Take the Quiz:** Answer the multiple-choice questions (A, B, C, D, or E) sequentially. If a question contains a diagram or chart, it will automatically load underneath the question text. Click **"SELANJUTNYA"** to lock your answer and proceed.
 5. **Temporary Leave:** Use the **"IZIN TOILET"** button if you need to step away. Your screen will be locked securely to prevent unauthorized access. Click **"SAYA SUDAH KEMBALI"** upon your return.
 6. **Submit:** On the final question, review your choices and click **"SELESAI UJIAN"** or **"SUBMIT"** to permanently upload your scores to the server.
### 👨‍🏫 For Teachers / Admins (Pengelola Ujian)
 1. **Generate the Packet:** Request your AI assistant (Claude) to generate a package of multiple-choice questions with dynamic image elements, and download the raw output as a .zip file.
 2. **Extract the Files:** Extract the downloaded .zip packet onto your computer. Ensure it contains the main soal.json file and all corresponding image assets (.jpg/.png).
 3. **Run the Media Converter:** * Copy the converter.exe (or converter.py) tool into the exact same folder where soal.json resides.
   * Double-click converter.exe to execute the data formatting script.
   * *Note: The file size of soal.json will increase significantly as binary images are successfully converted into embedded image_base64 text strings.*
 4. **Recompress the Package:** Select the updated soal.json, all image files, and the discussion keys (if available). **Do not** include the converter.exe tool to save file space. Compress them back into a clean .zip file (e.g., Final_Exam_Package.zip).
 5. **Upload & Publish:** Log into the EduQuiz Teacher/Admin dashboard, enter or generate your targeted **Room ID**, drag-and-drop your newly created .zip file into the upload zone, and click **"UPLOAD & PUBLISH"**.
 6. **Live Monitoring:** Share the active Room ID with your students and use the live admin dashboard to monitor user attendance, session clocks, and incoming grade metrics in real time.
## 📄 License
This software ecosystem is privately developed for academic and examination hosting optimization. All rights reserved.
