'use client';
import { useEffect } from 'react';
import { Pause, Play, SkipBack, Maximize2 } from 'lucide-react';
import { formatTime } from '@/lib/util';
import type { usePlayer } from '@/lib/client/player';

type P = ReturnType<typeof usePlayer>;

export function PlayerView({ player, className = '', maxH = '60vh', keyboard = true }: { player: P; className?: string; maxH?: string; keyboard?: boolean }) {
  const { canvasRef, playing, time, duration, toggle, seek, width, height } = player;
  useEffect(() => {
    if (!keyboard) return;
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input,textarea,select,[contenteditable]')) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [toggle, keyboard]);
  return (
    <div className={`overflow-hidden rounded-2xl border border-white/[0.07] bg-black ${className}`}>
      <div className="flex justify-center bg-[repeating-conic-gradient(#0d0d12_0%_25%,#0a0a0e_0%_50%)] bg-[length:16px_16px]">
        <canvas ref={canvasRef} width={width} height={height} onClick={toggle} className="block h-auto max-w-full cursor-pointer" style={{ aspectRatio: `${width}/${height}`, maxHeight: maxH }} />
      </div>
      <div className="flex items-center gap-3 border-t border-white/[0.06] bg-ink-900 px-3 py-2">
        <button className="btn-icon h-8 w-8" onClick={() => seek(0)} aria-label="Début"><SkipBack size={15} /></button>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition hover:scale-105" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>{playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}</button>
        <span className="w-24 shrink-0 font-mono text-xs text-ink-300">{formatTime(time)} / {formatTime(duration)}</span>
        <input type="range" className="min-w-0 flex-1" min={0} max={Math.max(0.01, duration)} step={0.01} value={time} onChange={(e) => seek(parseFloat(e.target.value))} />
        <button className="btn-icon h-8 w-8" aria-label="Plein écran" onClick={() => canvasRef.current?.requestFullscreen?.()}><Maximize2 size={15} /></button>
      </div>
    </div>
  );
}
