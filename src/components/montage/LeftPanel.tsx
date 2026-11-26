'use client';
import { useRef } from 'react';
import { Check, Film, Loader2, Plus, X } from 'lucide-react';
import { useMontage, type TaskId } from '@/lib/montage/store';
import { agentById } from '@/lib/montage/agents';

const TASKS: { id: TaskId; label: string }[] = [
  { id: 'watch', label: 'Regarder ta vidéo' },
  { id: 'transcribe', label: 'Écouter et transcrire' },
  { id: 'cut', label: 'Couper les blancs' },
  { id: 'place', label: 'Poser sous-titres, motions et sons' },
  { id: 'render', label: 'Rendre la vidéo' },
];

export function LeftPanel() {
  const media = useMontage((s) => s.media);
  const thumbs = useMontage((s) => s.thumbs);
  const tasks = useMontage((s) => s.tasks);
  const running = useMontage((s) => s.running);
  const input = useRef<HTMLInputElement>(null);
  const total = TASKS.reduce((s, t) => s + (tasks[t.id].state === 'done' ? 1 : tasks[t.id].state === 'doing' ? tasks[t.id].progress : 0), 0) / TASKS.length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <input ref={input} type="file" accept="video/*,.mov,.mp4,.m4v,.webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void useMontage.getState().importFile(f); e.target.value = ''; }} />
      <button onClick={() => input.current?.click()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 font-semibold text-black shadow-[0_8px_30px_-10px_rgba(255,107,44,.9)] transition hover:bg-orange-400 active:scale-[.98]">
        <Plus size={17} strokeWidth={2.6} /> {media ? 'Changer de vidéo' : 'Ajouter une vidéo'}
      </button>

      <section>
        <h3 className="mlabel flex justify-between"><span>Médias</span><span className="text-ink-400">{media ? `${thumbs.length} vignettes` : '—'}</span></h3>
        {media ? (
          <div className="flex gap-2">
            <div className="relative w-[92px] shrink-0 overflow-hidden rounded-lg border-2 border-orange-500 bg-black" style={{ aspectRatio: `${media.width} / ${media.height}`, maxHeight: 150 }}>
              {thumbs[0] && <img src={thumbs[Math.floor(thumbs.length / 3)]?.data ?? thumbs[0].data} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 text-[11px] leading-relaxed text-ink-300">
              <div className="truncate font-semibold text-white" title={media.name}>{media.name}</div>
              <div>{media.width}×{media.height}</div>
              <div>{media.duration.toFixed(1)} s</div>
              <div className="mt-1 grid grid-cols-3 gap-0.5">{thumbs.filter((_, i) => i % Math.max(1, Math.floor(thumbs.length / 6)) === 0).slice(0, 6).map((x) => <img key={x.t} src={x.data} alt="" className="h-7 w-full rounded-sm object-cover opacity-80" />)}</div>
            </div>
          </div>
        ) : (
          <button onClick={() => input.current?.click()} className="grid h-24 w-full place-items-center rounded-xl border border-dashed border-white/15 text-xs text-ink-400 hover:border-orange-400/60 hover:text-orange-200"><span className="flex items-center gap-2"><Film size={15} /> MP4, MOV ou WebM</span></button>
        )}
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
        <h3 className="mlabel flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${running ? 'bg-orange-500 animate-pulse' : 'bg-ink-500'}`} />Agents · {running ? 'en cours' : 'prêts'} <span className="ml-auto font-mono text-orange-300">{Math.round(total * 100)} %</span></h3>
        <ul className="space-y-1">
          {TASKS.map((t) => {
            const s = tasks[t.id];
            return (
              <li key={t.id} className={`rounded-lg px-2 py-1.5 text-[12.5px] ${s.state === 'doing' ? 'bg-white/[0.05] text-white' : s.state === 'done' ? 'text-ink-200' : 'text-ink-400'}`}>
                <div className="flex items-center gap-2">
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${s.state === 'done' ? 'border-orange-500 bg-orange-500 text-black' : s.state === 'doing' ? 'border-orange-400' : s.state === 'error' ? 'border-rose-400 text-rose-300' : 'border-ink-500'}`}>
                    {s.state === 'done' ? <Check size={10} strokeWidth={3.5} /> : s.state === 'doing' ? <Loader2 size={10} className="animate-spin text-orange-300" /> : s.state === 'error' ? <X size={10} /> : null}
                  </span>
                  {t.label}
                </div>
                {(s.state === 'doing' || s.note) && (
                  <div className="ml-6 mt-1">
                    {s.state === 'doing' && <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${Math.round(s.progress * 100)}%` }} /></div>}
                    {s.note && <div className={`mt-0.5 text-[10.5px] ${s.state === 'error' ? 'text-rose-300' : 'text-ink-400'}`}>{s.note}</div>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Mascot busy={running} />
      <LiveLog />
    </div>
  );
}

function LiveLog() {
  const log = useMontage((s) => s.log);
  const ops = useMontage((s) => s.opsPerSec);
  const running = useMontage((s) => s.running);
  return (
    <section className="flex min-h-[160px] flex-1 flex-col rounded-xl border border-white/[0.06] bg-black/40">
      <h3 className="flex items-center gap-2 border-b border-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-white">
        <span className={`h-1.5 w-1.5 rounded-full ${running ? 'bg-emerald-400 animate-pulse' : 'bg-ink-500'}`} /> Studio en direct
        <span className="ml-auto font-mono text-[10px] text-emerald-300">{running ? `${ops} ops/s` : ''}</span>
      </h3>
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-2.5 py-1.5 font-mono text-[10.5px] leading-[1.45]">
        <div>
          {log.length === 0 && <div className="text-ink-500">Les agents écriront ici ce qu’ils font.</div>}
          {log.slice(-80).map((l) => (
            <div key={l.id} className="animate-[drop_.25s_ease-out]"><span style={{ color: agentById(l.agent)?.color ?? '#ff6b2c' }}>{l.agent}</span> <span className="text-ink-200">{l.text}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Petit personnage original du studio : il tape au clavier quand les agents travaillent. */
function Mascot({ busy }: { busy: boolean }) {
  return (
    <div className="relative h-[86px] overflow-hidden rounded-xl bg-gradient-to-b from-[#1a120d] to-[#120c09]">
      <svg viewBox="0 0 240 86" className="absolute inset-0 h-full w-full">
        <defs><linearGradient id="desk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c46a2a" /><stop offset="1" stopColor="#7a3a12" /></linearGradient></defs>
        <rect x="20" y="66" width="200" height="8" rx="3" fill="url(#desk)" />
        <rect x="44" y="22" width="70" height="42" rx="5" fill="#1d1d24" stroke="#3a3a46" />
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="52" y={30 + i * 6} width={busy ? 20 + ((i * 13) % 34) : 16 + i * 4} height="2.5" rx="1" fill={i === 1 ? '#ff6b2c' : '#6b7280'}>{busy && <animate attributeName="width" values={`10;${30 + i * 5};10`} dur={`${0.8 + i * 0.2}s`} repeatCount="indefinite" />}</rect>)}
        <rect x="76" y="62" width="6" height="5" fill="#3a3a46" />
        <g transform="translate(140 30)">
          <rect width="40" height="36" rx="7" fill="#ff7a3d" />
          <rect x="4" y="4" width="32" height="10" rx="4" fill="#ff9a64" opacity=".6" />
          <rect x="10" y="16" width="5" height="7" rx="2" fill="#2a1208"><animate attributeName="height" values="7;7;1;7" keyTimes="0;.9;.95;1" dur="3.2s" repeatCount="indefinite" /></rect>
          <rect x="25" y="16" width="5" height="7" rx="2" fill="#2a1208"><animate attributeName="height" values="7;7;1;7" keyTimes="0;.9;.95;1" dur="3.2s" repeatCount="indefinite" /></rect>
          <rect x="-6" y="26" width="9" height="5" rx="2" fill="#ff7a3d">{busy && <animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur=".25s" repeatCount="indefinite" />}</rect>
        </g>
        <rect x="186" y="56" width="10" height="10" rx="2" fill="#2f6f3a" /><path d="M191 56c-4-8 2-12 0-16M191 56c4-6 8-6 6-12" stroke="#4ade80" strokeWidth="2" fill="none" />
      </svg>
      <div className="absolute bottom-1 left-2 text-[10px] font-semibold text-orange-200/80">{busy ? 'Montage en cours…' : 'Prêt à monter'}</div>
    </div>
  );
}
