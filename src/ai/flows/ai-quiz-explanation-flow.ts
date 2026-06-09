'use server';
/**
 * @fileOverview AI Quiz Explanation Flow (Premium Educational Edition).
 * Optimasi: Database Caching (Anti-Boncos) & Struktur Analisis Mendalam (LaTeX Ready).
 * Persona: Tutor Bimbel Pakar UTBK yang seru dan detail.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase';
import { ref, get, set, update } from 'firebase/database';
import { googleAI } from '@genkit-ai/google-genai';

const QuizExplanationInputSchema = z.object({
  roomId: z.string(),
  submissionId: z.string(),
  userAnswers: z.array(z.number()),
});

const QuestionExplanationSchema = z.object({
  questionId: z.string().describe('ID soal sebagai identitas unik'),
  explanation: z.string().describe('Analisis mendalam dalam format Markdown dan LaTeX'),
});

const QuizOutputSchema = z.object({
  score: z.number(),
  totalQuestions: z.number(),
  wrongExplanations: z.array(QuestionExplanationSchema),
});

/**
 * Prompt AI Premium: Menghasilkan pembahasan bergaya Tutor Bimbel dengan LaTeX.
 */
const explanationPrompt = ai.definePrompt({
  name: 'explanationPrompt',
  model: googleAI.model('gemini-1.5-flash'),
  input: {
    schema: z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctAnswerIndex: z.number(),
    }),
  },
  output: {
    schema: z.object({
      explanation: z.string().describe('Analisis detail terstruktur menggunakan Markdown dan LaTeX.'),
    }),
  },
  prompt: `Anda adalah **Tutor Bimbel Pakar UTBK yang seru, cerdas, dan sangat suportif**. 
Tugas Anda adalah menjelaskan penyelesaian soal secara logis dan mendidik.

Pertanyaan: "{{question}}"
Pilihan Jawaban:
{{#each options}}
- {{this}}
{{/each}}
Kunci Jawaban: "{{{lookup options correctAnswerIndex}}}"

**KETENTUAN WAJIB PEMBAHASAN:**
1. **DILARANG KERAS** menggunakan kalimat template kaku seperti "Konsep ini berkaitan dengan...", "Jawaban yang benar adalah...", atau "Silakan tinjau kembali...".
2. **FORMAT MATEMATIKA (LaTeX):** Gunakan $...$ untuk rumus inline dan $$...$$ untuk rumus block. Wajib jabarkan angka secara eksplisit (misal: perhitungan Kombinasi, Peluang, atau Aljabar).
3. Gunakan Bahasa Indonesia yang interaktif dan penuh semangat!
4. Gunakan struktur Markdown berikut secara **MUTLAK**:

### 💡 ANALISIS PAKAR AI

**Konsep Dasar & Rumus:**
[Jelaskan teori/rumus utama menggunakan LaTeX jika perlu. Misal: $P(A) = \frac{n(A)}{n(S)}$]

**Langkah Penyelesaian Ringkas:**
[Jabarkan angka step-by-step ke bawah. Gunakan **bold** pada hasil hitungan antara agar mudah dipahami.]

**Tips Kilat:**
[Berikan trik cepat atau kesimpulan agar siswa mudah mengingat pola soal sejenis.]`,
});

export async function processQuizResult(input: z.infer<typeof QuizExplanationInputSchema>): Promise<z.infer<typeof QuizOutputSchema>> {
  try {
    return await aiQuizFlow(input);
  } catch (error) {
    console.error("AI Flow Execution Error:", error);
    return {
      score: 0,
      totalQuestions: input.userAnswers?.length || 0,
      wrongExplanations: []
    };
  }
}

const aiQuizFlow = ai.defineFlow(
  {
    name: 'aiQuizFlow',
    inputSchema: QuizExplanationInputSchema,
    outputSchema: QuizOutputSchema,
  },
  async (input) => {
    const { database } = initializeFirebase();
    
    const roomRef = ref(database, `rooms/${input.roomId}`);
    const roomSnap = await get(roomRef);
    if (!roomSnap.exists()) throw new Error("Ruangan tidak ditemukan");
    
    const roomData = roomSnap.val();
    const questions = roomData.questions || [];
    
    let score = 0;
    const wrongExplanations: z.infer<typeof QuestionExplanationSchema>[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const userAnswer = input.userAnswers[i];
      const qId = String(question.id || i);

      // Normalisasi index jawaban benar
      let correctIdx = 0;
      if (typeof question.correctAnswerIndex === 'number') {
        correctIdx = question.correctAnswerIndex;
      } else if (typeof question.correctAnswer === 'number') {
        correctIdx = question.correctAnswer;
      } else if (typeof question.correctAnswer === 'string') {
        const mapping: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
        correctIdx = mapping[question.correctAnswer.toUpperCase()] || 0;
      }

      if (userAnswer === correctIdx) {
        score++;
      } else {
        // --- DATABASE CACHING LOGIC (TOKEN EFFICIENCY) ---
        const cacheRef = ref(database, `pembahasan_soal/${qId}`);
        const cacheSnap = await get(cacheRef);

        if (cacheSnap.exists() && String(cacheSnap.val()).length > 50) {
          wrongExplanations.push({
            questionId: qId,
            explanation: String(cacheSnap.val()),
          });
        } else {
          try {
            const { output } = await explanationPrompt({
              question: String(question.questionText),
              options: question.options,
              correctAnswerIndex: correctIdx,
            });

            const explanationText = output?.explanation;
            
            if (explanationText && explanationText.length > 20) {
              // Simpan hasil ke cache agar hemat token di masa depan
              await set(cacheRef, explanationText);
              wrongExplanations.push({
                questionId: qId,
                explanation: explanationText,
              });
            } else {
              throw new Error("Respons AI tidak valid");
            }
          } catch (aiErr) {
            console.error(`AI Analysis Failed for Q-${qId}:`, aiErr);
            wrongExplanations.push({
              questionId: qId,
              explanation: `### 💡 ANALISIS PAKAR AI\n\n**Konsep Dasar:** Analisis mendalam sedang disiapkan.\n\n**Langkah Penyelesaian:** Jawaban yang tepat adalah **${question.options[correctIdx]}**. Tetap semangat belajar!`,
            });
          }
        }
      }
    }

    // Update status pengerjaan siswa
    const submissionRef = ref(database, `rooms/${input.roomId}/submissions/${input.submissionId}`);
    await update(submissionRef, {
      score: score,
      isFinished: true,
      status: 'Selesai',
      timestamp: Date.now()
    });

    return {
      score,
      totalQuestions: questions.length,
      wrongExplanations,
    };
  }
);
