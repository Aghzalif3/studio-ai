// Text engines: brief → script. Server-only (uses secrets).
import Anthropic from '@anthropic-ai/sdk';
import type { Brief } from '../types';
import { getSecret, type SecretName } from '../server/secrets';
import { getSettings } from '../server/settings';
import { buildPrompt, extractJson, type RawScript } from './script-shared';
import { offlineScript } from './offline-writer';

export class EngineError extends Error {
  constructor(message: string, public hint?: string, public status = 400) { super(message); }
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 120_000) {
  let res: Response;
  try { res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }); }
  catch (e: any) { throw new EngineError(`Impossible de joindre ${new URL(url).host} (${e?.cause?.code ?? e?.name ?? 'réseau'}).`, 'Vérifiez votre connexion Internet ou que le service local est lancé.'); }
  const text = await res.text();
  if (!res.ok) throw new EngineError(`${new URL(url).host} a répondu ${res.status} : ${text.slice(0, 300)}`, res.status === 401 || res.status === 403 ? 'Clé API invalide ou manquante : vérifiez-la dans Paramètres › Clés API.' : undefined, res.status);
  try { return JSON.parse(text); } catch { return text; }
}

const OPENAI_COMPAT: Record<string, { baseUrl: string; secret: SecretName; label: string }> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', secret: 'GROQ_API_KEY', label: 'Groq' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', secret: 'OPENROUTER_API_KEY', label: 'OpenRouter' },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', secret: 'MISTRAL_API_KEY', label: 'Mistral' },
  openai: { baseUrl: 'https://api.openai.com/v1', secret: 'OPENAI_API_KEY', label: 'OpenAI' },
};

export async function generateScript(engine: string, b: Brief, styleName: string): Promise<RawScript> {
  const s = await getSettings();
  if (engine === 'offline') return offlineScript(b, styleName);
  const { system, user } = buildPrompt(b, styleName);

  if (engine === 'ollama') {
    const data = await fetchJson(`${s.localUrls.ollama.replace(/\/$/, '')}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: s.textModels.ollama, stream: false, format: 'json', options: { temperature: 0.8 }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    }, 300_000).catch((e) => {
      if (e instanceof EngineError && /joindre/.test(e.message)) throw new EngineError('Ollama ne répond pas.', `Installez Ollama (https://ollama.com), lancez-le, puis : ollama pull ${s.textModels.ollama}`);
      throw e;
    });
    return extractJson(data?.message?.content ?? '');
  }

  if (engine === 'pollinations-text') {
    const token = getSecret('POLLINATIONS_TOKEN');
    const data = await fetchJson('https://text.pollinations.ai/openai', {
      method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ model: 'openai', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } }),
    });
    return extractJson(typeof data === 'string' ? data : data?.choices?.[0]?.message?.content ?? '');
  }

  if (engine === 'openai-compat') {
    const prov = OPENAI_COMPAT[s.textModels.openaiCompat.provider];
    const baseUrl = prov?.baseUrl ?? s.textModels.openaiCompat.baseUrl;
    const key = prov ? getSecret(prov.secret) : getSecret('OPENAI_API_KEY');
    if (!key) throw new EngineError(`Clé ${prov?.label ?? 'API'} manquante.`, `Ajoutez-la dans Paramètres › Clés API (${prov?.secret ?? 'OPENAI_API_KEY'}).`);
    const data = await fetchJson(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: s.textModels.openaiCompat.model, temperature: 0.8, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    return extractJson(data?.choices?.[0]?.message?.content ?? '');
  }

  if (engine === 'anthropic') {
    const key = getSecret('ANTHROPIC_API_KEY');
    if (!key) throw new EngineError('Clé Anthropic manquante.', 'Ajoutez ANTHROPIC_API_KEY dans Paramètres › Clés API.');
    const client = new Anthropic({ apiKey: key });
    try {
      const msg = await client.messages.create({
        model: s.textModels.anthropic, max_tokens: 16000, system,
        messages: [{ role: 'user', content: user }],
      });
      if (msg.stop_reason === 'refusal') throw new EngineError('Claude a refusé ce brief.', 'Reformulez l’idée.');
      const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
      return extractJson(text);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new EngineError('Clé Anthropic invalide.', 'Vérifiez-la dans Paramètres › Clés API.', 401);
      if (e instanceof Anthropic.RateLimitError) throw new EngineError('Limite de débit Anthropic atteinte.', 'Réessayez dans une minute.', 429);
      if (e instanceof Anthropic.APIError) throw new EngineError(`Erreur Anthropic ${e.status} : ${e.message}`);
      throw e;
    }
  }
  throw new EngineError(`Moteur de texte inconnu : ${engine}`);
}

export { fetchJson };
