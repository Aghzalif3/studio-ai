'use client';
// État du studio de montage automatique + orchestration des agents.

import { create } from 'zustand';
import { HOP, alignScript, detectSpeech, envelope, silenceCuts, speechThreshold } from './analysis';
import { AGENTS, actionTime, applyAction, planActions } from './agents';
import { decodeAudio, makeThumbs, resample, transcribe } from './media';
import { DEFAULT_SETTINGS, emptyPlan, type AgentAction, type MontageSettings, type Plan, type SrcWord } from './types';
import { loadSession, saveSession } from './persist';

export type AgentState = { state: 'idle' | 'waiting' | 'working' | 'done'; count: number };
export type TaskId = 'watch' | 'transcribe' | 'cut' | 'place' | 'render';
export type TaskState = { state: 'todo' | 'doing' | 'done' | 'error'; progress: number; note?: string };
export type LogLine = { id: number; agent: string; text: string; at: number };
export type Selection = { kind: 'caption' | 'motion' | 'sfx' | 'zoom' | 'cut'; id: string } | null;

interface Media { file: File; url: string; name: string; width: number; height: number; duration: number }

interface S {
  media: Media | null;
  thumbs: { t: number; data: string }[];
  env: Float32Array | null;
  speech: [number, number][];
  words: SrcWord[];
  transcriptSource: 'whisper' | 'script' | null;
  language: 'fr' | 'en' | 'auto';
  settings: MontageSettings;
  plan: Plan;
  history: Plan[];
  agents: Record<string, AgentState>;
  tasks: Record<TaskId, TaskState>;
  log: LogLine[];
  running: boolean;
  cursor: { agent: string; x: number; y: number; label: string } | null;
  time: number;
  playing: boolean;
  selected: Selection;
  opsPerSec: number;
  error: string | null;

  importFile: (f: File) => Promise<void>;
  restore: () => Promise<void>;
  setSettings: (p: Partial<MontageSettings>) => void;
  setLanguage: (l: S['language']) => void;
  runAgents: (opts?: { script?: string }) => Promise<void>;
  stop: () => void;
  setTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  select: (s: Selection) => void;
  editPlan: (fn: (p: Plan) => Plan) => void;
  undo: () => void;
  setTask: (id: TaskId, t: Partial<TaskState>) => void;
}

const freshAgents = () => Object.fromEntries(AGENTS.map((a) => [a.id, { state: 'idle', count: 0 } as AgentState]));
const freshTasks = (): Record<TaskId, TaskState> => ({ watch: { state: 'todo', progress: 0 }, transcribe: { state: 'todo', progress: 0 }, cut: { state: 'todo', progress: 0 }, place: { state: 'todo', progress: 0 }, render: { state: 'todo', progress: 0 } });
let logId = 0;
let runToken = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useMontage = create<S>((set, get) => {
  const log = (agent: string, text: string) => set((s) => ({ log: [...s.log.slice(-199), { id: ++logId, agent, text, at: Date.now() }] }));
  const persist = () => { const s = get(); if (s.media) void saveSession({ file: s.media.file, words: s.words, transcriptSource: s.transcriptSource, settings: s.settings, plan: s.plan, language: s.language }); };
  let persistT: any = null;
  const persistSoon = () => { clearTimeout(persistT); persistT = setTimeout(persist, 600); };

  const analyse = async (file: File, url: string, duration: number) => {
    get().setTask('watch', { state: 'doing', progress: 0.05, note: 'Lecture de l’audio' });
    const audio = await decodeAudio(file);
    if (audio) {
      const env = envelope(audio.mono, audio.sampleRate);
      set({ env, speech: detectSpeech(env, { minSilence: get().settings.minSilence }) });
      (analyse as any).audio = audio;
    } else {
      set({ env: null, speech: [] });
      log('rythme-01', 'aucune piste audio lisible : pas de coupes ni de sous-titres automatiques');
    }
    get().setTask('watch', { progress: 0.35, note: 'Vignettes' });
    const thumbs: { t: number; data: string }[] = [];
    await makeThumbs(url, duration, (t, data) => { thumbs.push({ t, data }); set({ thumbs: [...thumbs] }); get().setTask('watch', { progress: 0.35 + 0.65 * Math.min(1, t / duration) }); }).catch(() => {});
    get().setTask('watch', { state: 'done', progress: 1, note: undefined });
    return audio;
  };

  return {
    media: null, thumbs: [], env: null, speech: [], words: [], transcriptSource: null, language: 'fr',
    settings: DEFAULT_SETTINGS, plan: emptyPlan(0), history: [], agents: freshAgents(), tasks: freshTasks(), log: [],
    running: false, cursor: null, time: 0, playing: false, selected: null, opsPerSec: 0, error: null,

    importFile: async (file) => {
      const prev = get().media; if (prev) URL.revokeObjectURL(prev.url);
      runToken++;
      const url = URL.createObjectURL(file);
      set({ error: null, running: false, cursor: null, thumbs: [], words: [], transcriptSource: null, agents: freshAgents(), tasks: freshTasks(), log: [], history: [], time: 0, playing: false, selected: null });
      try {
        const { loadVideo } = await import('./media');
        const v = await loadVideo(url);
        const media: Media = { file, url, name: file.name, width: v.videoWidth, height: v.videoHeight, duration: v.duration };
        v.removeAttribute('src'); v.load();
        set({ media, plan: emptyPlan(media.duration) });
        log('cadrage-01', `vidéo importée : ${media.width}×${media.height}, ${media.duration.toFixed(1)} s`);
        await analyse(file, url, media.duration);
        persist();
      } catch (e: any) { set({ error: e.message }); }
    },

    restore: async () => {
      const s = await loadSession().catch(() => null); if (!s || get().media) return;
      const file = s.file instanceof File ? s.file : new File([s.file], 'video.mp4', { type: s.file.type });
      const url = URL.createObjectURL(file);
      const { loadVideo } = await import('./media');
      try {
        const v = await loadVideo(url);
        const media: Media = { file, url, name: file.name, width: v.videoWidth, height: v.videoHeight, duration: v.duration };
        v.removeAttribute('src'); v.load();
        set({ media, words: s.words, transcriptSource: s.transcriptSource, settings: { ...DEFAULT_SETTINGS, ...s.settings }, plan: s.plan, language: s.language ?? 'fr' });
        log('cadrage-01', 'montage précédent restauré');
        await analyse(file, url, media.duration);
        if (s.words.length) { get().setTask('transcribe', { state: 'done', progress: 1 }); }
        if (s.plan.captions.length || s.plan.cuts.length) { get().setTask('cut', { state: 'done', progress: 1 }); get().setTask('place', { state: 'done', progress: 1 }); set({ agents: Object.fromEntries(AGENTS.map((a) => [a.id, { state: 'done', count: countFor(s.plan, a.id) }])) }); }
      } catch { /* session illisible : on repart de zéro */ }
    },

    setSettings: (p) => { set((s) => ({ settings: { ...s.settings, ...p } })); persistSoon(); },
    setLanguage: (language) => set({ language }),

    runAgents: async (opts = {}) => {
      const s0 = get(); if (!s0.media || s0.running) return;
      const token = ++runToken;
      const alive = () => token === runToken;
      set({ running: true, error: null, agents: Object.fromEntries(AGENTS.map((a) => [a.id, { state: 'waiting', count: 0 }])), plan: emptyPlan(s0.media.duration), history: [...s0.history.slice(-20), s0.plan], selected: null });
      const st = get().settings;
      try {
        // 1. Transcription
        let words = get().words;
        const audio = (analyse as any).audio as { mono: Float32Array; sampleRate: number } | undefined;
        if (opts.script?.trim()) {
          words = alignScript(opts.script, get().speech);
          set({ words, transcriptSource: 'script' });
          get().setTask('transcribe', { state: 'done', progress: 1, note: 'Texte collé, aligné sur la parole' });
          log('soustitres-01', `texte collé aligné sur ${get().speech.length} passages parlés`);
        } else if (!words.length && audio) {
          get().setTask('transcribe', { state: 'doing', progress: 0, note: 'Préparation de Whisper' });
          log('soustitres-01', 'écoute la vidéo (Whisper, sur ton ordinateur)');
          const a16 = await resample(audio.mono, audio.sampleRate, 16000);
          const lang = get().language === 'auto' ? null : get().language === 'fr' ? 'french' : 'english';
          try {
            const job = transcribe(a16, lang, (p) => {
              if (!alive()) return;
              get().setTask('transcribe', { progress: p.stage === 'download' ? p.value * 0.5 : 0.5 + p.value * 0.5, note: p.stage === 'download' ? `Téléchargement du modèle ${Math.round(p.value * 100)} % (une seule fois)` : 'Transcription en cours' });
            });
            words = await job.promise;
            if (!alive()) return;
            set({ words, transcriptSource: 'whisper' });
            get().setTask('transcribe', { state: 'done', progress: 1, note: `${words.length} mots` });
            log('soustitres-01', `transcription terminée : ${words.length} mots`);
          } catch (e: any) {
            get().setTask('transcribe', { state: 'error', progress: 0, note: 'Whisper indisponible : colle le texte pour avoir les sous-titres' });
            log('soustitres-01', `transcription impossible (${String(e.message).slice(0, 80)})`);
            words = [];
          }
        } else if (words.length) {
          get().setTask('transcribe', { state: 'done', progress: 1, note: `${words.length} mots` });
        }
        if (!alive()) return;

        // 2. Plan des agents
        const env = get().env;
        const speech = env ? detectSpeech(env, { minSilence: st.minSilence, threshold: speechThreshold(env) }) : [];
        const sil = silenceCuts(speech, get().media!.duration, { minSilence: st.minSilence });
        const actions = planActions({ sourceDuration: get().media!.duration, words, speech, silenceCuts: sil, settings: st });
        await play(actions, token);
        if (!alive()) return;
        set({ cursor: null, running: false, agents: Object.fromEntries(Object.entries(get().agents).map(([k, v]) => [k, { ...v, state: 'done' as const }])) });
        get().setTask('cut', { state: 'done', progress: 1 }); get().setTask('place', { state: 'done', progress: 1 });
        log('style-01', `montage prêt : ${get().plan.duration.toFixed(1)} s, ${actions.length} actions de 16 agents`);
        set({ time: 0 });
        persist();
      } catch (e: any) {
        if (alive()) set({ running: false, cursor: null, error: e.message });
      }
    },

    stop: () => { runToken++; set({ running: false, cursor: null }); },
    setTime: (time) => set({ time: Math.max(0, Math.min(time, get().plan.duration)) }),
    setPlaying: (playing) => set({ playing }),
    select: (selected) => set({ selected }),
    editPlan: (fn) => { set((s) => ({ history: [...s.history.slice(-40), s.plan], plan: fn(s.plan) })); persistSoon(); },
    undo: () => { const h = get().history; if (!h.length) return; set({ plan: h[h.length - 1], history: h.slice(0, -1) }); persistSoon(); },
    setTask: (id, t) => set((s) => ({ tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...t } } })),
  };

  /** Applique les actions une par une, avec curseur d'agent et aperçu au bon instant. */
  async function play(actions: AgentAction[], token: number) {
    const n = actions.length; if (!n) return;
    const nCuts = actions.filter((a) => a.type === 'cut').length;
    const delay = Math.max(35, Math.min(260, 9000 / n));
    const t0 = performance.now();
    get().setTask('cut', { state: nCuts ? 'doing' : 'done', progress: nCuts ? 0 : 1 });
    let doneCuts = 0, donePlace = 0;
    for (let i = 0; i < n; i++) {
      if (token !== runToken) return;
      const a = actions[i];
      const plan = applyAction(get().plan, a);
      const t = actionTime(plan, a);
      const agents = { ...get().agents };
      for (const [k, v] of Object.entries(agents)) if (v.state === 'working') agents[k] = { ...v, state: 'waiting' };
      const cur = agents[a.agent] ?? { state: 'idle', count: 0 };
      agents[a.agent] = { state: 'working', count: cur.count + (a.type === 'note' ? 0 : 1) };
      const pos = cursorPos(a);
      set({ plan, agents, cursor: { agent: a.agent, x: pos.x, y: pos.y, label: a.agent }, ...(t != null ? { time: t } : {}), opsPerSec: Math.round(((i + 1) / Math.max(0.2, (performance.now() - t0) / 1000)) * 10) / 10 });
      log(a.agent, a.log);
      if (a.type === 'cut') { doneCuts++; get().setTask('cut', { progress: doneCuts / nCuts, ...(doneCuts === nCuts ? { state: 'done' } : {}) }); }
      else { donePlace++; get().setTask('place', { state: 'doing', progress: donePlace / (n - nCuts) }); }
      await sleep(a.type === 'note' ? delay * 2 : delay);
    }
  }
});

function cursorPos(a: AgentAction): { x: number; y: number } {
  switch (a.type) {
    case 'motion': return { x: a.item.x, y: a.item.y };
    case 'caption': return { x: 0.5 + (Math.random() - 0.5) * 0.3, y: 0.72 };
    case 'zoom': return { x: a.item.x, y: a.item.y };
    case 'cut': return { x: 0.2 + Math.random() * 0.6, y: 0.9 };
    case 'sfx': return { x: 0.8, y: 0.85 };
    default: return { x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.3 };
  }
}

export function countFor(p: Plan, agent: string) {
  return p.cuts.filter((c) => c.agent === agent).length + p.captions.filter((c) => c.agent === agent).length + p.motions.filter((c) => c.agent === agent).length + p.sfx.filter((c) => c.agent === agent).length + p.zooms.filter((c) => c.agent === agent).length;
}

export { HOP };

// Accès de débogage depuis la console du navigateur (et pour les tests automatisés).
if (typeof window !== 'undefined') (window as any).__montage = useMontage;
