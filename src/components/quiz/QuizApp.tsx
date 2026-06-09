"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockQuestions as defaultQuestions, Question } from '@/lib/mock-data';
import { ChevronRight, RotateCcw, Sparkles, CheckCircle2, Lightbulb, Target, Award, Loader2, User, Download, XCircle, Info } from 'lucide-react';
import { aiQuizExplanation, type AIQuizExplanationOutput } from '@/ai/flows/ai-quiz-explanation-flow';
import { QuestionImporter } from './QuestionImporter';
import { cn } from '@/lib/utils';

type QuizState = 'start' | 'quiz' | 'summary';

export function QuizApp() {
  const [state, setState] = useState<QuizState>('start');
  const [studentName, setStudentName] = useState('');
  const [questions, setQuestions] = useState<Question[]>(defaultQuestions);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(defaultQuestions.length).fill(null));
  const [explanations, setExplanations] = useState<AIQuizExplanationOutput | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startQuiz = () => {
    if (!studentName.trim()) {
      return alert("Silakan masukkan nama Anda sebelum memulai.");
    }
    setState('quiz');
    setCurrentQuestionIndex(0);
    setAnswers(new Array(questions.length).fill(null));
    setExplanations(null);
    setError(null);
  };

  const handleImportQuestions = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
    setAnswers(new Array(newQuestions.length).fill(null));
  };

  const handleSelectOption = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const calculateScore = () => {
    return answers.reduce((acc, curr, idx) => 
      curr === questions[idx]?.correctAnswerIndex ? acc + 1 : acc, 0
    );
  };

  const downloadResultsCSV = () => {
    const total = questions.length;
    const correct = calculateScore();
    const wrong = total - correct;
    const scoreVal = Math.round((correct / total) * 100);
    
    const headers = "Nama Siswa,Total Soal,Jawaban Benar,Jawaban Salah,Nilai Akhir\n";
    const row = `"${studentName}",${total},${correct},${wrong},${scoreVal}\n`;
    
    const blob = new Blob([headers + row], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `hasil_ujian_${studentName.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const finishQuiz = async () => {
    setState('summary');
    setIsExplaining(true);
    setError(null);

    try {
      const result = await aiQuizExplanation({
        questions: questions.map((q, idx) => ({
          questionText: q.questionText,
          options: q.options,
          correctAnswerIndex: q.correctAnswerIndex,
          userAnswerIndex: answers[idx]
        }))
      });
      setExplanations(result);
    } catch (err: any) {
      console.error("AI Error:", err);
      setError("Gagal memanggil AI untuk penjelasan detail.");
    } finally {
      setIsExplaining(false);
    }
  };

  const currentScore = calculateScore();

  if (state === 'start') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-12 animate-in fade-in zoom-in duration-500">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-primary tracking-tight">EduQuiz Exam System</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Sistem ujian mandiri dengan analisis cerdas dan laporan CSV.
          </p>
        </div>

        <div className="space-y-6 w-full max-w-md bg-white p-8 rounded-3xl shadow-sm border border-border/50">
          <div className="space-y-4 text-left">
            <Label htmlFor="name" className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Nama Siswa
            </Label>
            <Input 
              id="name" 
              placeholder="Masukkan nama lengkap..." 
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          
          <Button size="lg" onClick={startQuiz} className="w-full h-14 text-lg rounded-xl shadow-lg">
            Mulai Ujian
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">Konfigurasi Soal</span></div>
          </div>

          <QuestionImporter onImport={handleImportQuestions} />
        </div>
      </div>
    );
  }

  if (state === 'quiz') {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    
    return (
      <div className="w-full max-w-2xl mx-auto p-4 space-y-8 animate-in slide-in-from-right-8 duration-300">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="px-4 py-1 rounded-full flex items-center gap-2">
            <User className="h-3 w-3" /> {studentName}
          </Badge>
          <div className="text-right text-xs text-muted-foreground font-bold">
            SOAL {currentQuestionIndex + 1} / {questions.length}
          </div>
        </div>

        <div className="space-y-3">
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="border-none shadow-md bg-white">
          <CardContent className="pt-10 pb-10 px-8 text-center">
            <h2 className="text-2xl font-semibold leading-relaxed text-foreground">
              {currentQuestion.questionText}
            </h2>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = answers[currentQuestionIndex] === idx;
            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                className={cn(
                  "flex items-center p-5 text-left border-2 rounded-xl transition-all",
                  isSelected 
                    ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/10 shadow-sm' 
                    : 'border-input bg-card hover:border-primary/30'
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center mr-4 text-sm font-bold",
                  isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                )}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <span className="text-base font-medium">{option}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-6">
          <Button onClick={handleNext} disabled={answers[currentQuestionIndex] === null} className="w-full h-14 text-lg font-semibold rounded-xl">
            {currentQuestionIndex === questions.length - 1 ? 'Selesaikan Ujian' : 'Soal Berikutnya'}
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-8 animate-in slide-in-from-bottom-8 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Skor Card */}
        <Card className="md:col-span-1 border-none shadow-xl bg-white flex flex-col items-center justify-center p-8">
          <div className="relative w-40 h-40 flex items-center justify-center mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="12" className="text-muted/20" />
              <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray={440} strokeDashoffset={440 - (440 * currentScore / questions.length)} strokeLinecap="round" className="text-primary transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-primary">{currentScore}/{questions.length}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Benar</span>
            </div>
          </div>
          <p className="text-lg font-bold text-primary">{Math.round((currentScore/questions.length) * 100)}% Nilai</p>
          <p className="text-sm text-muted-foreground mt-2">{studentName}</p>
          
          <Button onClick={downloadResultsCSV} className="mt-6 w-full rounded-xl bg-green-600 hover:bg-green-700">
            <Download className="mr-2 h-4 w-4" /> Simpan CSV
          </Button>
        </Card>

        {/* AI Feedback Card */}
        <Card className="md:col-span-2 border-none shadow-xl bg-white p-8">
          {isExplaining ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-muted-foreground animate-pulse text-center">AI sedang menganalisis pola jawaban Anda...</p>
            </div>
          ) : explanations ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center space-x-2 text-primary">
                <Sparkles className="h-6 w-6" />
                <h3 className="text-2xl font-bold">Feedback AI</h3>
              </div>
              <div className="bg-primary/5 p-4 rounded-xl border-l-4 border-primary italic text-foreground">
                "{explanations.generalFeedback}"
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-green-600 font-bold text-sm uppercase"><Award className="h-4 w-4" /> Keunggulan</p>
                  <ul className="space-y-1">
                    {explanations.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center"><CheckCircle2 className="h-3 w-3 mr-2 text-green-500" /> {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-amber-600 font-bold text-sm uppercase"><Target className="h-4 w-4" /> Perlu Review</p>
                  <ul className="space-y-1">
                    {explanations.improvementAreas.map((ia, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center"><Lightbulb className="h-3 w-3 mr-2 text-amber-500" /> {ia}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-center">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={finishQuiz} className="mt-2">Coba Lagi</Button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground italic">
              Hasil analisis kuis muncul di sini.
            </div>
          )}
        </Card>
      </div>

      {/* Pembahasan Detail Section */}
      {explanations && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div className="flex items-center gap-3 border-b pb-4">
            <Info className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Pembahasan Soal</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {explanations.explanations.map((item, index) => (
              <Card key={index} className="border-none shadow-md overflow-hidden bg-white">
                <CardHeader className={cn(
                  "py-3 px-6 flex flex-row items-center justify-between",
                  item.isCorrect ? "bg-green-50" : "bg-red-50"
                )}>
                  <span className="font-bold text-sm text-muted-foreground">SOAL {index + 1}</span>
                  <div className="flex items-center gap-2">
                    {item.isCorrect ? (
                      <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> BENAR</Badge>
                    ) : (
                      <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> SALAH</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <p className="text-lg font-medium text-foreground leading-relaxed">
                    {item.questionText}
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Jawaban Anda</p>
                      <p className={cn(
                        "font-semibold",
                        item.isCorrect ? "text-green-700" : "text-red-700"
                      )}>
                        {item.userAnswerText || 'Tidak dijawab'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-[10px] font-bold text-primary/70 uppercase mb-1">Jawaban Benar</p>
                      <p className="font-semibold text-primary">
                        {item.correctAnswerText}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-dashed">
                    <div className="flex items-start gap-3">
                      <div className="bg-amber-100 p-2 rounded-lg mt-1">
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-700 uppercase">Analisis AI</p>
                        <p className="text-sm text-muted-foreground leading-relaxed italic">
                          {item.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-8 pb-16">
        <Button variant="outline" onClick={() => setState('start')} className="w-full max-w-xs h-14 rounded-xl text-lg font-semibold border-2 hover:bg-muted/50">
          <RotateCcw className="mr-2 h-5 w-5" /> Ujian Baru
        </Button>
      </div>
    </div>
  );
}
