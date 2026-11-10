'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, useDatabase } from '@/firebase';
import { ref, get, set, update, onValue } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Eye, EyeOff, Clock, Lock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { QuizEngine, type QuizResume } from '@/components/quiz/QuizEngine';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { normalizeAnswers } from '@/lib/asset-key';

interface QuizSession {
  roomId: string;
  quizTitle: string;
  duration: number;
  studentName: string;
  uid: string;
  resume?: QuizResume;
}

export default function StudentLoginPage() {
  const auth = useAuth();
  const db = useDatabase();
  const { toast } = useToast();
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [roomStatus, setRoomStatus] = useState<'idle' | 'started' | 'closed'>('idle');
  const [engineActive, setEngineActive] = useState(false);

  // Status room (ruang tunggu -> ujian dimulai)
  useEffect(() => {
    if (!db || !session) return;
    const unsub = onValue(ref(db, `rooms/${session.roomId}/meta/status`), (snap) => {
      setRoomStatus(snap.val() || 'idle');
    });
    return () => unsub();
  }, [db, session]);

  // Begitu ujian dimulai, mesin kuis tetap tampil walaupun operator menutup ujian di tengah jalan
  useEffect(() => {
    if (session && roomStatus === 'started') setEngineActive(true);
  }, [session, roomStatus]);

  const joinRoom = async () => {
    const finalRoomId = roomId.toString().toUpperCase().trim();
    const inputPass = password.trim();
    const name = studentName.trim();

    if (!db || !auth || !finalRoomId || !inputPass || !name) {
      return toast({ variant: "destructive", title: "Lengkapi Data" });
    }

    setLoading(true);
    try {
      await auth.authStateReady();
      const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
      const uid = user.uid;

      // Bukti tahu password: Rules membandingkan dengan password di server, password tidak pernah dikirim ke klien.
      try {
        await set(ref(db, `rooms/${finalRoomId}/members/${uid}`), { name, pw: inputPass });
      } catch {
        throw new Error("Room ID atau password salah, atau soal belum diupload operator.");
      }

      const metaSnap = await get(ref(db, `rooms/${finalRoomId}/meta`));
      if (!metaSnap.exists()) throw new Error("Paket soal belum diupload oleh operator.");
      const meta = metaSnap.val();
      const total = Number(meta.totalQuestions) || 0;

      const subRef = ref(db, `rooms/${finalRoomId}/submissions/${uid}`);
      const subSnap = await get(subRef);
      let resume: QuizResume | undefined;

      if (subSnap.exists()) {
        const s = subSnap.val();
        if (s.isFinished) throw new Error("Kamu sudah menyelesaikan ujian ini.");
        resume = {
          answers: normalizeAnswers(s.answers, total),
          currentIdx: typeof s.currentIdx === 'number' ? s.currentIdx : 0,
          timeLeft: typeof s.timeLeft === 'number' ? s.timeLeft : undefined,
          violations: typeof s.violations === 'number' ? s.violations : 0,
          isLocked: s.isLocked === true,
        };
        await update(subRef, { studentName: name, timestamp: Date.now() });
      } else {
        await update(subRef, {
          studentName: name,
          currentIdx: 0,
          isFinished: false,
          timestamp: Date.now(),
          violations: 0,
          totalQuestions: total,
        });
      }

      setRoomStatus(meta.status || 'idle');
      setSession({
        roomId: finalRoomId,
        quizTitle: meta.quizTitle,
        duration: meta.duration || 60,
        studentName: name,
        uid,
        resume,
      });

      toast({ title: resume ? "Berhasil Bergabung Kembali" : "Berhasil Bergabung" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.message });
    } finally { setLoading(false); }
  };

  if (session && engineActive) {
    return (
      <QuizEngine
        roomId={session.roomId}
        quizTitle={session.quizTitle}
        submissionId={session.uid}
        studentName={session.studentName}
        durationMinutes={session.duration}
        resume={session.resume}
      />
    );
  }

  if (session && roomStatus === 'closed') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full shadow-2xl border-t-8 border-primary p-8 space-y-6">
          <Lock className="h-16 w-16 text-primary mx-auto" />
          <CardTitle className="text-2xl font-black">UJIAN DITUTUP</CardTitle>
          <CardDescription className="text-lg">
            Sesi <strong>{session.quizTitle}</strong> sudah ditutup oleh operator.
          </CardDescription>
          <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>Keluar</Button>
        </Card>
      </div>
    );
  }

  if (session) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full shadow-2xl border-t-8 border-primary p-8 space-y-6">
          <Clock className="h-16 w-16 text-primary animate-pulse mx-auto" />
          <CardTitle className="text-2xl font-black">RUANG TUNGGU</CardTitle>
          <CardDescription className="text-lg">
            Sesi <strong>{session.quizTitle}</strong> sedang dipersiapkan. <br />
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
