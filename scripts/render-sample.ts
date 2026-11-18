// End-to-end check without the UI: idea → offline script → voices → music → MP4.
// Usage: npx tsx scripts/render-sample.ts [voiceEngine] [voice] [styleId] [resolution]
import { newProject, defaultBrief, buildTimeline } from '../src/lib/project';
import { offlineScript } from '../src/lib/engines/offline-writer';
import { normalizeScenes } from '../src/lib/engines/script-shared';
import { saveProject, updateProject, listRenders } from '../src/lib/server/store';
import { enqueueRender, getJob } from '../src/lib/server/jobs';
import { resolveStyle } from '../src/lib/styles/registry';

const [engine = 'espeak', voice = 'fr-be', styleId = 'dark-keynote', res = '720p'] = process.argv.slice(2);
const brief = defaultBrief({ idea: 'Le café de spécialité en Belgique', subject: 'le café de spécialité', durationSec: 15, styleId, language: 'fr-BE', musicMood: 'upbeat', validateStoryboard: false });
const p = newProject('Test café', brief);
p.voiceSettings = { engine, voice, rate: 0, pitch: 0 };
p.scenes = normalizeScenes(offlineScript(brief, resolveStyle(styleId).name.fr), brief);
p.timeline = buildTimeline(p);
await saveProject(p);
const job = await enqueueRender(p.id, { resolution: res as any, fps: 30, quality: 'draft' });
const t0 = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 1000));
  const j = getJob(job.id)!;
  process.stdout.write(`\r${j.status} ${j.phase} ${(j.progress * 100).toFixed(0)}% ${j.fpsRender ? j.fpsRender.toFixed(1) + ' i/s' : ''}      `);
  if (j.status === 'done' || j.status === 'error') { console.log('\n', j.status, j.error ?? j.file, `${((Date.now() - t0) / 1000).toFixed(1)}s`); break; }
}
console.log((await listRenders())[0]);
void updateProject;
