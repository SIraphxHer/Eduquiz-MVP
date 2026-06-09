'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '@/firebase';
import { ref, set as dbSet, onValue, update as dbUpdate, remove, get } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, Loader2, Play, Pause, Trash2, Key, ShieldCheck, 
  FileArchive, Zap, ShieldAlert, RefreshCw, Lock
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';

export default function OperatorPage() {
  const db = useDatabase();
  const { toast } = useToast();
  
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [correctPin, setCorrectPin] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [roomId, setRoomId] = useState('');
  const [quizTitle, setQuizTitle] = useState('Tryout EduQuiz 2026');
  const [password, setPassword] = useState('123456');
  const [passwordPembuka, setPasswordPembuka] = useState('BUKAPAS');
  const [duration, setDuration] = useState(60);
  const [isExamMode, setIsExamMode] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [roomStatus, setRoomStatus] = useState<'idle' | 'started' | 'closed'>('idle');

  // AUTO-CLEAN EXPIRED ROOMS (24 Hours)
  useEffect(() => {
    if (!db) return;
    const cleanupOldRooms = async () => {
      try {
        const roomsRef = ref(db, 'rooms');
        const snap = await get(roomsRef);
        if (snap.exists()) {
          const now = Date.now();
          const oneDay = 24 * 60 * 60 * 1000;
          const updates: any = {};
          Object.keys(snap.val()).forEach(id => {
            const room = snap.val()[id];
            if (room.createdAt && (now - room.createdAt > oneDay)) {
              updates[id] = null;
            }
          });
          if (Object.keys(updates).length > 0) await dbUpdate(roomsRef, updates);
        }
      } catch (e) { console.error("Cleanup failed:", e); }
    };
    cleanupOldRooms();
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const pinRef = ref(db, 'config/admin_settings/secret_code');
    const unsub = onValue(pinRef, (snapshot) => {
      if (snapshot.exists()) setCorrectPin(snapshot.val().toString());
      setIsAuthLoading(false);
    });
    return () => unsub();
  }, [db]);

  const handleVerify = () => {
    if (inputPin.trim() === correctPin?.trim()) {
      setIsAdminVerified(true);
      toast({ title: "Akses Diberikan" });
    } else {
      toast({ variant: "destructive", title: "Akses Ditolak", description: "PIN Salah." });
    }
  };

  const generateRandomId = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setRoomId(result);
  }, []);

  useEffect(() => { if (!isAdminVerified) generateRandomId(); }, [generateRandomId, isAdminVerified]);

  useEffect(() => {
    if (!db || !roomId || !isAdminVerified) return;
    const finalRoomId = roomId.toUpperCase();
    
    const unsubscribeRoom = onValue(ref(db, `rooms/${finalRoomId}`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomStatus(data.status || 'idle');
        setIsExamMode(data.settings?.isExamMode !== false); // Default true
        if (data.duration) setDuration(data.duration);
        if (data.settings?.passwordPembuka) setPasswordPembuka(data.settings.passwordPembuka);
      }
    });

    const unsubscribeSub = onValue(ref(db, `rooms/${finalRoomId}/submissions`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ ...data[key], id: key }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setSubmissions(list);
      } else setSubmissions([]);
    });

    return () => { unsubscribeRoom(); unsubscribeSub(); };
  }, [db, roomId, isAdminVerified]);

  const convertToWebPBase64 = (blobData: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blobData);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject("Context not found");
          ctx.drawImage(img, 0, 0, img.width, img.height);
          resolve(canvas.toDataURL('image/webp', 0.7));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    setIsCreating(true);
    const finalRoomId = roomId.toUpperCase();

    try {
      const zip = new JSZip();
      const zipData = await zip.loadAsync(file);
      
      const soalJsonFile = zipData.file("soal.json");
      if (!soalJsonFile) throw new Error("File soal.json tidak ditemukan.");

      const rawJson = await soalJsonFile.async("string");
      const quizData = JSON.parse(rawJson);
      let questions = Array.isArray(quizData.questions) ? quizData.questions : (Array.isArray(quizData) ? quizData : []);
      
      if (questions.length === 0) throw new Error("Data soal kosong.");

      // STEP 1: Langsung simpan data teks agar UI tidak hang
      await dbSet(ref(db, `rooms/${finalRoomId}`), {
        quizTitle,
        password: password.trim(),
        duration,
        questions: questions,
        createdAt: Date.now(),
        status: 'idle',
        settings: { 
          isExamMode, 
          passwordPembuka: passwordPembuka.trim(),
          lastRefreshed: Date.now()
        }
      });

      setIsCreating(false);
      toast({ title: "Teks Soal Berhasil", description: "Memproses aset biner di background..." });

      // STEP 2: Background worker untuk PDF & Gambar
      (async () => {
        try {
          const pdfBlob = await zipData.file("pembahasan.pdf")?.async("blob");
          const img1Blob = await zipData.file("grafik_fungsi.jpg")?.async("blob");
          const img2Blob = await zipData.file("diagram_kuis.jpg")?.async("blob");

          const updates: any = {};
          
          if (pdfBlob) {
            const pdfBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.readAsDataURL(pdfBlob);
              reader.onloadend = () => resolve(reader.result as string);
            });
            updates['pdf_pembahasan_base64'] = pdfBase64;
          }

          if (img1Blob || img2Blob) {
            const img1WebP = img1Blob ? await convertToWebPBase64(img1Blob) : null;
            const img2WebP = img2Blob ? await convertToWebPBase64(img2Blob) : null;

            const finalQuestions = questions.map((q: any) => {
              if (q.image_url === "grafik_fungsi.jpg" && img1WebP) return { ...q, image_base64: img1WebP };
              if (q.image_url === "diagram_kuis.jpg" && img2WebP) return { ...q, image_base64: img2WebP };
              return q;
            });
            updates['questions'] = finalQuestions;
          }

          if (Object.keys(updates).length > 0) {
            await dbUpdate(ref(db, `rooms/${finalRoomId}`), updates);
          }
        } catch (bgErr) {
          console.warn("Background asset error:", bgErr);
        }
      })();

    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
      setIsCreating(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const toggleRoomStatus = async () => {
    if (!db || !roomId) return;
    const nextStatus = roomStatus === 'started' ? 'closed' : 'started';
    await dbUpdate(ref(db, `rooms/${roomId.toUpperCase()}`), { status: nextStatus });
    toast({ title: nextStatus === 'started' ? "Ujian Dimulai!" : "Ujian Ditutup" });
  };

  const handleToggleExamMode = async (checked: boolean) => {
    setIsExamMode(checked);
    if (!db || !roomId) return;
    await dbUpdate(ref(db, `rooms/${roomId.toUpperCase()}/settings`), { isExamMode: checked });
  };

  const handlePasswordPembukaChange = async (val: string) => {
    const upperVal = val.toUpperCase();
    setPasswordPembuka(upperVal);
    if (!db || !roomId) return;
    await dbUpdate(ref(db, `rooms/${roomId.toUpperCase()}/settings`), { passwordPembuka: upperVal });
  };

  const triggerRefresh = async () => {
    if (!db || !roomId) return;
    const finalRoomId = roomId.toUpperCase();
    
    // FIX MUTLAK: Gunakan update() pada node settings agar TIDAK menimpa isExamMode atau passwordPembuka
    await dbUpdate(ref(db, `rooms/${finalRoomId}/settings`), { 
      lastRefreshed: Date.now() 
    });
    
    toast({ 
      title: "Sinkronisasi Realtime Terkirim", 
      description: "Koneksi siswa disegarkan tanpa mereset status sakelar." 
    });
  };

  const wipeData = async () => {
    if (!db || !roomId) return;
    setIsWiping(true);
    try {
      await remove(ref(db, `rooms/${roomId.toUpperCase()}`));
      toast({ title: "Room Dihapus" });
      setSubmissions([]);
      generateRandomId();
    } catch (e) { console.error(e); } finally { setIsWiping(false); }
  };

  if (!isAdminVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-t-8 border-primary">
          <CardHeader className="text-center">
            <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="uppercase font-black">Admin Dashboard</CardTitle>
            <CardDescription>Masukkan kode rahasia operator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              type="password" 
              placeholder="Kode PIN" 
              className="text-center h-12 text-xl" 
              value={inputPin} 
              onChange={e => setInputPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
            <Button className="w-full h-12 font-bold" onClick={handleVerify} disabled={isAuthLoading}>
              {isAuthLoading ? <Loader2 className="animate-spin" /> : "MASUK DASHBOARD"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-8 py-10">
      <div className="flex items-center justify-between">
        <Link href="/"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" /> Keluar</Button></Link>
        <h1 className="text-2xl font-black text-primary flex items-center gap-2 uppercase">
          <ShieldAlert className="h-6 w-6" /> Operator Panel
        </h1>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={triggerRefresh}><RefreshCw className="h-4 w-4 mr-2" /> Sinkronkan Siswa</Button>
           <ThemeToggle />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="shadow-xl border-t-8 border-primary">
          <CardHeader><CardTitle>Setup Room</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-bold">Judul Kuis</Label>
              <Input value={quizTitle} onChange={e => setQuizTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">Room ID</Label>
                <Input value={roomId} readOnly className="font-bold text-center bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Password Room</Label>
                <Input value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-destructive flex items-center gap-2"><Lock className="h-4 w-4" /> Password Pembuka Anti-Cheat</Label>
              <Input 
                value={passwordPembuka} 
                onChange={e => handlePasswordPembukaChange(e.target.value)} 
                className="font-bold border-destructive uppercase" 
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Durasi Ujian (Menit)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl border">
              <Label className="font-bold">Mode Anti-Cheat</Label>
              <Switch checked={isExamMode} onCheckedChange={handleToggleExamMode} />
            </div>
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><FileArchive className="h-4 w-4" /> Upload Soal (.zip)</Label>
              <Input type="file" accept=".zip" onChange={handleZipUpload} disabled={isCreating} />
              {isCreating && <div className="text-primary font-bold flex items-center gap-2 text-sm"><Loader2 className="animate-spin h-3 w-3" /> Memproses Data...</div>}
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <Button 
                variant={roomStatus === 'started' ? "destructive" : "default"} 
                className="w-full font-black h-12"
                onClick={toggleRoomStatus}
              >
                {roomStatus === 'started' ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                {roomStatus === 'started' ? "TUTUP UJIAN" : "MULAI UJIAN (PUBLISH)"}
              </Button>
              <Button variant="outline" className="text-destructive font-bold" onClick={wipeData} disabled={isWiping}>
                <Trash2 className="mr-2 h-4 w-4" /> Hapus Ruangan
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="uppercase font-black text-primary">Live Peserta</CardTitle>
            <Badge variant="secondary">{submissions.length} Orang</Badge>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl italic">Belum ada peserta bergabung.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Cheat</TableHead>
                    <TableHead>Skor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((s, i) => (
                    <TableRow key={i} className={cn(s.violations > 0 && "bg-destructive/5")}>
                      <TableCell className="font-bold">{s.studentName}</TableCell>
                      <TableCell>{s.violations > 0 ? <Badge variant="destructive" className="animate-pulse">{s.violations}</Badge> : '-'}</TableCell>
                      <TableCell>{s.isFinished ? <Badge className="bg-green-600 font-bold">{s.score}</Badge> : <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}</TableCell>
                      <TableCell><Badge variant={s.isFinished ? 'default' : 'secondary'}>{s.isFinished ? 'Selesai' : 'Mengerjakan'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
