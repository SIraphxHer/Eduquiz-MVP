"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { FileJson, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Question } from '@/lib/mock-data';

interface QuestionImporterProps {
  onImport: (questions: Question[]) => void;
}

export function QuestionImporter({ onImport }: QuestionImporterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        if (file.name.toLowerCase().endsWith('.json')) {
          parseJSON(content);
        } else {
          throw new Error("Format file tidak didukung. Gunakan .json.");
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Gagal mengimpor soal",
          description: error.message,
        });
      }
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const parseJSON = (content: string) => {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      const mappedQuestions: Question[] = data.map((q: any, index: number) => {
        let corrIdx = q.correctAnswer;
        
        // Konversi jika correctAnswer adalah string "A", "B", "C", "D"
        if (typeof corrIdx === 'string') {
          const mapping: { [key: string]: number } = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
          corrIdx = mapping[corrIdx.trim()] ?? 0;
        }

        return {
          id: q.id || `json-${index}`,
          questionText: q.question || q.questionText,
          options: q.options,
          correctAnswerIndex: typeof corrIdx === 'number' ? corrIdx : parseInt(corrIdx)
        };
      });

      onImport(mappedQuestions);
      toast({
        title: "Berhasil mengimpor!",
        description: `${mappedQuestions.length} soal telah dimuat.`,
      });
    } else {
      throw new Error("Format JSON harus berupa Array soal.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        type="file"
        accept=".json"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      
      <Button 
        variant="outline" 
        onClick={() => fileInputRef.current?.click()}
        className="border-dashed border-2 px-6 h-12 hover:bg-primary/5 w-full"
      >
        <FileJson className="mr-2 h-4 w-4" />
        Upload Soal (soal.json)
      </Button>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 px-3 py-1 rounded-full text-center">
        <AlertCircle className="h-3 w-3 shrink-0" />
        Format: [ {"{"} "question", "options": ["A","B"...], "correctAnswer": "A" {"}"} ]
      </div>
    </div>
  );
}
