import Link from 'next/link';
import { BookOpen, UserCircle, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-background font-body text-foreground flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center space-y-2 mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="bg-primary p-3 rounded-2xl shadow-lg">
          <BookOpen className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-primary">EduQuiz MVP</h1>
        <p className="text-muted-foreground">Platform Kuis Ujian Cerdas & Real-time</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl animate-in fade-in zoom-in duration-700">
        <Card className="hover:shadow-xl transition-all border-2 hover:border-primary/20">
          <CardHeader>
            <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-2">
              <UserCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Mode Siswa</CardTitle>
            <CardDescription>Masuk ke ruangan ujian dan kerjakan soal.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/student">
              <Button className="w-full h-12 rounded-xl text-lg font-semibold">Mulai Ujian</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all border-2 hover:border-secondary/20">
          <CardHeader>
            <div className="bg-secondary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-2">
              <ShieldCheck className="h-6 w-6 text-secondary" />
            </div>
            <CardTitle>Mode Operator</CardTitle>
            <CardDescription>Buat ruangan, kelola soal, dan pantau nilai.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/operator">
              <Button variant="secondary" className="w-full h-12 rounded-xl text-lg font-semibold">Dashboard Operator</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      <footer className="mt-20 text-muted-foreground text-sm">
        &copy; {new Date().getFullYear()} EduQuiz - Powered by Ahmad Syarif & Firebase
      </footer>
    </main>
  );
}
