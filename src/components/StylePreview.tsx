'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StyleDef } from '@/lib/styles/types';
import type { Aspect, SceneLayout } from '@/lib/types';
import { renderFrame } from '@/lib/render/compose';
import { sampleProject } from '@/lib/sample';
import { browserEnv, loadFonts } from '@/lib/client/browser-env';
import { useI18n } from '@/lib/client/i18n';

const SIZE: Record<Aspect, [number, number]> = { '16:9': [480, 270], '9:16': [270, 480], '1:1': [360, 360], '4:5': [320, 400] };

/** Live preview of a style, drawn by the real renderer. Static frame until hovered (or always animated with `autoplay`). */
export function StylePreview({ style, aspect = '16:9', layout = 'title', text, autoplay = false, className = '', logo }: { style: StyleDef; aspect?: Aspect; layout?: SceneLayout; text?: string; autoplay?: boolean; className?: string; logo?: HTMLImageElement | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { lang } = useI18n();
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(false);
  const [w, h] = SIZE[aspect];
  const project = useMemo(() => sampleProject(style, lang, aspect, layout, text), [style, lang, aspect, layout, text]);
  const env = useMemo(() => browserEnv({ preview: true, logo }), [style, logo]);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' });
    io.observe(el); return () => io.disconnect();
  }, []);

  useEffect(() => {
    const c = ref.current; if (!c || !visible) return;
    const g = c.getContext('2d')!;
    let raf = 0, stop = false;
    const input = { project, style, w, h };
    const draw = (t: number) => { try { renderFrame(env, g, input, t, Math.round(t * 30)); } catch (e) { console.error(e); } };
    loadFonts().then(() => {
      if (stop) return;
      if (hover || autoplay) {
        const t0 = performance.now();
        const loop = () => { if (stop) return; draw(((performance.now() - t0) / 1000 + 0.2) % 5.6); raf = requestAnimationFrame(loop); };
        loop();
      } else draw(1.6);
    });
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [visible, hover, autoplay, project, style, env, w, h]);

  return <canvas ref={ref} width={w} height={h} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className={`block h-auto w-full ${className}`} style={{ aspectRatio: `${w}/${h}` }} />;
}
