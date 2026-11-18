// Dev tool: renders one frame per style into a contact sheet (checks every style renders without errors).
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import { ALL_STYLES } from '../src/lib/styles/registry';
import { nodeEnv } from '../src/lib/server/node-render';
import { renderFrame } from '../src/lib/render/compose';
import { newProject, defaultBrief, buildTimeline } from '../src/lib/project';
import type { SceneLayout } from '../src/lib/types';

const out = process.argv[2] ?? 'contact.png';
const only = process.argv[3]?.split(',');
const styles = only ? ALL_STYLES.filter((s) => only.includes(s.id)) : ALL_STYLES;
const W = 480, H = 270, cols = 6;
const sheet = createCanvas(W * cols, H * Math.ceil(styles.length / cols));
const sg = sheet.getContext('2d');
const layouts: SceneLayout[] = ['title', 'statement', 'stat', 'list', 'quote', 'cta'];
const texts: Record<SceneLayout, string> = {
  title: 'Le futur du café', statement: 'Chaque tasse raconte une histoire de terre et de soleil', stat: '73 % des Belges boivent du café',
  list: 'Récolte\nTorréfaction\nDégustation', quote: 'Le café est un voyage en une gorgée', cta: 'Abonnez-vous maintenant', image: '',
};
let errors = 0;
styles.forEach((style, i) => {
  const p = newProject('test', defaultBrief({ styleId: style.id }));
  const layout = layouts[i % layouts.length];
  p.scenes = [{ id: 's' + i, title: 't', layout, visual: '', onScreenText: texts[layout], narration: 'Bonjour à tous', duration: 4, camera: 'push-in', transition: 'crossfade', music: '', sfx: [], keywords: ['café', 'histoire', 'maintenant'] }];
  p.timeline = buildTimeline(p);
  const env = nodeEnv(() => null);
  const c = createCanvas(W * 2, H * 2); const g = c.getContext('2d') as any;
  try { renderFrame(env, g, { project: p, style, w: W * 2, h: H * 2 }, 1.8, 54); }
  catch (e) { errors++; console.error(style.id, e); }
  sg.drawImage(c, (i % cols) * W, Math.floor(i / cols) * H, W, H);
  sg.fillStyle = 'rgba(0,0,0,.6)'; sg.fillRect((i % cols) * W, Math.floor(i / cols) * H, W, 22);
  sg.fillStyle = '#fff'; sg.font = '14px Inter'; sg.fillText(style.id, (i % cols) * W + 6, Math.floor(i / cols) * H + 16);
});
fs.writeFileSync(out, sheet.toBuffer('image/jpeg', 80));
console.log(`rendered ${styles.length} styles, ${errors} errors → ${out}`);
