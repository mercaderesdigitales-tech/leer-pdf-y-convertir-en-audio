/**
 * Local in-browser TTS synthesizer powered by eSpeak / meSpeak.
 * 100% offline, zero network requests, zero OPFS dependencies.
 * Produces authentic Spanish (Spain & Latin America), Catalan and English phonemes.
 */
// @ts-ignore - mespeak has no official types
import meSpeak from 'mespeak';
// @ts-ignore
import mespeakConfig from 'mespeak/src/mespeak_config.json';
// @ts-ignore
import esVoice from 'mespeak/voices/es.json';
// @ts-ignore
import esLaVoice from 'mespeak/voices/es-la.json';
// @ts-ignore
import caVoice from 'mespeak/voices/ca.json';
// @ts-ignore
import enVoice from 'mespeak/voices/en/en.json';

let isConfigLoaded = false;
const loadedVoices = new Set<string>();

export interface LocalVoiceConfig {
  id: string;
  name: string;
  lang: string;
  voiceData: any;
  flag: string;
  description: string;
  recommended?: boolean;
}

export const LOCAL_VOICES: Record<string, LocalVoiceConfig> = {
  'es': {
    id: 'es',
    name: 'Español (España) - Voz Castellana',
    lang: 'es-ES',
    voiceData: esVoice,
    flag: '🇪🇸',
    description: 'Pronunciación nativa en castellano. Ultrarrápida y 100% offline.',
    recommended: true,
  },
  'es-la': {
    id: 'es-la',
    name: 'Español (Latinoamérica) - Neutro',
    lang: 'es-LA',
    voiceData: esLaVoice,
    flag: '🇲🇽',
    description: 'Cadencia neutra para América Latina. Ultrarrápida y 100% offline.',
  },
  'ca': {
    id: 'ca',
    name: 'Català - Veu en Català',
    lang: 'ca-ES',
    voiceData: caVoice,
    flag: '🇦🇩',
    description: 'Pronunciació en català. Ultraràpida i 100% local.',
  },
  'en': {
    id: 'en',
    name: 'English (US) - Fast Narrator',
    lang: 'en-US',
    voiceData: enVoice,
    flag: '🇺🇸',
    description: 'Instant client-side English speech.',
  },
};

/**
 * Initializes the meSpeak virtual filesystem and loads the requested voice
 */
export function initLocalTts(voiceId: string = 'es'): void {
  if (!isConfigLoaded) {
    try {
      meSpeak.loadConfig(mespeakConfig);
      isConfigLoaded = true;
    } catch (err) {
      console.warn('meSpeak loadConfig error:', err);
    }
  }

  const voiceConfig = LOCAL_VOICES[voiceId] || LOCAL_VOICES['es'];
  if (!loadedVoices.has(voiceConfig.id)) {
    try {
      meSpeak.loadVoice(voiceConfig.voiceData);
      loadedVoices.add(voiceConfig.id);
    } catch (err) {
      console.warn(`meSpeak loadVoice error for ${voiceConfig.id}:`, err);
    }
  }
}

/**
 * Synthesizes a text string into a 16-bit PCM WAV Blob using meSpeak
 */
export async function synthesizeLocalSentence(
  text: string,
  voiceId: string = 'es',
  speedMultiplier: number = 1.0
): Promise<Blob> {
  initLocalTts(voiceId);

  const cleanText = text.trim();
  if (!cleanText) {
    // Generate 0.1s silence
    const emptyPcm = new Int16Array(2205);
    return new Blob([emptyPcm.buffer], { type: 'audio/wav' });
  }

  const voiceConfig = LOCAL_VOICES[voiceId] || LOCAL_VOICES['es'];
  // Convert speed: meSpeak speed is words-per-minute (default ~175)
  const speedWpm = Math.round(175 * Math.max(0.6, Math.min(2.0, speedMultiplier)));

  try {
    const arrayBuffer: ArrayBuffer | null = meSpeak.speak(cleanText, {
      voice: voiceConfig.id,
      speed: speedWpm,
      pitch: 50,
      wordgap: 1,
      rawdata: 'arrayBuffer',
    });

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error(`meSpeak no devolvió datos para la frase: "${cleanText.slice(0, 30)}..."`);
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  } catch (err: any) {
    console.error('Error al sintetizar con meSpeak:', err);
    throw new Error(err?.message || 'Error en la síntesis local del texto.');
  }
}
