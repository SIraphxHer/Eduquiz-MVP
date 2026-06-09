"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Undo2, Trash2, Minimize2, Pencil } from 'lucide-react';

interface Point { x: number; y: number; }
interface Path { points: Point[]; color: string; width: number; }

interface ScratchpadProps {
  initialPaths: Path[];
  onSave: (paths: Path[]) => void;
  onClose: () => void;
}

export function Scratchpad({ initialPaths, onSave, onClose }: ScratchpadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paths, setPaths] = useState<Path[]>(initialPaths);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const strokeColor = isDark ? '#ffffff' : '#1F52AD';

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor; ctx.lineWidth = 3;
    const draw = (p: Point[]) => {
      if (p.length < 2) return;
      ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
      p.forEach(pt => ctx.lineTo(pt.x, pt.y)); ctx.stroke();
    };
    paths.forEach(p => draw(p.points));
    if (currentPath.length > 0) draw(currentPath);
  }, [paths, currentPath, strokeColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        renderCanvas();
      }
    };
    window.addEventListener('resize', resize); resize();
    return () => window.removeEventListener('resize', resize);
  }, [renderCanvas]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const getCoord = (e: any): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/90 backdrop-blur-md p-4 transition-colors">
      <div className="flex items-center justify-between mb-2 bg-white dark:bg-secondary/40 p-2 rounded-lg shadow-sm border">
        <div className="flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" /><span className="text-sm font-bold">CORETIAN MATEMATIKA</span></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { const p = paths.slice(0,-1); setPaths(p); onSave(p); }} disabled={paths.length === 0}><Undo2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { setPaths([]); onSave([]); }} disabled={paths.length === 0}><Trash2 className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={onClose}><Minimize2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="flex-1 relative border-4 border-dashed border-primary/30 rounded-2xl bg-white/40 dark:bg-black/20 overflow-hidden cursor-crosshair touch-none">
        <canvas ref={canvasRef} 
          onMouseDown={(e) => { setIsDrawing(true); setCurrentPath([getCoord(e)]); }}
          onMouseMove={(e) => { if (isDrawing) setCurrentPath(prev => [...prev, getCoord(e)]); }}
          onMouseUp={() => { if (isDrawing) { const p = [...paths, { points: currentPath, color: strokeColor, width: 3 }]; setPaths(p); onSave(p); setIsDrawing(false); setCurrentPath([]); } }}
          onTouchStart={(e) => { setIsDrawing(true); setCurrentPath([getCoord(e)]); }}
          onTouchMove={(e) => { if (isDrawing) setCurrentPath(prev => [...prev, getCoord(e)]); }}
          onTouchEnd={() => { if (isDrawing) { const p = [...paths, { points: currentPath, color: strokeColor, width: 3 }]; setPaths(p); onSave(p); setIsDrawing(false); setCurrentPath([]); } }}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
