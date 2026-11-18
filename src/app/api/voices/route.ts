import { handler, json } from '@/lib/server/http';
import { EDGE_VOICES, ESPEAK_VOICES, OPENAI_VOICES, listElevenVoices, listMacVoices } from '@/lib/engines/voice';

export const runtime = 'nodejs';

export const GET = handler(async (req: Request) => {
  const engine = new URL(req.url).searchParams.get('engine') || 'edge';
  const voices =
    engine === 'edge' ? EDGE_VOICES :
    engine === 'espeak' ? ESPEAK_VOICES :
    engine === 'openai-tts' ? OPENAI_VOICES :
    engine === 'macos-say' ? await listMacVoices() :
    engine === 'elevenlabs' ? await listElevenVoices() : [];
  return json({ engine, voices });
});
