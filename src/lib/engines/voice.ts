// Voice engines: text → WAV + word timings. Server-only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WordTiming } from '../types';
import { estimateWordTimings } from '../project';
import { getSecret } from '../server/secrets';
import { probe, toWav } from '../server/ffmpeg';
import { TMP_DIR } from '../server/paths';
import { EngineError } from './text';
import { uid } from '../util';

const pexec = promisify(execFile);

export interface VoiceOption { id: string; name: string; lang: string; gender: 'F' | 'M'; engine: string; note?: string }

export const EDGE_VOICES: VoiceOption[] = [
  ['fr-FR-DeniseNeural', 'Denise', 'fr-FR', 'F'], ['fr-FR-HenriNeural', 'Henri', 'fr-FR', 'M'], ['fr-FR-EloiseNeural', 'Éloïse', 'fr-FR', 'F'],
  ['fr-FR-VivienneMultilingualNeural', 'Vivienne (multilingue)', 'fr-FR', 'F'], ['fr-FR-RemyMultilingualNeural', 'Rémy (multilingue)', 'fr-FR', 'M'],
  ['fr-BE-CharlineNeural', 'Charline (Belgique)', 'fr-BE', 'F'], ['fr-BE-GerardNeural', 'Gérard (Belgique)', 'fr-BE', 'M'],
  ['fr-CA-SylvieNeural', 'Sylvie (Québec)', 'fr-CA', 'F'], ['fr-CA-AntoineNeural', 'Antoine (Québec)', 'fr-CA', 'M'], ['fr-CA-JeanNeural', 'Jean (Québec)', 'fr-CA', 'M'],
  ['fr-CH-ArianeNeural', 'Ariane (Suisse)', 'fr-CH', 'F'], ['fr-CH-FabriceNeural', 'Fabrice (Suisse)', 'fr-CH', 'M'],
  ['en-US-AriaNeural', 'Aria', 'en-US', 'F'], ['en-US-GuyNeural', 'Guy', 'en-US', 'M'], ['en-US-JennyNeural', 'Jenny', 'en-US', 'F'], ['en-US-AndrewMultilingualNeural', 'Andrew', 'en-US', 'M'],
  ['en-GB-SoniaNeural', 'Sonia', 'en-GB', 'F'], ['en-GB-RyanNeural', 'Ryan', 'en-GB', 'M'],
  ['es-ES-ElviraNeural', 'Elvira', 'es-ES', 'F'], ['es-ES-AlvaroNeural', 'Álvaro', 'es-ES', 'M'], ['es-MX-DaliaNeural', 'Dalia', 'es-MX', 'F'], ['es-MX-JorgeNeural', 'Jorge', 'es-MX', 'M'],
  ['ar-SA-ZariyahNeural', 'Zariyah', 'ar-SA', 'F'], ['ar-SA-HamedNeural', 'Hamed', 'ar-SA', 'M'], ['ar-MA-MounaNeural', 'Mouna (Maroc)', 'ar-MA', 'F'], ['ar-MA-JamalNeural', 'Jamal (Maroc)', 'ar-MA', 'M'],
  ['ar-EG-SalmaNeural', 'Salma (Égypte)', 'ar-EG', 'F'], ['ar-EG-ShakirNeural', 'Shakir (Égypte)', 'ar-EG', 'M'],
].map(([id, name, lang, gender]) => ({ id, name, lang, gender: gender as 'F' | 'M', engine: 'edge' }));

export const ESPEAK_VOICES: VoiceOption[] = [
  ['fr-fr', 'Français (France)', 'fr-FR', 'M'], ['fr-be', 'Français (Belgique)', 'fr-BE', 'M'], ['fr-ch', 'Français (Suisse)', 'fr-CH', 'M'],
  ['fr-fr+f3', 'Français (voix féminine)', 'fr-FR', 'F'], ['en-us', 'English (US)', 'en-US', 'M'], ['en-gb', 'English (UK)', 'en-GB', 'M'],
  ['es', 'Español', 'es-ES', 'M'], ['ar', 'العربية', 'ar-SA', 'M'],
].map(([id, name, lang, gender]) => ({ id, name, lang, gender: gender as 'F' | 'M', engine: 'espeak' }));

export const OPENAI_VOICES: VoiceOption[] = ['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer']
  .map((v) => ({ id: v, name: v, lang: 'multi', gender: ['echo', 'onyx', 'ash', 'fable'].includes(v) ? 'M' as const : 'F' as const, engine: 'openai-tts' }));

export async function listMacVoices(): Promise<VoiceOption[]> {
  if (process.platform !== 'darwin') return [];
  try {
    const { stdout } = await pexec('say', ['-v', '?']);
    return stdout.split('\n').map((l) => l.match(/^(.+?)\s{2,}([a-z]{2}[_-][A-Z]{2})/)).filter(Boolean)
      .map((m) => ({ id: m![1].trim(), name: m![1].trim(), lang: m![2].replace('_', '-'), gender: 'F' as const, engine: 'macos-say' }))
      .filter((v) => /^(fr|en|es|ar)/.test(v.lang));
  } catch { return []; }
}

export async function listElevenVoices(): Promise<VoiceOption[]> {
  const key = getSecret('ELEVENLABS_API_KEY');
  if (!key) return [];
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    return (j.voices ?? []).map((v: any) => ({ id: v.voice_id, name: v.name, lang: 'multi', gender: v.labels?.gender === 'male' ? 'M' : 'F', engine: 'elevenlabs' }));
  } catch { return []; }
}

export async function hasEspeak() {
  try { await pexec('espeak-ng', ['--version']); return true; } catch { return false; }
}

export interface TtsRequest { engine: string; voice: string; text: string; rate: number; pitch: number; lang: string }
export interface TtsResult { wavPath: string; duration: number; words: WordTiming[]; costUsd: number }

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Synthesises one line to a trimmed mono 48 kHz WAV in the temp folder. */
export async function synthesize(r: TtsRequest): Promise<TtsResult> {
  const text = r.text.trim();
  if (!text) throw new EngineError('Le texte de narration est vide.');
  const id = uid('tts_');
  const raw = path.join(TMP_DIR, `${id}.raw`);
  const wav = path.join(TMP_DIR, `${id}.wav`);
  let words: WordTiming[] | null = null;
  let cost = 0;
  try {
    switch (r.engine) {
      case 'edge': {
        const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
        const tts = new MsEdgeTTS();
        await tts.setMetadata(r.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
        const { audioStream, metadataStream } = tts.toStream(xmlEscape(text), { rate: `${r.rate >= 0 ? '+' : ''}${Math.round(r.rate)}%`, pitch: `${r.pitch >= 0 ? '+' : ''}${Math.round(r.pitch)}Hz` });
        const chunks: Buffer[] = [], meta: string[] = [];
        metadataStream?.on('data', (d: Buffer) => meta.push(d.toString()));
        await new Promise<void>((resolve, reject) => {
          const to = setTimeout(() => reject(new EngineError('Edge TTS ne répond pas (délai de 60 s).', 'Vérifiez votre connexion Internet.')), 60_000);
          audioStream.on('data', (d: Buffer) => chunks.push(d));
          audioStream.on('end', () => { clearTimeout(to); resolve(); });
          audioStream.on('error', (e: any) => { clearTimeout(to); reject(new EngineError(`Edge TTS : ${e?.message ?? e}`, 'Vérifiez votre connexion Internet, ou choisissez une voix locale (macOS / eSpeak).')); });
        });
        try { tts.close(); } catch { /* ignore */ }
        if (!chunks.length) throw new EngineError('Edge TTS n’a renvoyé aucun son.', 'Vérifiez le nom de la voix et votre connexion.');
        await fs.promises.writeFile(raw, Buffer.concat(chunks));
        const wb: WordTiming[] = [];
        for (const m of meta) {
          try {
            const j = JSON.parse(m);
            for (const it of j.Metadata ?? []) if (it.Type === 'WordBoundary') {
              const start = it.Data.Offset / 1e7, d = it.Data.Duration / 1e7;
              wb.push({ text: it.Data.text?.Text ?? '', start, end: start + d });
            }
          } catch { /* partial chunk */ }
        }
        if (wb.length) words = wb;
        break;
      }
      case 'macos-say': {
        if (process.platform !== 'darwin') throw new EngineError('Les voix macOS ne sont disponibles que sur Mac.');
        const wpm = Math.round(185 * (1 + r.rate / 100));
        await pexec('say', ['-v', r.voice, '-r', String(wpm), '-o', raw + '.aiff', text]);
        await fs.promises.rename(raw + '.aiff', raw);
        break;
      }
      case 'espeak': {
        if (!(await hasEspeak())) throw new EngineError('eSpeak NG n’est pas installé.', 'Sur Mac : brew install espeak-ng');
        await pexec('espeak-ng', ['-v', r.voice, '-s', String(Math.round(160 * (1 + r.rate / 100))), '-p', String(Math.max(0, Math.min(99, 50 + r.pitch))), '-w', raw, text]);
        break;
      }
      case 'elevenlabs': {
        const key = getSecret('ELEVENLABS_API_KEY');
        if (!key) throw new EngineError('Clé ElevenLabs manquante.', 'Ajoutez ELEVENLABS_API_KEY dans Paramètres › Clés API.');
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(r.voice)}/with-timestamps?output_format=mp3_44100_128`, {
          method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
          body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, 1 + r.rate / 100)) } }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new EngineError(`ElevenLabs a répondu ${res.status} : ${(await res.text()).slice(0, 200)}`);
        const j = await res.json();
        await fs.promises.writeFile(raw, Buffer.from(j.audio_base64, 'base64'));
        const al = j.alignment;
        if (al?.characters) {
          const ws: WordTiming[] = []; let cur = '', st = 0;
          al.characters.forEach((ch: string, i: number) => {
            if (/\s/.test(ch)) { if (cur) ws.push({ text: cur, start: st, end: al.character_end_times_seconds[i - 1] }); cur = ''; }
            else { if (!cur) st = al.character_start_times_seconds[i]; cur += ch; }
          });
          if (cur) ws.push({ text: cur, start: st, end: al.character_end_times_seconds.at(-1) });
          words = ws;
        }
        cost = (text.length / 1000) * 0.24;
        break;
      }
      case 'openai-tts': {
        const key = getSecret('OPENAI_API_KEY');
        if (!key) throw new EngineError('Clé OpenAI manquante.', 'Ajoutez OPENAI_API_KEY dans Paramètres › Clés API.');
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: r.voice, input: text, response_format: 'wav', speed: Math.min(4, Math.max(0.25, 1 + r.rate / 100)) }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new EngineError(`OpenAI a répondu ${res.status} : ${(await res.text()).slice(0, 200)}`);
        await fs.promises.writeFile(raw, Buffer.from(await res.arrayBuffer()));
        cost = (text.length / 1000) * 0.015;
        break;
      }
      default: throw new EngineError(`Moteur de voix inconnu : ${r.engine}`);
    }
    // Edge timings are relative to the untrimmed audio: keep leading silence for Edge so they stay aligned.
    await toWav(raw, wav, { trim: r.engine !== 'edge' });
    const { duration } = await probe(wav);
    return { wavPath: wav, duration, words: words ?? estimateWordTimings(text, Math.max(0.3, duration - 0.1), 0.05), costUsd: cost };
  } finally {
    fs.promises.rm(raw, { force: true }).catch(() => {});
  }
}

/** For uploaded / recorded voice: convert and estimate timings from the scene text. */
export async function importVoice(input: string, text: string): Promise<TtsResult> {
  const wav = path.join(TMP_DIR, `${uid('rec_')}.wav`);
  await toWav(input, wav, { trim: true });
  const { duration } = await probe(wav);
  return { wavPath: wav, duration, words: estimateWordTimings(text, Math.max(0.3, duration - 0.1), 0.05), costUsd: 0 };
}

export const tmpdir = os.tmpdir;
