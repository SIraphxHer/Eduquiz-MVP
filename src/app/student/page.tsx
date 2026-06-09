'use client';

import React, { useState, useEffect } from 'react';
import { useDatabase } from '@/firebase';
import { ref, get, update, onValue } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, AlertCircle, Eye, EyeOff, Clock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { QuizEngine } from '@/components/quiz/QuizEngine';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function StudentLoginPage() {
  const db = useDatabase();
  const { toast } = useToast();
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [roomStatus, setRoomStatus] = useState<'idle' | 'started' | 'closed'>('idle');
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !quizData?.roomId) return;
    const unsub = onValue(ref(db, `rooms/${quizData.roomId}/status`), (snap) => {
      setRoomStatus(snap.val() || 'idle');
    });
    return () => unsub();
  }, [db, quizData]);

  const joinRoom = async () => {
    const finalRoomId = roomId.toString().toUpperCase().trim();
    const inputPass = password.trim();
    const name = studentName.trim();

    if (!db || !finalRoomId || !inputPass || !name) {
      return toast({ variant: "destructive", title: "Lengkapi Data" });
    }
    
    setLoading(true);
    try {
      const snap = await get(ref(db, `rooms/${finalRoomId}`));
      if (!snap.exists()) throw new Error("ID Room tidak ditemukan.");
      
      const data = snap.val();
      const dbPass = data.password ? data.password.toString().trim() : '';
      
      if (dbPass !== inputPass) throw new Error("Password ruangan salah.");
      if (!data.questions) throw new Error("Paket soal belum diupload oleh operator.");

      const subId = `${name.replace(/\s+/g, '_')}_${Date.now()}`;
      setSubmissionId(subId);
      
      await update(ref(db, `rooms/${finalRoomId}/submissions/${subId}`), {
        studentName: name, 
        currentIdx: 0, 
        isFinished: false, 
        timestamp: Date.now(),
        violations: 0,
        totalQuestions: Array.isArray(data.questions) ? data.questions.length : 0
      });

      setRoomStatus(data.status || 'idle');
      setQuizData({ 
        roomId: finalRoomId, 
        quizTitle: data.quizTitle,
        questions: data.questions,
        duration: data.duration || 60,
        studentName: name 
      });
      
      toast({ title: "Berhasil Bergabung" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.message });
    } finally { setLoading(false); }
  };

  if (quizData && roomStatus !== 'started') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full shadow-2xl border-t-8 border-primary p-8 space-y-6">
          <Clock className="h-16 w-16 text-primary animate-pulse mx-auto" />
          <CardTitle className="text-2xl font-black">RUANG TUNGGU</CardTitle>
          <CardDescription className="text-lg">
            Sesi <strong>{quizData.quizTitle}</strong> sedang dipersiapkan. <br />
            Menunggu operator memulai ujian...
          </CardDescription>
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
          <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>Keluar</Button>
        </Card>
      </div>
    );
  }

  if (quizData && roomStatus === 'started') {
    return (
      <QuizEngine 
        roomId={quizData.roomId} 
        quizTitle={quizData.quizTitle}
        submissionId={submissionId || ''}
        studentName={quizData.studentName}
        durationMinutes={quizData.duration}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md shadow-2xl border-none">
        <div className="h-2 bg-primary rounded-t-lg" />
        <CardHeader className="text-center">
          <LogIn className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle className="uppercase font-black">Lobby Siswa</CardTitle>
          <CardDescription>Masukkan kredensial ujian Anda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Room ID</Label>
            <Input value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())} className="text-center font-bold tracking-widest h-12" />
          </div>
          <div className="space-y-2 relative">
            <Label>Password</Label>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="text-center h-12" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nama Lengkap</Label>
            <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Budi Santoso" className="h-12" />
          </div>
          <Button className="w-full h-14 text-lg font-black shadow-xl" onClick={joinRoom} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "MASUK UJIAN"}
          </Button>
          <Link href="/" className="block text-center mt-2"><Button variant="link">Kembali</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
