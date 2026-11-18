// Image engines: prompt (+ optional reference) → image bytes. Server-only.
import { getSecret } from '../server/secrets';
import { getSettings } from '../server/settings';
import { EngineError, fetchJson } from './text';

export interface ImageRequest { prompt: string; negative?: string; width: number; height: number; seed: number; reference?: { data: Buffer; mime: string } }
export interface ImageResult { data: Buffer; mime: string; ext: string; costUsd: number; model: string }

async function download(url: string): Promise<{ data: Buffer; mime: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new EngineError(`Téléchargement de l’image impossible (${res.status}).`);
  return { data: Buffer.from(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'image/png' };
}
const extOf = (mime: string) => (mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png');
const dataUri = (r: { data: Buffer; mime: string }) => `data:${r.mime};base64,${r.data.toString('base64')}`;

function aspectName(w: number, h: number) {
  const r = w / h;
  const opts: [string, number][] = [['16:9', 16 / 9], ['9:16', 9 / 16], ['1:1', 1], ['4:5', 4 / 5], ['5:4', 5 / 4], ['3:2', 1.5], ['2:3', 2 / 3]];
  return opts.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
}
/** Generation size: about 1 megapixel, multiples of 64. */
export function genSize(w: number, h: number) {
  const k = Math.sqrt((1024 * 1024) / (w * h));
  return { width: Math.round((w * k) / 64) * 64, height: Math.round((h * k) / 64) * 64 };
}

export async function generateImage(engine: string, req: ImageRequest): Promise<ImageResult> {
  const s = await getSettings();
  const { width, height } = genSize(req.width, req.height);
  switch (engine) {
    case 'pollinations': {
      const token = getSecret('POLLINATIONS_TOKEN');
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(req.prompt)}?width=${width}&height=${height}&seed=${req.seed}&model=${encodeURIComponent(s.imageModels.pollinations)}&nologo=true&private=true${req.negative ? `&negative=${encodeURIComponent(req.negative)}` : ''}`;
      const res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(180_000) })
        .catch((e) => { throw new EngineError(`Pollinations injoignable (${e?.cause?.code ?? e.name}).`, 'Vérifiez votre connexion Internet.'); });
      const mime = res.headers.get('content-type') ?? '';
      if (!res.ok || !mime.startsWith('image/')) throw new EngineError(`Pollinations a répondu ${res.status}.`, res.status === 429 ? 'Limite gratuite atteinte : patientez ou ajoutez un jeton gratuit (POLLINATIONS_TOKEN).' : undefined, res.status);
      const data = Buffer.from(await res.arrayBuffer());
      return { data, mime, ext: extOf(mime), costUsd: 0, model: `pollinations/${s.imageModels.pollinations}` };
    }
    case 'sdwebui': {
      const base = s.localUrls.sdwebui.replace(/\/$/, '');
      const body: any = { prompt: req.prompt, negative_prompt: req.negative ?? 'text, watermark, logo, blurry', width, height, seed: req.seed, steps: 24, cfg_scale: 6 };
      const ep = req.reference ? 'img2img' : 'txt2img';
      if (req.reference) { body.init_images = [req.reference.data.toString('base64')]; body.denoising_strength = 0.6; }
      const data = await fetchJson(`${base}/sdapi/v1/${ep}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, 600_000)
        .catch((e) => { if (e instanceof EngineError && /joindre/.test(e.message)) throw new EngineError('Stable Diffusion local ne répond pas.', `Lancez Forge/AUTOMATIC1111 avec --api (adresse actuelle : ${base}).`); throw e; });
      const b64 = data?.images?.[0];
      if (!b64) throw new EngineError('Stable Diffusion n’a renvoyé aucune image.');
      return { data: Buffer.from(b64, 'base64'), mime: 'image/png', ext: 'png', costUsd: 0, model: 'sd-webui' };
    }
    case 'fal': {
      const key = getSecret('FAL_KEY');
      if (!key) throw new EngineError('Clé fal.ai manquante.', 'Ajoutez FAL_KEY dans Paramètres › Clés API (https://fal.ai/dashboard/keys).');
      const withRef = !!req.reference;
      const model = withRef ? 'fal-ai/flux-pro/kontext' : s.imageModels.fal;
      const body: any = withRef
        ? { prompt: req.prompt, image_url: dataUri(req.reference!), aspect_ratio: aspectName(width, height), seed: req.seed }
        : { prompt: req.prompt, image_size: { width, height }, seed: req.seed, num_images: 1, enable_safety_checker: true };
      const data = await fetchJson(`https://fal.run/${model}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${key}` }, body: JSON.stringify(body) }, 300_000);
      const url = data?.images?.[0]?.url;
      if (!url) throw new EngineError('fal.ai n’a renvoyé aucune image.');
      const img = await download(url);
      return { ...img, ext: extOf(img.mime), costUsd: withRef ? 0.04 : 0.003 * Math.max(1, (width * height) / 1e6), model };
    }
    case 'replicate': {
      const key = getSecret('REPLICATE_API_TOKEN');
      if (!key) throw new EngineError('Jeton Replicate manquant.', 'Ajoutez REPLICATE_API_TOKEN dans Paramètres › Clés API.');
      const model = req.reference ? 'black-forest-labs/flux-kontext-pro' : s.imageModels.replicate;
      const input: any = req.reference
        ? { prompt: req.prompt, input_image: dataUri(req.reference), aspect_ratio: aspectName(width, height), seed: req.seed, output_format: 'png' }
        : { prompt: req.prompt, aspect_ratio: aspectName(width, height), seed: req.seed, output_format: 'png', num_outputs: 1 };
      let data = await fetchJson(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, prefer: 'wait=60' }, body: JSON.stringify({ input }),
      });
      const t0 = Date.now();
      while (data?.status && !['succeeded', 'failed', 'canceled'].includes(data.status) && Date.now() - t0 < 300_000) {
        await new Promise((r) => setTimeout(r, 2000));
        data = await fetchJson(data.urls.get, { headers: { authorization: `Bearer ${key}` } });
      }
      if (data?.status !== 'succeeded') throw new EngineError(`Replicate : ${data?.error ?? data?.status ?? 'échec'}`);
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const img = await download(url);
      return { ...img, ext: extOf(img.mime), costUsd: req.reference ? 0.04 : 0.003, model };
    }
    case 'stability': {
      const key = getSecret('STABILITY_API_KEY');
      if (!key) throw new EngineError('Clé Stability manquante.', 'Ajoutez STABILITY_API_KEY dans Paramètres › Clés API.');
      const form = new FormData();
      form.append('prompt', req.prompt);
      if (req.negative) form.append('negative_prompt', req.negative);
      form.append('aspect_ratio', aspectName(width, height));
      form.append('seed', String(req.seed % 4294967294));
      form.append('output_format', 'png');
      const ep = s.imageModels.stability === 'ultra' ? 'ultra' : 'core';
      const res = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${ep}`, { method: 'POST', headers: { authorization: `Bearer ${key}`, accept: 'image/*' }, body: form, signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new EngineError(`Stability a répondu ${res.status} : ${(await res.text()).slice(0, 200)}`, undefined, res.status);
      return { data: Buffer.from(await res.arrayBuffer()), mime: 'image/png', ext: 'png', costUsd: ep === 'ultra' ? 0.08 : 0.03, model: `stability/${ep}` };
    }
    default:
      throw new EngineError(`Le moteur « ${engine} » ne génère pas d’image (le moteur procédural dessine les scènes directement).`);
  }
}

export interface VideoRequest { image: { data: Buffer; mime: string }; prompt: string; durationSec: number; aspect: string }
export interface VideoResult { data: Buffer; mime: string; costUsd: number; model: string }

export async function generateVideo(engine: string, req: VideoRequest): Promise<VideoResult> {
  const s = await getSettings();
  if (engine === 'fal-video') {
    const key = getSecret('FAL_KEY');
    if (!key) throw new EngineError('Clé fal.ai manquante.', 'Ajoutez FAL_KEY dans Paramètres › Clés API.');
    const model = s.videoModels.fal;
    const sub = await fetchJson(`https://queue.fal.run/${model}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${key}` },
      body: JSON.stringify({ prompt: req.prompt, image_url: dataUri(req.image), aspect_ratio: req.aspect, duration: String(Math.round(Math.min(10, Math.max(5, req.durationSec)))) }),
    });
    const t0 = Date.now();
    for (;;) {
      if (Date.now() - t0 > 900_000) throw new EngineError('fal.ai : délai dépassé (15 min).');
      await new Promise((r) => setTimeout(r, 4000));
      const st = await fetchJson(sub.status_url, { headers: { authorization: `Key ${key}` } });
      if (st.status === 'COMPLETED') break;
      if (st.status === 'FAILED' || st.error) throw new EngineError(`fal.ai : ${st.error ?? 'échec'}`);
    }
    const out = await fetchJson(sub.response_url, { headers: { authorization: `Key ${key}` } });
    const url = out?.video?.url;
    if (!url) throw new EngineError('fal.ai n’a renvoyé aucune vidéo.');
    const v = await download(url);
    return { data: v.data, mime: 'video/mp4', costUsd: 0.04 * req.durationSec, model };
  }
  if (engine === 'replicate-video') {
    const key = getSecret('REPLICATE_API_TOKEN');
    if (!key) throw new EngineError('Jeton Replicate manquant.', 'Ajoutez REPLICATE_API_TOKEN dans Paramètres › Clés API.');
    const model = s.videoModels.replicate;
    let data = await fetchJson(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ input: { prompt: req.prompt, image: dataUri(req.image) } }),
    });
    const t0 = Date.now();
    while (!['succeeded', 'failed', 'canceled'].includes(data?.status) && Date.now() - t0 < 900_000) {
      await new Promise((r) => setTimeout(r, 4000));
      data = await fetchJson(data.urls.get, { headers: { authorization: `Bearer ${key}` } });
    }
    if (data?.status !== 'succeeded') throw new EngineError(`Replicate : ${data?.error ?? data?.status}`);
    const url = Array.isArray(data.output) ? data.output[0] : data.output;
    const v = await download(url);
    return { data: v.data, mime: 'video/mp4', costUsd: 0.06 * req.durationSec, model };
  }
  throw new EngineError('Ce moteur ne génère pas de vidéo. L’animation locale est appliquée automatiquement au rendu.');
}
