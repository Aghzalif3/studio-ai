'use client';
import { useEffect, useState } from 'react';
import { Check, Loader2, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { useMontage } from '@/lib/montage/store';
import { AGENTS, GRADE_LABEL, LOOK_LABEL, agentById } from '@/lib/montage/agents';
import { srcToOut, segmentsFromCuts, outDuration } from '@/lib/montage/analysis';
import type { CaptionLook, Grade, MotionKind, OutWord, OutputAspect, Plan } from '@/lib/montage/types';
import type { SfxType } from '@/lib/types';
import { MOTION_LABEL } from './Timeline';

type Tab = 'agents' | 'reglages' | 'selection';

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('agents');
  const selected = useMontage((s) => s.selected);
  useEffect(() => { if (selected) setTab('selection'); }, [selected]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 border-b border-white/[0.06] p-1.5">
        {([['agents', 'Agents'], ['reglages', 'Réglages'], ['selection', 'Sélection']] as const).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${tab === id ? 'bg-orange-500 text-black' : 'text-ink-300 hover:bg-white/[0.05] hover:text-white'}`}>{l}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'agents' && <AgentsList />}
        {tab === 'reglages' && <Settings />}
        {tab === 'selection' && <Inspector />}
      </div>
    </div>
  );
}

function AgentsList() {
  const agents = useMontage((s) => s.agents);
  const busy = Object.values(agents).filter((a) => a.state === 'working' || a.state === 'waiting').length;
  return (
    <div>
      <h3 className="mlabel flex justify-between"><span>16 agents</span><span className="text-ink-400">{busy ? `${busy} actifs` : ''}</span></h3>
      <ul className="space-y-0.5">
        {AGENTS.map((a) => {
          const s = agents[a.id];
          return (
            <li key={a.id} className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition ${s.state === 'working' ? 'bg-white/[0.07]' : ''}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color, boxShadow: s.state === 'working' ? `0 0 10px ${a.color}` : undefined }} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-mono text-[11px] font-semibold text-white">{a.id}</div>
                <div className="truncate text-[10.5px] text-ink-400">{a.role}</div>
              </div>
              <span className="w-8 text-right font-mono text-[10px] text-ink-300">{s.count || ''}</span>
              <span className="grid w-4 place-items-center">
                {s.state === 'working' ? <Loader2 size={12} className="animate-spin text-orange-300" /> : s.state === 'done' ? <Check size={12} className="text-emerald-400" /> : s.state === 'waiting' ? <span className="h-1.5 w-1.5 rounded-full bg-ink-400 animate-pulse" /> : <span className="h-1.5 w-1.5 rounded-full bg-ink-600" />}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[10.5px] leading-relaxed text-ink-500">Chaque agent est un programme spécialisé qui tourne sur ton ordinateur. La transcription utilise Whisper, en local dans le navigateur.</p>
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return <div className="flex flex-wrap gap-1">{options.map((o) => <button key={o.v} onClick={() => onChange(o.v)} className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${value === o.v ? 'border-orange-500 bg-orange-500/15 text-orange-200' : 'border-white/10 text-ink-300 hover:border-white/25'}`}>{o.l}</button>)}</div>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) { return <div className="mb-3"><div className="mlabel">{label}</div>{children}</div>; }
function Tog({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button onClick={() => onChange(!on)} className="flex w-full items-center justify-between py-1 text-[12px] text-ink-200"><span>{label}</span><span className={`relative h-4 w-7 rounded-full transition ${on ? 'bg-orange-500' : 'bg-ink-600'}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} /></span></button>;
}

function Settings() {
  const st = useMontage((s) => s.settings);
  const lang = useMontage((s) => s.language);
  const media = useMontage((s) => s.media);
  const running = useMontage((s) => s.running);
  const words = useMontage((s) => s.words);
  const src = useMontage((s) => s.transcriptSource);
  const { setSettings, setLanguage, runAgents, editPlan } = useMontage.getState();
  const [script, setScript] = useState('');
  const LOOKS: CaptionLook[] = ['orange', 'jaune', 'neon', 'sobre'];
  return (
    <div>
      <Row label="Sous-titres">
        <div className="grid grid-cols-2 gap-1.5">
          {LOOKS.map((l) => (
            <button key={l} onClick={() => setSettings({ captionLook: l })} className={`h-12 rounded-lg border text-[13px] transition ${st.captionLook === l ? 'border-orange-500 ring-1 ring-orange-500' : 'border-white/10 hover:border-white/25'} ${LOOK_PREVIEW[l]}`}>{LOOK_LABEL[l]}</button>
          ))}
        </div>
      </Row>
      <Row label="Format de sortie"><Seg<OutputAspect> value={st.aspect} onChange={(v) => setSettings({ aspect: v })} options={[{ v: '9:16', l: '9:16 Reels' }, { v: '16:9', l: '16:9' }, { v: '1:1', l: '1:1' }, { v: '4:5', l: '4:5' }]} /></Row>
      <Row label="Étalonnage"><Seg<Grade> value={st.grade} onChange={(v) => { setSettings({ grade: v }); editPlan((p) => ({ ...p, grade: v })); }} options={(Object.keys(GRADE_LABEL) as Grade[]).map((g) => ({ v: g, l: GRADE_LABEL[g] }))} /></Row>
      <CropRow />
      <Row label={`Densité des motions · ${Math.round(st.motionDensity * 100)} %`}><input type="range" min={0.1} max={1} step={0.05} value={st.motionDensity} onChange={(e) => setSettings({ motionDensity: +e.target.value })} className="w-full accent-orange-500" /></Row>
      <Row label={`Blanc minimum coupé · ${st.minSilence.toFixed(2)} s`}><input type="range" min={0.25} max={1.5} step={0.05} value={st.minSilence} onChange={(e) => setSettings({ minSilence: +e.target.value })} className="w-full accent-orange-500" /></Row>
      <Row label={`Mots par sous-titre · ${st.wordsPerCaption}`}><input type="range" min={1} max={6} step={1} value={st.wordsPerCaption} onChange={(e) => setSettings({ wordsPerCaption: +e.target.value })} className="w-full accent-orange-500" /></Row>
      <div className="mb-3 rounded-lg border border-white/[0.06] px-2.5 py-1">
        <Tog on={st.cutSilences} onChange={(v) => setSettings({ cutSilences: v })} label="Couper les blancs" />
        <Tog on={st.cutHesitations} onChange={(v) => setSettings({ cutHesitations: v })} label="Retirer les « euh »" />
        <Tog on={st.zooms} onChange={(v) => setSettings({ zooms: v })} label="Zooms d’impact" />
        <Tog on={st.sfx} onChange={(v) => setSettings({ sfx: v })} label="Bruitages" />
      </div>
      <Row label="Langue parlée"><Seg value={lang} onChange={setLanguage} options={[{ v: 'fr', l: 'Français' }, { v: 'en', l: 'Anglais' }, { v: 'auto', l: 'Auto' }]} /></Row>
      <Row label="Texte de la vidéo (facultatif)">
        <p className="mb-1.5 text-[10.5px] text-ink-400">{src === 'whisper' ? `Transcription Whisper : ${words.length} mots.` : src === 'script' ? 'Texte collé, aligné sur la parole.' : 'Si Whisper ne peut pas tourner, colle ici ce que tu dis dans la vidéo.'}</p>
        <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={3} placeholder="Colle ton texte…" className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-2 text-[12px] text-ink-100 outline-none focus:border-orange-500/60" />
      </Row>
      <button disabled={!media || running} onClick={() => void runAgents({ script })} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-40">
        <Sparkles size={15} /> Relancer les agents
      </button>
      {words.length > 0 && <button disabled={running} onClick={() => { useMontage.setState({ words: [], transcriptSource: null }); void runAgents(); }} className="mt-1.5 w-full text-center text-[11px] text-ink-400 hover:text-white">Refaire aussi la transcription</button>}
    </div>
  );
}

function CropRow() {
  const crop = useMontage((s) => s.plan.crop);
  const set = (patch: Partial<Plan['crop']>) => useMontage.setState((s) => ({ plan: { ...s.plan, crop: { ...s.plan.crop, ...patch } } }));
  return (
    <Row label="Cadrage du sujet">
      <div className="flex items-center gap-2 text-[10px] text-ink-400">↔<input type="range" min={0} max={1} step={0.01} value={crop.x} onChange={(e) => set({ x: +e.target.value })} className="w-full" /></div>
      <div className="flex items-center gap-2 text-[10px] text-ink-400">↕<input type="range" min={0} max={1} step={0.01} value={crop.y} onChange={(e) => set({ y: +e.target.value })} className="w-full" /></div>
    </Row>
  );
}

const LOOK_PREVIEW: Record<CaptionLook, string> = {
  orange: 'bg-black font-black uppercase text-orange-500 [text-shadow:0_2px_0_#000]',
  jaune: 'bg-[#ffd23f] font-black text-black',
  neon: 'bg-black font-extrabold uppercase text-fuchsia-100 [text-shadow:0_0_10px_#e879f9]',
  sobre: 'bg-ink-800 font-semibold text-white',
};

function Inspector() {
  const sel = useMontage((s) => s.selected);
  const plan = useMontage((s) => s.plan);
  const { editPlan, select, setTime } = useMontage.getState();
  if (!sel) return <p className="text-[12px] text-ink-400">Clique un élément de la timeline (mot, motion, zoom, bruitage ou coupe) pour le modifier.</p>;
  const del = (fn: (p: Plan) => Plan) => { editPlan(fn); select(null); };
  const Head = ({ title, agent }: { title: string; agent: string }) => (
    <div className="mb-3 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: agentById(agent)?.color }} /><div className="text-sm font-semibold text-white">{title}</div><span className="ml-auto font-mono text-[10px] text-ink-400">{agent}</span></div>
  );

  if (sel.kind === 'caption') {
    const c = plan.captions.find((x) => x.id === sel.id); if (!c) return null;
    const cid = c.id;
    const upd = (fn: (w: OutWord[]) => OutWord[]) => editPlan((p) => ({ ...p, captions: p.captions.map((x) => (x.id === cid ? { ...x, words: fn(x.words) } : x)) }));
    return (
      <div>
        <Head title="Sous-titre" agent={c.agent} />
        <div className="mlabel">Mots (clique ★ pour le mot fort)</div>
        <div className="space-y-1">
          {c.words.map((w, i) => (
            <div key={i} className="flex items-center gap-1">
              <input value={w.text} onChange={(e) => upd((ws) => ws.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 text-[12px] outline-none focus:border-orange-500/60" />
              <button onClick={() => upd((ws) => ws.map((x, k) => ({ ...x, emphasis: k === i ? !x.emphasis : x.emphasis })))} className={`h-8 w-8 rounded-md text-sm ${w.emphasis ? 'bg-orange-500 text-black' : 'border border-white/10 text-ink-400'}`}>★</button>
            </div>
          ))}
        </div>
        <button onClick={() => del((p) => ({ ...p, captions: p.captions.filter((x) => x.id !== cid) }))} className="mbtn-danger mt-3"><Trash2 size={13} /> Supprimer ce sous-titre</button>
      </div>
    );
  }
  if (sel.kind === 'motion') {
    const m = plan.motions.find((x) => x.id === sel.id); if (!m) return null;
    const upd = (patch: Partial<typeof m>) => editPlan((p) => ({ ...p, motions: p.motions.map((x) => (x.id === m.id ? { ...x, ...patch } : x)) }));
    return (
      <div>
        <Head title={MOTION_LABEL[m.kind]} agent={m.agent} />
        <div className="mlabel">Type</div>
        <Seg<MotionKind> value={m.kind} onChange={(v) => upd({ kind: v })} options={(Object.keys(MOTION_LABEL) as MotionKind[]).map((k) => ({ v: k, l: MOTION_LABEL[k] }))} />
        {m.kind !== 'brackets' && m.kind !== 'arrow' && <><div className="mlabel mt-3">Texte</div><input value={m.text} onChange={(e) => upd({ text: e.target.value })} className="h-8 w-full rounded-md border border-white/10 bg-black/30 px-2 text-[12px] outline-none focus:border-orange-500/60" /></>}
        <div className="mlabel mt-3">Durée · {m.duration.toFixed(1)} s</div>
        <input type="range" min={0.5} max={4} step={0.1} value={m.duration} onChange={(e) => upd({ duration: +e.target.value })} className="w-full accent-orange-500" />
        <div className="mlabel mt-2">Position horizontale</div>
        <input type="range" min={0.1} max={0.9} step={0.01} value={m.x} onChange={(e) => upd({ x: +e.target.value })} className="w-full accent-orange-500" />
        <div className="mlabel mt-2">Position verticale</div>
        <input type="range" min={0.1} max={0.9} step={0.01} value={m.y} onChange={(e) => upd({ y: +e.target.value })} className="w-full accent-orange-500" />
        <button onClick={() => del((p) => ({ ...p, motions: p.motions.filter((x) => x.id !== m.id) }))} className="mbtn-danger mt-3"><Trash2 size={13} /> Supprimer</button>
      </div>
    );
  }
  if (sel.kind === 'zoom') {
    const z = plan.zooms.find((x) => x.id === sel.id); if (!z) return null;
    const upd = (patch: Partial<typeof z>) => editPlan((p) => ({ ...p, zooms: p.zooms.map((x) => (x.id === z.id ? { ...x, ...patch } : x)) }));
    return (
      <div>
        <Head title="Zoom d’impact" agent={z.agent} />
        <div className="mlabel">Force · ×{z.amount.toFixed(2)}</div>
        <input type="range" min={1.03} max={1.6} step={0.01} value={z.amount} onChange={(e) => upd({ amount: +e.target.value })} className="w-full accent-orange-500" />
        <div className="mlabel mt-2">Durée · {z.duration.toFixed(1)} s</div>
        <input type="range" min={0.4} max={4} step={0.1} value={z.duration} onChange={(e) => upd({ duration: +e.target.value })} className="w-full accent-orange-500" />
        <button onClick={() => del((p) => ({ ...p, zooms: p.zooms.filter((x) => x.id !== z.id) }))} className="mbtn-danger mt-3"><Trash2 size={13} /> Supprimer</button>
      </div>
    );
  }
  if (sel.kind === 'sfx') {
    const c = plan.sfx.find((x) => x.id === sel.id); if (!c) return null;
    const upd = (patch: Partial<typeof c>) => editPlan((p) => ({ ...p, sfx: p.sfx.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }));
    const KINDS: SfxType[] = ['whoosh', 'swoosh', 'impact', 'pop', 'click', 'ding', 'riser', 'boom', 'shimmer', 'typing'];
    return (
      <div>
        <Head title="Bruitage" agent={c.agent} />
        <div className="mlabel">Son</div>
        <Seg<SfxType> value={c.kind} onChange={(v) => upd({ kind: v, label: v })} options={KINDS.map((k) => ({ v: k, l: k }))} />
        <div className="mlabel mt-3">Volume · {c.gainDb} dB</div>
        <input type="range" min={-30} max={0} step={1} value={c.gainDb} onChange={(e) => upd({ gainDb: +e.target.value })} className="w-full accent-orange-500" />
        <button onClick={() => { setTime(Math.max(0, c.at - 0.3)); useMontage.getState().setPlaying(true); }} className="mbtn-ghost mt-2">Écouter à cet endroit</button>
        <button onClick={() => del((p) => ({ ...p, sfx: p.sfx.filter((x) => x.id !== c.id) }))} className="mbtn-danger mt-3"><Trash2 size={13} /> Supprimer</button>
      </div>
    );
  }
  if (sel.kind === 'cut') {
    const c = plan.cuts.find((x) => x.id === sel.id); if (!c) return null;
    return (
      <div>
        <Head title={c.reason === 'silence' ? 'Coupe d’un blanc' : 'Hésitation retirée'} agent={c.agent} />
        <p className="text-[12px] text-ink-300">{(c.srcEnd - c.srcStart).toFixed(2)} s retirées de la vidéo d’origine (de {c.srcStart.toFixed(2)} s à {c.srcEnd.toFixed(2)} s).</p>
        <button onClick={() => {
          editPlan((p) => {
            const cuts = p.cuts.filter((x) => x.id !== c.id);
            const segments = segmentsFromCuts(cuts, p.sourceDuration);
            // Les éléments posés après la coupe se décalent de la durée restaurée.
            const shift = c.srcEnd - c.srcStart, at = srcToOut(p.segments, c.srcEnd) ?? 0;
            const mv = (t: number) => (t >= at - 0.01 ? t + shift : t);
            return { ...p, cuts, segments, duration: outDuration(segments),
              captions: p.captions.map((x) => ({ ...x, start: mv(x.start), end: mv(x.end), words: x.words.map((w) => ({ ...w, start: mv(w.start), end: mv(w.end) })) })),
              motions: p.motions.map((x) => ({ ...x, start: mv(x.start) })), sfx: p.sfx.map((x) => ({ ...x, at: mv(x.at) })), zooms: p.zooms.map((x) => ({ ...x, start: mv(x.start) })) };
          });
          select(null);
        }} className="mbtn-ghost mt-3 border border-white/10"><RotateCcw size={13} /> Remettre ce passage</button>
      </div>
    );
  }
  return null;
}
