import { execFile } from 'node:child_process';
import { handler, json } from '@/lib/server/http';
import { ENGINES } from '@/lib/engines/catalog';
import { getSecret, type SecretName } from '@/lib/server/secrets';
import { getSettings } from '@/lib/server/settings';
import { hasEspeak } from '@/lib/engines/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ping(url: string, ms = 1500) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(ms) }); return r.ok ? await r.json().catch(() => ({})) : null; } catch { return null; }
}
const hasSay = () => new Promise<boolean>((res) => process.platform !== 'darwin' ? res(false) : execFile('say', ['-v', '?'], (e) => res(!e)));

/** Engine catalogue + real availability on this machine (key set, local server reachable, binary installed). */
export const GET = handler(async () => {
  const s = await getSettings();
  const [ollama, sd, espeak, say] = await Promise.all([
    ping(`${s.localUrls.ollama.replace(/\/$/, '')}/api/tags`),
    ping(`${s.localUrls.sdwebui.replace(/\/$/, '')}/sdapi/v1/sd-models`),
    hasEspeak(), hasSay(),
  ]);
  const compatKey: Record<string, SecretName> = { groq: 'GROQ_API_KEY', openrouter: 'OPENROUTER_API_KEY', mistral: 'MISTRAL_API_KEY', openai: 'OPENAI_API_KEY' };
  const items = ENGINES.map((e) => {
    let ready = true, reason = '';
    if (e.id === 'ollama') { ready = !!ollama; reason = ready ? `${(ollama.models ?? []).length} modèle(s) installé(s)` : `Ollama ne répond pas sur ${s.localUrls.ollama}`; }
    else if (e.id === 'sdwebui') { ready = !!sd; reason = ready ? 'Serveur Stable Diffusion détecté' : `Aucun serveur sur ${s.localUrls.sdwebui} (lancer avec --api)`; }
    else if (e.id === 'espeak') { ready = espeak; reason = ready ? 'Installé' : 'espeak-ng non installé'; }
    else if (e.id === 'macos-say') { ready = say; reason = ready ? 'Disponible' : 'Disponible uniquement sur macOS'; }
    else if (e.id === 'openai-compat') { const k = compatKey[s.textModels.openaiCompat.provider]; ready = !k || !!getSecret(k); reason = ready ? `Fournisseur : ${s.textModels.openaiCompat.provider}` : `Clé ${k} manquante`; }
    else if (e.needs && e.tier !== 'free-limited') { ready = !!getSecret(e.needs as SecretName); reason = ready ? 'Clé configurée' : `Clé ${e.needs} manquante (Paramètres › Clés API)`; }
    else if (!e.local) reason = 'Service en ligne : nécessite Internet';
    return { ...e, ready, reason };
  });
  return json({ items, ollamaModels: (ollama?.models ?? []).map((m: any) => m.name), selected: s.engines });
});
