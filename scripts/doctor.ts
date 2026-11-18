// Checks what Studio AI can use on this computer. Run: npm run doctor
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { FFMPEG, FFPROBE } from '../src/lib/server/ffmpeg';
import { DATA_DIR } from '../src/lib/server/paths';
import { FONT_FILES } from '../src/lib/server/node-render';

const pexec = promisify(execFile);
const ok = (m: string) => console.log(`  ✅ ${m}`);
const ko = (m: string, fix?: string) => console.log(`  ⚠️  ${m}${fix ? `\n      → ${fix}` : ''}`);
const has = async (cmd: string, args: string[]) => { try { await pexec(cmd, args, { timeout: 5000 }); return true; } catch { return false; } };
const reach = async (url: string) => { try { const r = await fetch(url, { signal: AbortSignal.timeout(4000) }); return r.status < 500; } catch { return false; } };

console.log('\nStudio AI — vérification de l’installation\n');
const major = parseInt(process.versions.node);
major >= 20 ? ok(`Node.js ${process.versions.node}`) : ko(`Node.js ${process.versions.node} (20 ou plus requis)`, 'brew install node');
(await has(FFMPEG, ['-version'])) ? ok(`FFmpeg : ${FFMPEG}`) : ko('FFmpeg introuvable', 'npm install (paquet ffmpeg-static) ou brew install ffmpeg');
(await has(FFPROBE, ['-version'])) ? ok('FFprobe') : ko('FFprobe introuvable', 'npm install');
try { await import('@napi-rs/canvas'); ok('Moteur de rendu (Skia)'); } catch { ko('@napi-rs/canvas ne se charge pas', 'rm -rf node_modules && npm install'); }
const missing = Object.values(FONT_FILES).filter((f) => !fs.existsSync(`public/fonts/${f}`));
missing.length ? ko(`Polices manquantes : ${missing.join(', ')}`) : ok(`${Object.keys(FONT_FILES).length} polices`);
try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.accessSync(DATA_DIR, fs.constants.W_OK); ok(`Dossier de données : ${DATA_DIR}`); } catch { ko(`Impossible d’écrire dans ${DATA_DIR}`); }

console.log('\nMoteurs gratuits');
(await reach('https://speech.platform.bing.com')) ? ok('Edge TTS joignable (voix neuronales)') : ko('Edge TTS injoignable (pas d’Internet ?)', 'Utilisez les voix macOS ou eSpeak hors-ligne');
process.platform === 'darwin' ? ((await has('say', ['-v', '?'])) ? ok('Voix macOS (say)') : ko('Commande say indisponible')) : ko('Voix macOS : uniquement sur Mac');
(await has('espeak-ng', ['--version'])) ? ok('eSpeak NG') : ko('eSpeak NG non installé (facultatif)', 'brew install espeak-ng');
const ollama = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
(await reach(`${ollama}/api/tags`)) ? ok(`Ollama sur ${ollama}`) : ko('Ollama non lancé (facultatif, pour un vrai scénario IA gratuit)', 'Installer depuis ollama.com puis : ollama pull llama3.2');
const sd = process.env.SD_WEBUI_URL || 'http://127.0.0.1:7860';
(await reach(`${sd}/sdapi/v1/sd-models`)) ? ok(`Stable Diffusion sur ${sd}`) : ko('Stable Diffusion local non lancé (facultatif)', 'Forge ou AUTOMATIC1111 avec --api');
(await reach('https://image.pollinations.ai')) ? ok('Pollinations joignable') : ko('Pollinations injoignable');
console.log('\nLes clés API (facultatives) se règlent dans l’application : Paramètres › Clés API.\n');
