// API keys: AES-256-GCM encrypted file in the data folder, master key in a separate 0600 file.
// Keys never leave the server; the browser only sees whether a key is set and its last 4 characters.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths';

const KEY_FILE = path.join(DATA_DIR, '.master.key');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.enc.json');

export const SECRET_NAMES = {
  FAL_KEY: 'fal.ai', REPLICATE_API_TOKEN: 'Replicate', STABILITY_API_KEY: 'Stability AI', OPENAI_API_KEY: 'OpenAI',
  ANTHROPIC_API_KEY: 'Anthropic', GROQ_API_KEY: 'Groq', OPENROUTER_API_KEY: 'OpenRouter', MISTRAL_API_KEY: 'Mistral',
  ELEVENLABS_API_KEY: 'ElevenLabs', POLLINATIONS_TOKEN: 'Pollinations', HF_TOKEN: 'Hugging Face',
} as const;
export type SecretName = keyof typeof SECRET_NAMES;

function masterKey(): Buffer {
  if (!fs.existsSync(KEY_FILE)) fs.writeFileSync(KEY_FILE, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'base64');
}

function readAll(): Record<string, string> {
  if (!fs.existsSync(SECRETS_FILE)) return {};
  const { iv, tag, data } = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
  const d = crypto.createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8'));
}

function writeAll(obj: Record<string, string>) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  fs.writeFileSync(SECRETS_FILE, JSON.stringify({ iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }), { mode: 0o600 });
}

export function getSecret(name: SecretName): string | undefined {
  return process.env[name] || readAll()[name] || undefined;
}

export function setSecret(name: SecretName, value: string | null) {
  if (!(name in SECRET_NAMES)) throw new Error('Clé inconnue');
  const all = readAll();
  if (value) all[name] = value.trim(); else delete all[name];
  writeAll(all);
}

export function secretStatus() {
  const stored = readAll();
  return (Object.keys(SECRET_NAMES) as SecretName[]).map((name) => {
    const v = process.env[name] || stored[name];
    return { name, label: SECRET_NAMES[name], set: !!v, source: process.env[name] ? 'env' : stored[name] ? 'stored' : null, hint: v ? `••••${v.slice(-4)}` : '' };
  });
}

export function wipeSecrets() { if (fs.existsSync(SECRETS_FILE)) fs.rmSync(SECRETS_FILE); }
