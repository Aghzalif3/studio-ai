// Transcription locale avec Whisper (transformers.js) : tout tourne dans le navigateur.
// Le modèle (~80 Mo) est téléchargé une seule fois depuis Hugging Face puis gardé en cache.
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const MODEL = 'onnx-community/whisper-base_timestamped';

let asr = null;

async function load(post) {
  if (asr) return asr;
  const { pipeline, env } = await import(LIB);
  env.allowLocalModels = false;
  const files = {};
  const progress = (p) => {
    if (p.status === 'progress' && p.file && p.total) {
      files[p.file] = [p.loaded, p.total];
      let l = 0, t = 0; for (const [a, b] of Object.values(files)) { l += a; t += b; }
      post({ type: 'progress', stage: 'download', value: t ? l / t : 0 });
    }
  };
  const webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator && !!(await navigator.gpu?.requestAdapter?.().catch(() => null));
  try {
    asr = await pipeline('automatic-speech-recognition', MODEL, {
      device: webgpu ? 'webgpu' : 'wasm',
      dtype: webgpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
      progress_callback: progress,
    });
  } catch (e) {
    asr = await pipeline('automatic-speech-recognition', MODEL, { device: 'wasm', dtype: 'q8', progress_callback: progress });
  }
  return asr;
}

self.onmessage = async (e) => {
  const post = (m) => self.postMessage(m);
  const { audio, language } = e.data;
  try {
    const p = await load(post);
    post({ type: 'progress', stage: 'transcribe', value: 0 });
    const opts = { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 };
    if (language) { opts.language = language; opts.task = 'transcribe'; }
    const out = await p(audio, opts);
    const words = (out.chunks || [])
      .map((c) => ({ text: String(c.text || '').trim(), start: c.timestamp?.[0] ?? 0, end: c.timestamp?.[1] ?? (c.timestamp?.[0] ?? 0) + 0.3 }))
      .filter((w) => w.text);
    post({ type: 'done', words, text: out.text || '' });
  } catch (err) {
    post({ type: 'error', message: String(err && err.message ? err.message : err) });
  }
};
