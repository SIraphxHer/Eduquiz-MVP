import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit Instance - Server Side Only
 * Menggunakan Gemini 1.5 Flash untuk stabilitas dan kecepatan maksimal.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model('gemini-1.5-flash'),
});
