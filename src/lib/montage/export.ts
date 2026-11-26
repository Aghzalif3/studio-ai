'use client';
// Export vidéo dans le navigateur : le montage est rejoué image par image sur un canvas
// (même dessin que l'aperçu), avec le son de la vidéo et les bruitages, puis enregistré.
// L'export prend autant de temps que la durée du montage (lecture en temps réel).

import { outToSrc } from './analysis';
import { loadVideo, playSfx, seek } from './media';
import { OUTPUT_SIZES, drawMontageFrame } from './render';
import type { CaptionLook, OutputAspect, Plan } from './types';

export function exportMime(): { mime: string; ext: 'mp4' | 'webm' } {
  const c = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of c) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return { mime: m, ext: m.startsWith('video/mp4') ? 'mp4' : 'webm' };
  return { mime: '', ext: 'webm' };
}

export async function exportMontage(opts: {
  url: string; plan: Plan; look: CaptionLook; aspect: OutputAspect; quality: '720p' | '1080p';
  onProgress: (p: number) => void; signal: AbortSignal;
}): Promise<{ blob: Blob; ext: string }> {
  const { plan, signal } = opts;
  if (!plan.segments.length) throw new Error('Rien à exporter.');
  const [bw, bh] = OUTPUT_SIZES[opts.aspect];
  const k = opts.quality === '720p' ? 720 / Math.min(bw, bh) : 1;
  const W = Math.round((bw * k) / 2) * 2, H = Math.round((bh * k) / 2) * 2;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d')!;
  const v = await loadVideo(opts.url);
  v.muted = false;
  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();
  const src = ac.createMediaElementSource(v); src.connect(dest);
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const { mime, ext } = exportMime();
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: opts.quality === '720p' ? 6e6 : 12e6, audioBitsPerSecond: 192000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  const video = { el: v, w: v.videoWidth, h: v.videoHeight };
  const draw = (t: number) => drawMontageFrame(g, W, H, plan, t, { look: opts.look, video });

  await seek(v, plan.segments[0].srcStart); draw(0);
  rec.start(500);
  let lastT = -1;
  try {
    for (let i = 0; i < plan.segments.length; i++) {
      const s = plan.segments[i];
      if (i > 0) { rec.pause(); v.pause(); await seek(v, s.srcStart); draw(s.outStart); rec.resume(); }
      await v.play();
      await new Promise<void>((res, rej) => {
        const tick = () => {
          if (signal.aborted) return rej(new DOMException('Export annulé', 'AbortError'));
          const t = s.outStart + Math.max(0, v.currentTime - s.srcStart);
          // Bruitages entre la dernière image et celle-ci.
          for (const c of plan.sfx) if (c.at > lastT && c.at <= t && t - c.at < 0.4) playSfx(ac, dest, c.kind, c.gainDb);
          lastT = t;
          draw(t); opts.onProgress(Math.min(1, t / plan.duration));
          if (v.currentTime >= s.srcEnd - 0.02 || v.ended) return res();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }
    v.pause();
    await new Promise((r) => setTimeout(r, 1300)); // laisse sonner le dernier bruitage
  } finally {
    if (rec.state !== 'inactive') rec.stop();
    await stopped;
    v.pause(); v.removeAttribute('src'); v.load(); ac.close().catch(() => {});
  }
  opts.onProgress(1);
  return { blob: new Blob(chunks, { type: mime || 'video/webm' }), ext };
}

export { outToSrc };
