'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { Project } from '@/lib/types';
import type { StyleDef } from '@/lib/styles/types';
import { renderFrame } from '@/lib/render/compose';
import { MediaCache, browserEnv, loadFonts } from '@/lib/client/browser-env';
import { assetUrl } from '@/lib/client/api';

const W = 384;

/** Static frame of one scene, drawn by the real renderer at 70 % of the scene. */
export function SceneThumb({ project, style, sceneId }: { project: Project; style: StyleDef; sceneId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [aw, ah] = project.brief.aspect.split(':').map(Number);
  const w = aw >= ah ? W : Math.round((W * aw) / ah) , h = aw >= ah ? Math.round((W * ah) / aw) : W;
  const media = useMemo(() => new MediaCache((id) => assetUrl(project.id, id)), [project.id]);
  const env = useMemo(() => browserEnv({ preview: true, media: (id) => { const a = project.assets.find((x) => x.id === id); return a?.kind === 'image' ? media.image(id) : null; } }), [media, project.assets]);
  const scene = project.scenes.find((s) => s.id === sceneId);
  const key = JSON.stringify([scene, style.id, project.brief.aspect, project.captionStyle.enabled]);
  useEffect(() => {
    let alive = true;
    const draw = () => {
      const c = ref.current; if (!c || !alive) return;
      const clip = project.timeline.video.find((v) => v.sceneId === sceneId);
      if (!clip) return;
      const solo: Project = { ...project, timeline: { ...project.timeline, video: [{ ...clip, start: 0, transition: { type: 'cut', duration: 0 } }], captions: [], effects: [] } };
      try { renderFrame(env, c.getContext('2d')!, { project: solo, style, w, h }, clip.duration * 0.7, 21); } catch (e) { console.error(e); }
    };
    const id = setTimeout(() => loadFonts().then(draw), 120);
    const again = setTimeout(draw, 1200); // after the image has loaded
    return () => { alive = false; clearTimeout(id); clearTimeout(again); };
  }, [key, env, w, h]);
  return <canvas ref={ref} width={w} height={h} className="block h-auto w-full" style={{ aspectRatio: `${w}/${h}` }} />;
}
