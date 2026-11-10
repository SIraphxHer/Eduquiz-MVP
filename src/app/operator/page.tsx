'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, useDatabase } from '@/firebase';
import { ref, onValue, update as dbUpdate, get } from 'firebase/database';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Loader2, Play, Pause, Trash2, ShieldCheck,
  FileArchive, ShieldAlert, LockOpen
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import { assetKey, baseName } from '@/lib/asset-key';
import JSZip from 'jszip';

const MAX_IMG_WIDTH = 900;
const LETTERS: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

const randomString = (len: number, chars: string) => {
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => chars[n % chars.length]).join('');
};

const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Kecilkan (lebar maks 900px) lalu ubah ke WebP base64 supaya hemat kuota database. */
const imageBlobToWebP = async (blob: Blob): Promise<string> => {
  const src = await blobToDataURL(blob);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Gambar tidak bisa dibaca.'));
    i.src = src;
  });
  const scale = Math.min(1, MAX_IMG_WIDTH / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.7);
};

const getCorrectIndex = (q: any): number | null => {
  const a = q?.correctAnswerIndex;
  if (typeof a === 'number') return a;
  if (typeof a === 'string' && /^\d+$/.test(a.trim())) return parseInt(a.trim(), 10);
  const b = q?.correctAnswer;
  if (typeof b === 'number') return b;
  if (typeof b === 'string') {
    const k = b.trim().toUpperCase();
    if (k in LETTERS) return LETTERS[k];
  }
  return null;
};

export default function OperatorPage() {
  const auth = useAuth();
  const db = useDatabase();
  const { toast } = useToast();

  const [adminState, setAdminState] = useState<'loading' | 'login' | 'ok'>('loading');
  const [email, setEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [roomId, setRoomId] = useState('');
  const [quizTitle, setQuizTitle] = useState('Tryout EduQuiz 2026');
  const [password, setPassword] = useState('');
  const [duration, setDuration] = useState(60);
  const [isExamMode, setIsExamMode] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [assetStatus, setAssetStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [roomStatus, setRoomStatus] = useState<'idle' | 'started' | 'closed'>('idle');
  const [roomExists, setRoomExists] = useState(false);
  const [answerKey, setAnswerKey] = useState<number[] | null>(null);
  const [keyVersion, setKeyVersion] = useState(0);
  const gradingRef = useRef<Set<string>>(new Set());

  // ---- AUTH OPERATOR (email/password + daftar admins di database) ----
  useEffect(() => {
    if (!auth || !db) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) {
        setAdminState('login');
        return;
      }
      try {
        const snap = await get(ref(db, `admins/${u.uid}`));
        if (snap.val() === true) {
          setAdminState('ok');
        } else {
          setAdminState('login');
          await signOut(auth);
          toast({ variant: "destructive", title: "Bukan akun operator", description: "Akun ini belum terdaftar sebagai admin." });
        }
      } catch {
        setAdminState('login');
      }
    });
    return () => unsub();
  }, [auth, db, toast]);

  const handleLogin = async () => {
    if (!auth) return;
    if (!email.trim() || !loginPass) {
      return toast({ variant: "destructive", title: "Lengkapi email dan password" });
    }
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), loginPass);
    } catch {
      toast({ variant: "destructive", title: "Login gagal", description: "Email atau password salah." });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (auth) signOut(auth);
  };

  // ---- AUTO-CLEAN ROOM > 24 JAM (lewat roomIndex yang kecil, bukan membaca seluruh rooms) ----
  useEffect(() => {
    if (!db || adminState !== 'ok') return;
    const cleanupOldRooms = async () => {
      try {
        const snap = await get(ref(db, 'roomIndex'));
        if (!snap.exists()) return;
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const updates: Record<string, null> = {};
        const index = snap.val() as Record<string, number>;
        Object.keys(index).forEach(id => {
          if (typeof index[id] === 'number' && now - index[id] > oneDay) {
            updates[`rooms/${id}`] = null;
            updates[`roomAssets/${id}`] = null;
            updates[`roomIndex/${id}`] = null;
          }
        });
        if (Object.keys(updates).length > 0) await dbUpdate(ref(db), updates);
      } catch (e) { console.error("Cleanup failed:", e); }
    };
    cleanupOldRooms();
  }, [db, adminState]);

  const generateRandomId = useCallback(() => {
    setRoomId(randomString(6, 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'));
  }, []);

  useEffect(() => {
    generateRandomId();
    setPassword(randomString(6, '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'));
  }, [generateRandomId]);

  // ---- LISTENER ROOM (meta + submissions) ----
  useEffect(() => {
    if (!db || !roomId || adminState !== 'ok') return;
    const rid = roomId.toUpperCase();

    const unsubscribeMeta = onValue(ref(db, `rooms/${rid}/meta`), (snapshot) => {
      const m = snapshot.val();
      setRoomExists(!!m);
      if (m) {
        setRoomStatus(m.status || 'idle');
        setIsExamMode(m.settings?.isExamMode !== false);
        if (m.duration) setDuration(m.duration);
      } else {
        setRoomStatus('idle');
      }
    });

    const unsubscribeSub = onValue(ref(db, `rooms/${rid}/submissions`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ ...data[key], id: key }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setSubmissions(list);
      } else setSubmissions([]);
    });

    return () => { unsubscribeMeta(); unsubscribeSub(); };
  }, [db, roomId, adminState]);

  // ---- KUNCI JAWABAN (hanya admin yang bisa membaca) ----
  useEffect(() => {
    if (!db || adminState !== 'ok' || !roomId || !roomExists) {
      setAnswerKey(null);
      return;
    }
    let cancelled = false;
    get(ref(db, `rooms/${roomId.toUpperCase()}/secret/key`))
      .then(snap => {
        if (cancelled) return;
        const v = snap.val();
        setAnswerKey(v ? ((Array.isArray(v) ? v : Object.values(v)) as number[]) : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [db, adminState, roomId, roomExists, keyVersion]);

  // ---- PENILAIAN OTOMATIS: dashboard operator menghitung skor siswa yang sudah selesai ----
  useEffect(() => {
    if (!db || !answerKey || !roomId) return;
    const rid = roomId.toUpperCase();
    submissions.forEach(s => {
      const gKey = `${rid}/${s.id}`;
      if (!s.isFinished || typeof s.score === 'number' || gradingRef.current.has(gKey)) return;
      gradingRef.current.add(gKey);
      const a = s.answers || {};
      let score = 0;
      answerKey.forEach((k, i) => { if (a[i] === k) score++; });
      dbUpdate(ref(db, `rooms/${rid}/submissions/${s.id}`), { score, totalQuestions: answerKey.length })
        .catch(() => gradingRef.current.delete(gKey));
    });
  }, [db, submissions, answerKey, roomId]);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file || !db) return;

    if (!password.trim()) {
      toast({ variant: "destructive", title: "Password Room wajib diisi" });
      input.value = '';
      return;
    }

    setIsCreating(true);
    setAssetStatus('idle');
    const rid = roomId.toUpperCase();

    try {
      const zipData = await new JSZip().loadAsync(file);

      const soalJsonFile = zipData.file(/(^|\/)soal\.json$/i)[0];
      if (!soalJsonFile) throw new Error("File soal.json tidak ditemukan.");

      const quizData = JSON.parse(await soalJsonFile.async("string"));
      const rawQuestions: any[] = Array.isArray(quizData.questions)
        ? quizData.questions
        : (Array.isArray(quizData) ? quizData : []);
      if (rawQuestions.length === 0) throw new Error("Data soal kosong.");

      // Semua gambar di zip, dicari berdasarkan nama file (tanpa folder, tidak peka huruf besar/kecil)
      const zipImages = new Map<string, JSZip.JSZipObject>();
      Object.values(zipData.files).forEach(f => {
        if (!f.dir && /\.(jpe?g|png|webp|gif)$/i.test(f.name)) {
          zipImages.set(baseName(f.name).toLowerCase(), f);
        }
      });

      const imageSources = new Map<string, () => Promise<Blob>>();
      const missingImages: string[] = [];
      const questions: any[] = [];
      const key: number[] = [];

      rawQuestions.forEach((q, i) => {
        const options: string[] = Array.isArray(q.options)
          ? q.options.map(String)
          : Object.values(q.options || {}).map(String);
        const correct = getCorrectIndex(q);
        if (correct === null) throw new Error(`Soal nomor ${i + 1} tidak punya kunci jawaban.`);
        if (correct < 0 || correct >= options.length) {
          throw new Error(`Kunci jawaban soal nomor ${i + 1} di luar jumlah pilihan.`);
        }

        // Hanya field yang dibutuhkan siswa. Kunci jawaban & pembahasan tidak ikut.
        const item: any = {
          id: String(q.id ?? `q${i + 1}`),
          questionText: String(q.questionText ?? q.soal ?? ''),
          options,
        };

        if (typeof q.image_base64 === 'string' && q.image_base64.startsWith('data:')) {
          const k = `q${i + 1}_inline`;
          imageSources.set(k, async () => (await fetch(q.image_base64)).blob());
          item.imageKey = k;
        } else if (q.image_url) {
          const f = zipImages.get(baseName(String(q.image_url)).toLowerCase());
          if (f) {
            const k = assetKey(String(q.image_url));
            imageSources.set(k, () => f.async('blob'));
            item.imageKey = k;
          } else {
            missingImages.push(String(q.image_url));
          }
        }

        questions.push(item);
        key.push(correct);
      });

      const pdfFile = zipData.file(/(^|\/)pembahasan\.pdf$/i)[0];
      const now = Date.now();
      const safeDuration = Math.max(1, Number(duration) || 60);

      // STEP 1: bersihkan room lama, lalu tulis teks soal + kunci (terpisah) dalam satu update
      await dbUpdate(ref(db), {
        [`rooms/${rid}`]: null,
        [`roomAssets/${rid}`]: null,
        [`roomIndex/${rid}`]: null,
      });
      await dbUpdate(ref(db), {
        [`rooms/${rid}/meta`]: {
          quizTitle: quizTitle.trim() || 'Tryout EduQuiz',
          duration: safeDuration,
          createdAt: now,
          status: 'idle',
          totalQuestions: questions.length,
          hasPdf: !!pdfFile,
          settings: { isExamMode },
        },
        [`rooms/${rid}/questions`]: questions,
        [`rooms/${rid}/secret`]: { password: password.trim(), key },
        [`roomIndex/${rid}`]: now,
      });

      setKeyVersion(v => v + 1);
      setIsCreating(false);
      toast({ title: "Teks Soal Berhasil", description: "Memproses gambar & PDF di background..." });
      if (missingImages.length > 0) {
        toast({
          variant: "destructive",
          title: "Sebagian gambar tidak ada di zip",
          description: Array.from(new Set(missingImages)).join(', '),
        });
      }

      // STEP 2: gambar -> roomAssets (dimuat per soal), PDF -> rooms/{id}/review/pdf
      setAssetStatus('processing');
      (async () => {
        try {
          const updates: Record<string, string> = {};
          for (const [k, load] of imageSources) {
            updates[`roomAssets/${rid}/${k}`] = await imageBlobToWebP(await load());
          }
          if (Object.keys(updates).length > 0) await dbUpdate(ref(db), updates);

          if (pdfFile) {
            const pdfBase64 = await blobToDataURL(await pdfFile.async('blob'));
            await dbUpdate(ref(db), { [`rooms/${rid}/review/pdf`]: pdfBase64 });
          }
          setAssetStatus('done');
          toast({ title: "Aset siap", description: `${imageSources.size} gambar${pdfFile ? ' + PDF pembahasan' : ''}.` });
        } catch (bgErr) {
          console.warn("Background asset error:", bgErr);
          setAssetStatus('error');
          dbUpdate(ref(db, `rooms/${rid}/meta`), { hasPdf: false }).catch(() => {});
          toast({ variant: "destructive", title: "Gagal memproses aset", description: "Upload ulang paket soal." });
        }
      })();

    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
      setIsCreating(false);
    } finally {
      input.value = '';
    }
  };

  const toggleRoomStatus = async () => {
    if (!db || !roomId || !roomExists) return;
    const nextStatus = roomStatus === 'started' ? 'closed' : 'started';
    try {
      await dbUpdate(ref(db, `rooms/${roomId.toUpperCase()}/meta`), { status: nextStatus });
      toast({ title: nextStatus === 'started' ? "Ujian Dimulai!" : "Ujian Ditutup" });
    } catch {
      toast({ variant: "destructive", title: "Gagal mengubah status ujian" });
    }
  };

  const handleToggleExamMode = async (checked: boolean) => {
    setIsExamMode(checked);
    if (!db || !roomId || !roomExists) return;
    try {
      await dbUpdate(ref(db, `rooms/${roomId.toUpperCase()}/meta/settings`), { isExamMode: checked });
    } catch {
      toast({ variant: "destructive", title: "Gagal menyimpan pengaturan" });
    }
  };

  const unlockStudent = async (id: string) => {
    if (!db || !roomId) return;
    try {
      await dbUpdate(ref(db, `rooms/${roomId.toUpperCase()}/submissions/${id}`), { isLocked: false });
      toast({ title: "Kunci siswa dibuka" });
    } catch {
      toast({ variant: "destructive", title: "Gagal membuka kunci" });
    }
  };

  const wipeData = async () => {
    if (!db || !roomId) return;
    setIsWiping(true);
    const rid = roomId.toUpperCase();
    try {
      await dbUpdate(ref(db), {
        [`rooms/${rid}`]: null,
        [`roomAssets/${rid}`]: null,
        [`roomIndex/${rid}`]: null,
      });
      toast({ title: "Room Dihapus" });
      setSubmissions([]);
      setAssetStatus('idle');
      generateRandomId();
    } catch (e) { console.error(e); } finally { setIsWiping(false); }
  };

  if (adminState !== 'ok') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-t-8 border-primary">
          <CardHeader className="text-center">
            <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="uppercase font-black">Admin Dashboard</CardTitle>
            <CardDescription>Masuk dengan akun operator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="email"
              placeholder="Email operator"
              className="h-12"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              className="h-12"
              value={loginPass}
              onChange={e => setLoginPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <Button className="w-full h-12 font-bold" onClick={handleLogin} disabled={adminState === 'loading' || isLoggingIn}>
              {adminState === 'loading' || isLoggingIn ? <Loader2 className="animate-spin" /> : "MASUK DASHBOARD"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-8 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" onClick={handleLogout}><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" /> Keluar</Button></Link>
        <h1 className="text-2xl font-black text-primary flex items-center gap-2 uppercase">
          <ShieldAlert className="h-6 w-6" /> Operator Panel
        </h1>
        <div className="flex items-center gap-2">
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
              <Label className="font-bold">Durasi Ujian (Menit)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 0)} />
            </div>
            <div className="p-4 bg-muted rounded-xl border space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-bold">Mode Anti-Cheat</Label>
                <Switch checked={isExamMode} onCheckedChange={handleToggleExamMode} />
              </div>
              <p className="text-xs text-muted-foreground">
                Siswa yang terkunci dibuka lewat tombol &quot;Buka Kunci&quot; di tabel peserta. Mematikan mode ini membuka unduhan pembahasan.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="font-bold flex items-center gap-2"><FileArchive className="h-4 w-4" /> Upload Soal (.zip)</Label>
              <Input type="file" accept=".zip" onChange={handleZipUpload} disabled={isCreating} />
              {isCreating && <div className="text-primary font-bold flex items-center gap-2 text-sm"><Loader2 className="animate-spin h-3 w-3" /> Memproses Data...</div>}
              {assetStatus === 'processing' && <div className="text-primary font-bold flex items-center gap-2 text-sm"><Loader2 className="animate-spin h-3 w-3" /> Memproses gambar &amp; PDF...</div>}
              {assetStatus === 'done' && <div className="text-green-600 font-bold text-sm">Aset siap. Ujian bisa dimulai.</div>}
              {assetStatus === 'error' && <div className="text-destructive font-bold text-sm">Aset gagal diproses. Upload ulang paket soal.</div>}
              {!roomExists && !isCreating && <div className="text-xs text-muted-foreground">Room belum dibuat. Upload paket soal untuk membuatnya.</div>}
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <Button
                variant={roomStatus === 'started' ? "destructive" : "default"}
                className="w-full font-black h-12"
                onClick={toggleRoomStatus}
                disabled={!roomExists || assetStatus === 'processing'}
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
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((s) => (
                    <TableRow key={s.id} className={cn(s.violations > 0 && "bg-destructive/5", s.isLocked && !s.isFinished && "bg-destructive/10")}>
                      <TableCell className="font-bold">{s.studentName}</TableCell>
                      <TableCell>{s.violations > 0 ? <Badge variant="destructive" className="animate-pulse">{s.violations}</Badge> : '-'}</TableCell>
                      <TableCell>
                        {typeof s.score === 'number'
                          ? <Badge className="bg-green-600 font-bold">{s.score}</Badge>
                          : <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </TableCell>
                      <TableCell><Badge variant={s.isFinished ? 'default' : 'secondary'}>{s.isFinished ? 'Selesai' : (s.isLocked ? 'Terkunci' : 'Mengerjakan')}</Badge></TableCell>
                      <TableCell>
                        {s.isLocked === true && !s.isFinished && (
                          <Button size="sm" variant="outline" className="font-bold" onClick={() => unlockStudent(s.id)}>
                            <LockOpen className="h-4 w-4 mr-1" /> Buka Kunci
                          </Button>
                        )}
                      </TableCell>
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
