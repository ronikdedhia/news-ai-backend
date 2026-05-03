import { config } from '../config';
import { logger } from '../utils/logger';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

class TtsService {
  private voiceId: string | null = null;

  private async resolveVoiceId(): Promise<string> {
    if (this.voiceId) return this.voiceId;

    const raw = config.elevenlabs.voice;
    if (!raw) throw new Error('ELEVENLABS_VOICE not configured');

    // ElevenLabs voice IDs are ~20-char alphanumeric strings
    if (/^[a-zA-Z0-9]{15,30}$/.test(raw)) {
      this.voiceId = raw;
      return raw;
    }

    // Resolve by name from the voices list
    const res = await fetch(`${ELEVENLABS_API}/voices`, {
      headers: { 'xi-api-key': config.elevenlabs.apiKey },
    });

    if (!res.ok) {
      logger.warn(`ElevenLabs voices list failed (${res.status}), using raw value`);
      this.voiceId = raw;
      return raw;
    }

    const data = await res.json() as { voices: Array<{ voice_id: string; name: string }> };
    const match = data.voices?.find(v => v.name.toLowerCase() === raw.toLowerCase());

    if (match) {
      logger.info(`ElevenLabs: resolved voice "${raw}" → ${match.voice_id}`);
      this.voiceId = match.voice_id;
    } else {
      logger.warn(`ElevenLabs: voice "${raw}" not found by name, using as ID`);
      this.voiceId = raw;
    }

    return this.voiceId!;
  }

  async synthesize(text: string): Promise<Buffer> {
    if (!config.elevenlabs.apiKey) throw new Error('ELEVENLABS_API_KEY not configured');

    const voiceId = await this.resolveVoiceId();
    const truncated = text.slice(0, 5000);

    const res = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': config.elevenlabs.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: truncated,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs API ${res.status}: ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export const ttsService = new TtsService();
