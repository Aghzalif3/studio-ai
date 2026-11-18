'use client';
import { useState } from 'react';
import { Dice5, Music } from 'lucide-react';
import { Page, PageHeader } from '@/components/ui';
import { SFX } from '@/components/workspace/Storyboard';
import { useI18n } from '@/lib/client/i18n';
import { MOODS } from '@/lib/client/options';

const DESC: Record<string, [string, string]> = {
  cinematic: ['Nappes amples, cordes synthétiques, montée dramatique.', 'Wide pads, synth strings, dramatic build.'],
  epic: ['Percussions lourdes et accords puissants, pour les bandes-annonces.', 'Heavy drums and powerful chords, for trailers.'],
  upbeat: ['Rythme enjoué et positif, idéal pour la publicité.', 'Bright, positive groove, great for ads.'],
  electronic: ['Basse pulsée et arpèges, pour TikTok et la tech.', 'Pulsing bass and arpeggios, for TikTok and tech.'],
  corporate: ['Piano et guitare clairs, rassurants, pour l’entreprise.', 'Clean piano and guitar, for business.'],
  ambient: ['Textures calmes et lentes, pour le documentaire.', 'Calm, slow textures, for documentaries.'],
  lofi: ['Beat détendu et accords jazzy, pour l’explication.', 'Relaxed beat and jazzy chords, for explainers.'],
};

export default function AudioLibrary() {
  const { t } = useI18n();
  const [seeds, setSeeds] = useState<Record<string, number>>({});
  return (
    <Page wide>
      <PageHeader kicker={t('Bibliothèque audio', 'Audio library')} title={t('Musiques et bruitages', 'Music & sound effects')} subtitle={t('Toute la musique et tous les bruitages sont composés par le synthétiseur intégré de Studio AI : aucun échantillon tiers, aucune licence à vérifier, utilisables commercialement. Dans un projet, la musique est composée à la durée exacte de la vidéo et mixée automatiquement (ducking sous la voix, −14 LUFS).', 'All music and sound effects are composed by Studio AI’s built-in synthesiser: no third-party samples, commercially usable. In a project, music is composed to the exact length and mixed automatically (ducked under the voice, −14 LUFS).')} />
      <h2 className="mb-3 font-display text-lg font-semibold">{t('Ambiances musicales (aperçus de 30 s)', 'Music moods (30 s previews)')}</h2>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MOODS.filter((m) => m.value !== 'none').map((m) => { const seed = seeds[m.value] ?? 1; return (
          <div key={m.value} className="panel p-4">
            <div className="mb-1 flex items-center gap-2"><Music size={15} className="text-emerald-300" /><span className="font-medium">{t(m.fr, m.en)}</span>
              <button className="btn-ghost btn-sm ml-auto" onClick={() => setSeeds((s) => ({ ...s, [m.value]: (seed % 98) + 1 + 1 }))}><Dice5 size={13} /> {t('Variation', 'Variation')} {seed}</button></div>
            <p className="mb-3 text-xs text-ink-400">{t(DESC[m.value][0], DESC[m.value][1])}</p>
            <audio key={seed} controls preload="none" src={`/api/library/music/${m.value}?seed=${seed}`} className="h-9 w-full" />
          </div>); })}
      </div>
      <h2 className="mb-3 font-display text-lg font-semibold">{t('Bruitages et transitions', 'Sound effects & transitions')}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SFX.map((x) => <div key={x.value} className="panel p-3"><div className="mb-2 text-sm">{t(x.fr, x.en)}</div><audio controls preload="none" src={`/api/library/sfx/${x.value}`} className="h-8 w-full" /></div>)}
      </div>
      <p className="mt-4 text-xs text-ink-500">{t('Le premier aperçu de chaque ambiance prend une à deux secondes à composer, puis il est gardé en cache.', 'The first preview of each mood takes a second or two to compose, then it is cached.')}</p>
    </Page>
  );
}
