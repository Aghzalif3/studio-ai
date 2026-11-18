// Small demo project used to preview a style (style gallery, custom-style editor). Pure.
import type { Aspect, Project, SceneLayout } from './types';
import { buildTimeline, defaultBrief, newProject } from './project';
import type { StyleDef } from './styles/types';

export function sampleProject(style: StyleDef, lang: 'fr' | 'en', aspect: Aspect = '16:9', layout: SceneLayout = 'title', text?: string): Project {
  const p = newProject('preview', defaultBrief({ styleId: style.id, aspect, narration: 'none', musicMood: 'none' }));
  p.id = 'preview';
  p.captionStyle.enabled = false;
  p.scenes = [{
    id: 'sample', title: 'sample', layout, visual: '', duration: 6, camera: 'push-in', transition: 'cut', music: '', sfx: [],
    onScreenText: text ?? (layout === 'list' ? (lang === 'fr' ? 'Rapide\nCréatif\nLocal' : 'Fast\nCreative\nLocal') : layout === 'stat' ? '87%' : style.name[lang]),
    narration: '', keywords: [style.name[lang].split(' ')[0]],
  }];
  p.timeline = buildTimeline(p, false);
  return p;
}
