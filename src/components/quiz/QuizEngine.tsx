'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from '@/firebase';
import { ref, update as dbUpdate, onValue, get } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronRight, Loader2, User, ChevronLeft, HelpCircle,
  Download, FileText, Globe, Clock, Lock, ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import html2canvas from 'html2canvas';
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface QuizEngineProps {
  roomId: string;
  submissionId: string;
  studentName: string;
  durationMinutes: number;
  quizTitle: string;
}

export function QuizEngine({ roomId, submissionId, studentName, durationMinutes, quizTitle }: QuizEngineProps) {
  const db = useDatabase();
  const { toast } = useToast();
  const certRef = useRef<HTMLDivElement>(null);
  
  const [state, setState] = useState<'quiz' | 'summary'>('quiz');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [isToiletMode, setIsToiletMode] = useState(false);
  const [isCheatLocked, setIsCheatLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [results, setResults] = useState<any>(null);
  const [violations, setViolations] = useState(0);
  
  const [roomData, setRoomData] = useState<any>(null);
  const [isExamMode, setIsExamMode] = useState(true);

  const finalRoomId = roomId.toUpperCase();

  const fetchData = useCallback(async () => {
    if (!db || !finalRoomId) return;
    const snap = await get(ref(db, `rooms/${finalRoomId}`));
    if (snap.exists()) {
      const data = snap.val();
      setRoomData(data);
      setIsExamMode(data.settings?.isExamMode ?? true);
      const rawQs = Array.isArray(data.questions) ? data.questions : Object.values(data.questions || {});
      const normalizedQs = rawQs.map((q: any) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : Object.values(q.options || {})
      }));
      setQuestions(normalizedQs);
      if (answers.length === 0) setAnswers(new Array(normalizedQs.length).fill(null));
    }
  }, [db, finalRoomId, answers.length]);

  // SINKRONISASI REALTIME & REFRESH TRIGGER
  useEffect(() => {
    if (!db || !finalRoomId) return;
    const unsub = onValue(ref(db, `rooms/${finalRoomId}`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomData(data);
        setIsExamMode(data.settings?.isExamMode ?? true);
        fetchData();
      }
    });
    return () => unsub();
  }, [db, finalRoomId, fetchData]);

  // TIMER LOGIC (WITH TOILET & CHEAT FREEZE)
  useEffect(() => {
    if (state !== 'quiz' || timeLeft <= 0 || isToiletMode || isCheatLocked) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSelesaikan();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state, isToiletMode, isCheatLocked, timeLeft]);

  // ANTI-CHEAT (TAB VISIBILITY)
  useEffect(() => {
    if (state !== 'quiz' || isToiletMode || isCheatLocked || !isExamMode) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const newV = violations + 1;
        setViolations(newV);
        setIsCheatLocked(true);
        if (db) {
          dbUpdate(ref(db, `rooms/${finalRoomId}/submissions/${submissionId}`), { violations: newV });
        }
        toast({ 
          variant: "destructive", 
          title: "PELANGGARAN TERDETEKSI!", 
          description: "Ujian Anda dikunci. Segera minta password pembuka ke operator." 
        });
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    return () => window.removeEventListener('visibilitychange', handleVisibility);
  }, [state, isToiletMode, isCheatLocked, violations, db, finalRoomId, submissionId, isExamMode, toast]);

  const handleUnlock = () => {
    const correctPass = roomData?.settings?.passwordPembuka || '';
    if (unlockPassword.trim().toUpperCase() === correctPass.trim().toUpperCase()) {
      setIsCheatLocked(false);
      setUnlockPassword('');
      toast({ title: "Ujian Terbuka", description: "Lanjutkan pengerjaan dengan jujur!" });
    } else {
      toast({ variant: "destructive", title: "Password Salah!", description: "Minta password yang benar ke operator." });
    }
  };

  const handleSelectOption = (idx: number) => {
    const newA = [...answers];
    newA[currentIdx] = idx;
    setAnswers(newA);
    if (db) {
      dbUpdate(ref(db, `rooms/${finalRoomId}/submissions/${submissionId}`), {
        [`answers/${currentIdx}`]: idx,
        currentIdx: currentIdx,
        timestamp: Date.now()
      });
    }
  };

  const handleSelesaikan = () => {
    let score = 0;
    questions.forEach((q, i) => {
      const correct = q.correctAnswerIndex ?? 0;
      if (answers[i] === correct) score++;
    });
    const res = { score, total: questions.length, percent: Math.round((score / (questions.length || 1)) * 100) };
    setResults(res);
    setState('summary');
    if (db) {
      dbUpdate(ref(db, `rooms/${finalRoomId}/submissions/${submissionId}`), {
        score: res.score,
        isFinished: true,
        status: 'Selesai'
      });
    }
  };

  const downloadPDFPembahasan = () => {
    if (!roomData?.pdf_pembahasan_base64) return toast({ variant: "destructive", title: "PDF belum siap!" });
    const link = document.createElement('a');
    link.href = roomData.pdf_pembahasan_base64;
    link.download = `Pembahasan_${quizTitle.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCertificate = async () => {
    if (!certRef.current) return;
    try {
      const canvas = await html2canvas(certRef.current, { scale: 2 });
      const link = document.createElement('a');
      link.download = `Sertifikat_${studentName}_EduQuiz.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch (e) { console.error(e); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (state === 'summary' && results) {
    return (
      <div className="container mx-auto p-4 max-w-3xl py-12 space-y-8 animate-in fade-in duration-700">
        <div ref={certRef} className="bg-white p-12 border-[12px] border-primary rounded-3xl text-center shadow-2xl text-black relative">
          <Badge className="absolute top-4 right-4 bg-primary text-white">HASIL RESMI</Badge>
          <CardTitle className="text-3xl font-black text-primary mb-4 uppercase">EduQuiz Exam System</CardTitle>
          <div className="h-1 bg-primary/20 w-40 mx-auto mb-8" />
          <p className="text-lg italic mb-1">Diberikan kepada:</p>
          <h2 className="text-4xl font-black mb-8 underline decoration-primary/20">{studentName}</h2>
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="p-4 bg-muted/30 rounded-2xl"><p className="text-xs font-bold uppercase">Benar</p><p className="text-3xl font-black">{results.score}</p></div>
            <div className="p-4 bg-muted/30 rounded-2xl"><p className="text-xs font-bold uppercase">Salah</p><p className="text-3xl font-black">{results.total - results.score}</p></div>
            <div className="p-4 bg-primary text-primary-foreground rounded-2xl shadow-xl"><p className="text-xs font-bold uppercase opacity-70">Nilai</p><p className="text-3xl font-black">{results.percent}</p></div>
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{quizTitle} • {new Date().toLocaleDateString('id-ID')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button className="h-14 rounded-xl font-black text-lg bg-blue-700" onClick={downloadCertificate}><Download className="mr-2 h-5 w-5" /> UNDUH SERTIFIKAT JPG</Button>
          <Button variant="secondary" className="h-14 rounded-xl font-black text-lg" disabled={isExamMode || !roomData?.pdf_pembahasan_base64} onClick={downloadPDFPembahasan}>
            {isExamMode ? <Lock className="mr-2 h-5 w-5" /> : <FileText className="mr-2 h-5 w-5" />}
            {isExamMode ? "PEMBAHASAN DIKUNCI" : "UNDUH PEMBAHASAN PDF"}
          </Button>
        </div>
        {isExamMode && <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">Tombol pembahasan akan aktif otomatis jika operator mematikan Mode Anti-Cheat.</div>}
        <Button variant="ghost" className="w-full h-14 font-bold" onClick={() => window.location.reload()}>Keluar</Button>
      </div>
    );
  }

  const currentSoal = questions[currentIdx];
  const prog = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0;
  const unansweredCount = answers.filter(a => a === null).length;

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6 pb-20 select-none">
      {/* OVERLAY CHEAT LOCK */}
      {isCheatLocked && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
          <ShieldAlert className="h-20 w-20 text-destructive animate-bounce mb-6" />
          <h2 className="text-4xl font-black text-white mb-2 uppercase">UJIAN TERKUNCI!</h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-md">Anda terdeteksi melakukan pelanggaran (pindah tab/blur). Minta password pembuka ke operator untuk melanjutkan.</p>
          <div className="w-full max-w-sm space-y-4">
            <Input 
              placeholder="Masukkan Password Pembuka" 
              className="h-14 text-center text-xl font-black uppercase" 
              value={unlockPassword}
              onChange={e => setUnlockPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            />
            <Button className="w-full h-14 text-lg font-black bg-destructive" onClick={handleUnlock}>BUKA KUNCI</Button>
          </div>
        </div>
      )}

      {/* OVERLAY TOILET */}
      {isToiletMode && !isCheatLocked && (
        <div className="fixed inset-0 z-[999] bg-black/90 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
          <Clock className="h-20 w-20 text-primary animate-pulse mb-6" />
          <h2 className="text-4xl font-black text-white mb-2 uppercase">Izin Toilet</h2>
          <p className="text-muted-foreground text-lg mb-10">Waktu ujian sedang di-FREEZE.</p>
          <Button size="lg" className="h-16 px-10 text-xl font-black" onClick={() => setIsToiletMode(false)}>SAYA SUDAH KEMBALI</Button>
        </div>
      )}

      <div className="flex items-center justify-between bg-card/80 p-4 rounded-2xl shadow-xl border sticky top-4 z-50 backdrop-blur-md">
        <div className="flex gap-2">
          <Badge className="px-4 py-2 font-black bg-primary"><User className="h-4 w-4 mr-2" /> {studentName}</Badge>
          <Button variant="outline" size="sm" className="font-bold border-2" onClick={() => setIsToiletMode(true)}>Izin Toilet</Button>
        </div>
        <div className="flex items-center gap-4">
          <div className={cn("text-xl font-black flex items-center gap-2", timeLeft < 300 ? "text-destructive animate-pulse" : "text-primary")}>
            <Clock className="h-5 w-5" /> {formatTime(timeLeft)}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="font-bold"><Globe className="h-4 w-4 mr-1" /> DAFTAR SOAL</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-2xl rounded-3xl">
              <AlertDialogHeader><AlertDialogTitle className="text-center font-black uppercase">Navigasi Nomor</AlertDialogTitle></AlertDialogHeader>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-3 py-6">
                {questions.map((_, i) => (
                  <Button key={i} variant={currentIdx === i ? 'default' : answers[i] !== null ? 'secondary' : 'outline'} className={cn("h-12 w-12 font-black rounded-xl", flagged[i] && "bg-amber-400 text-amber-950 border-amber-500")} onClick={() => setCurrentIdx(i)}>{i + 1}</Button>
                ))}
              </div>
              <AlertDialogFooter><AlertDialogCancel className="font-bold">Tutup</AlertDialogCancel></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Progress value={prog} className="h-3 rounded-full" />

      <Card className="p-8 shadow-2xl border-t-8 border-primary rounded-3xl bg-card">
        {currentSoal?.image_base64 && (
          <div className="mb-6 bg-muted/20 p-4 rounded-2xl flex justify-center border-2 border-dashed">
            <img src={currentSoal.image_base64} alt="Visual" className="max-h-[350px] w-auto rounded-lg shadow-lg" />
          </div>
        )}
        <h2 className="text-2xl font-bold leading-tight text-center whitespace-pre-wrap">{currentSoal?.soal || currentSoal?.questionText}</h2>
      </Card>

      <div className="grid gap-3">
        {(currentSoal?.options || []).map((opt: string, idx: number) => (
          <button key={idx} onClick={() => handleSelectOption(idx)} className={cn(
            "p-6 text-left border-2 rounded-2xl transition-all flex items-center gap-4 group",
            answers[currentIdx] === idx ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/30 bg-card"
          )}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg", answers[currentIdx] === idx ? "bg-primary text-white" : "bg-muted group-hover:bg-primary/10")}>{String.fromCharCode(65 + idx)}</div>
            <span className="font-bold text-lg">{opt}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center pt-8">
        <Button variant="ghost" onClick={() => setCurrentIdx(p => Math.max(0, p - 1))} disabled={currentIdx === 0} className="font-bold h-12"><ChevronLeft className="mr-2" /> KEMBALI</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFlagged(f => ({...f, [currentIdx]: !f[currentIdx]}))} className={cn("font-bold h-12 px-6", flagged[currentIdx] && "bg-amber-400 text-amber-950")}>
            <HelpCircle className="h-5 w-5 mr-2" /> {flagged[currentIdx] ? 'DITANDAI' : 'RAGU-RAGU'}
          </Button>
          {currentIdx === questions.length - 1 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button className="bg-green-600 px-10 h-12 text-lg font-black">SELESAI</Button></AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-black uppercase text-green-700">Kirim Jawaban?</AlertDialogTitle>
                  <AlertDialogDescription className="text-lg">
                    {unansweredCount > 0 ? (
                      <span className="text-destructive font-bold">Waduh coeg, masih ada {unansweredCount} soal yang belum dijawab! Yakin ingin submit sekarang?</span>
                    ) : "Sistem akan mencatat nilai Anda. Pastikan semua soal telah diperiksa."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel className="font-bold">Batal</AlertDialogCancel><AlertDialogAction onClick={handleSelesaikan} className="bg-green-600 font-bold">Ya, Kirim</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <Button onClick={() => setCurrentIdx(p => p + 1)} className="px-10 h-12 font-black shadow-lg">LANJUT <ChevronRight className="ml-2" /></Button>}
        </div>
      </div>
    </div>
  );
}