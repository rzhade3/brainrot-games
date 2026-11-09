import { isPalmFragment, isSplinter, type Mark, type Step, type Tool } from './cases';

type Cue = Tool | 'finish' | 'seal' | 'grip' | 'palm-release' | 'gravel-release' | 'crust-release' | 'abscess-release';
type Texture = readonly [frequency: number, volume: number, resonance: number];
type Tone = readonly [from: number, to: number, volume: number, wave: OscillatorType];

interface Sound {
  duration: number;
  delay?: number;
  texture?: Texture;
  tone?: Tone;
}

const impacts: Partial<Record<Cue, Sound>> = {
  clip: { duration: .048, texture: [4300, .32, 1.1], tone: [1040, 470, .09, 'triangle'] },
  grip: { duration: .027, texture: [3100, .12, 1.4] },
  tweezers: { duration: .075, texture: [3100, .18, 2], tone: [1140, 830, .08, 'sine'] },
  pop: { duration: .16, texture: [470, .17, 1.3], tone: [270, 64, .25, 'sine'] },
  'abscess-release': { duration: .105, tone: [190, 82, .18, 'sine'] },
  'palm-release': { duration: .11, texture: [1250, .15, 1.6], tone: [470, 123, .23, 'sine'] },
  'gravel-release': { duration: .09, texture: [2850, .28, 1.8], tone: [370, 110, .2, 'sine'] },
  'crust-release': { duration: .085, texture: [3450, .22, 2.1] },
  seal: { duration: .065, texture: [650, .09, 1.3], tone: [640, 190, .12, 'sine'] },
  lens: { duration: .17, texture: [930, .13, 1.7], tone: [410, 148, .16, 'sine'] },
  bond: { duration: .09, tone: [530, 770, .11, 'sine'] },
  scoop: { duration: .115, texture: [1750, .26, 1.6], tone: [260, 180, .06, 'triangle'] },
  floss: { duration: .075, texture: [3650, .19, 2.4], tone: [890, 410, .07, 'triangle'] },
  dress: { duration: .13, texture: [1550, .22, .65], tone: [160, 100, .05, 'sine'] },
  drops: { duration: .13, delay: .145, texture: [1100, .09, 1.7], tone: [930, 320, .16, 'sine'] },
  finish: { duration: .28, tone: [660, 990, .11, 'sine'] },
};

const contactSounds: Partial<Record<Tool, Sound>> = {
  file: { duration: .075, texture: [2430, .20, .85] },
  scale: { duration: .060, texture: [3200, .24, 1.4] },
  brush: { duration: .088, texture: [2700, .16, 1.2] },
  wipe: { duration: .088, texture: [1070, .15, .65] },
  cool: { duration: .09, texture: [610, .12, .65] },
  ointment: { duration: .085, texture: [530, .17, 1.8] },
  paint: { duration: .078, texture: [1810, .14, .85] },
  bond: { duration: .085, texture: [880, .16, 1.4] },
  whiten: { duration: .065, texture: [3320, .16, 1.15] },
  lashes: { duration: .075, texture: [1950, .11, 1.8] },
  pop: { duration: .10, texture: [570, .12, 2.4], tone: [125, 87, .05, 'sine'] },
};

let context: AudioContext | undefined;
let output: GainNode | undefined;
let noise: AudioBuffer | undefined;
let contactTool: Tool | undefined;
let lastContactAt = -Infinity;

const recordedTools = ['file', 'clip', 'lens', 'pop'] as const;
const recordings: Record<typeof recordedTools[number], {
  asset: string;
  bytes?: Promise<ArrayBuffer | null>;
  decoding?: boolean;
  buffer?: AudioBuffer;
}> = {
  // CC0. "Sandpaper 1" by 16GPanskaToman_Kristian, https://freesound.org/s/496287/
  file: { asset: 'file-scrapes.wav' },
  // CC0. "nail clipper.wav" by 180007, https://freesound.org/s/445525/
  clip: { asset: 'clipper-snips.wav' },
  // CC0. "Suction Pop" by JoBot__, https://freesound.org/s/523687/
  lens: { asset: 'lens-release.wav' },
  // CC0. "Bottle Pop Wet.wav" by columbia23, https://freesound.org/s/396751/
  pop: { asset: 'drain-pop.wav' },
};
const fileStrokeLength = .26;
const snipLength = .12;
let snip = 0;
let fileStroke = 0;
let lastFileMotion = -Infinity;
let fileVoice: { source: AudioBufferSourceNode; gain: GainNode; end: number; direction: number } | undefined;

export function preloadRecordedSounds(tools: ReadonlySet<Tool>): void {
  for (const tool of recordedTools) {
    if (!tools.has(tool)) continue;
    const recording = recordings[tool];
    if (recording.buffer || recording.bytes || recording.decoding) continue;
    recording.bytes = fetch(`/assets/pop-clinic/${recording.asset}`)
      .then(response => {
        if (!response.ok) throw new Error(`Recording request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .catch(() => {
        recording.bytes = undefined;
        return null;
      });
  }
  decodeRecordings();
}

function decodeRecordings(): void {
  const audio = context;
  if (!audio) return;
  for (const tool of recordedTools) {
    const recording = recordings[tool];
    if (!recording.bytes || recording.decoding || recording.buffer) continue;
    recording.decoding = true;
    void recording.bytes.then(bytes => bytes ? audio.decodeAudioData(bytes) : undefined)
      .then(buffer => { recording.buffer = buffer; })
      .catch(() => { /* Keep the synthesized cue available until a later retry. */ })
      .finally(() => {
        recording.bytes = undefined;
        recording.decoding = false;
      });
  }
}

export function unlockAudio(): void {
  try {
    if (!context) {
      context = new AudioContext();
      output = context.createGain();
      output.connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume().catch(() => {});
    decodeRecordings();
  } catch { /* The game can be played silently. */ }
}

export function setSoundEnabled(enabled: boolean): void {
  if (output) output.gain.value = enabled ? 1 : 0;
  if (!enabled) stopFileContact();
}

export function playFileContact(distance: number, direction: number): void {
  if (distance < .6 || context?.state !== 'running' || !output) return;
  const fileBuffer = recordings.file.buffer;
  if (!fileBuffer) {
    playContact('file', distance);
    return;
  }
  const audio = context;
  const now = audio.currentTime;
  const elapsed = now - lastFileMotion;
  const speed = distance / (elapsed > .09 ? 1 / 60 : Math.max(elapsed, 1 / 120));
  if (!fileVoice || now >= fileVoice.end - .018 || elapsed > .09 || direction !== fileVoice.direction) {
    stopFileContact();
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = 0;
    source.buffer = fileBuffer;
    source.connect(gain).connect(output);
    source.start(now, fileStroke * fileStrokeLength, fileStrokeLength);
    fileStroke = (fileStroke + 1) % 4;
    fileVoice = { source, gain, end: now + fileStrokeLength, direction };
  }
  lastFileMotion = now;
  const gain = fileVoice.gain.gain;
  gain.cancelScheduledValues(now);
  gain.setTargetAtTime(.28 + .55 * Math.min(1, speed / 520), now, .008);
  gain.setTargetAtTime(0, Math.min(now + .05, fileVoice.end - .014), .009);
}

export function stopFileContact(): void {
  lastFileMotion = -Infinity;
  const active = fileVoice;
  fileVoice = undefined;
  if (!context || !active || context.currentTime >= active.end) return;
  const now = context.currentTime;
  active.gain.gain.cancelScheduledValues(now);
  active.gain.gain.setTargetAtTime(0, now, .007);
  active.source.stop(Math.min(now + .035, active.end));
}

export function treatmentImpact(step: Step, cut?: Mark): Cue | undefined {
  if (step.action === 'hold') return;
  if (cut) return 'clip';
  if (step.action === 'pull') {
    if (step.mark === 'piercing-crust') return 'crust-release';
    if (isPalmFragment(step.mark)) return isSplinter(step.mark) ? 'palm-release' : 'gravel-release';
  }
  return step.tool;
}

export function playSound(cue: Cue): void {
  if ((cue === 'clip' || cue === 'lens' || cue === 'pop') && playRecordedImpact(cue)) return;
  const sound = impacts[cue === 'abscess-release' && !playRecordedImpact('pop', .84) ? 'pop' : cue];
  if (sound) renderSound(sound, .004, 1);
}

function playRecordedImpact(cue: 'clip' | 'lens' | 'pop', rate = 1): boolean {
  const buffer = recordings[cue].buffer;
  if (context?.state !== 'running' || !output || !buffer) return false;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  source.connect(output);
  if (cue === 'clip') {
    source.start(context.currentTime, snip * snipLength, snipLength);
    snip = (snip + 1) % 3;
  } else {
    source.start(context.currentTime);
  }
  return true;
}

export function playContact(tool: Tool, distance: number): void {
  const sound = contactSounds[tool];
  if (!sound || context?.state !== 'running' || distance < .6) return;
  const now = context.currentTime;
  if (tool === contactTool && now - lastContactAt < sound.duration * .62) return;
  contactTool = tool;
  lastContactAt = now;
  renderSound(sound, .015, .62 + Math.min(.38, distance / 30));
}

function renderSound({ duration, delay = 0, tone, texture }: Sound, attack: number, strength: number): void {
  if (context?.state !== 'running' || !output) return;
  const audio = context;
  const destination = output;
  const now = audio.currentTime + delay;
  const end = now + duration;

  function connectEnvelope(source: AudioNode, volume: number): void {
    const envelope = audio.createGain();
    envelope.gain.setValueAtTime(.001, now);
    envelope.gain.exponentialRampToValueAtTime(volume * strength, now + attack);
    envelope.gain.exponentialRampToValueAtTime(.001, end);
    source.connect(envelope).connect(destination);
  }

  if (tone) {
    const [from, to, volume, wave] = tone;
    const oscillator = audio.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, end);
    connectEnvelope(oscillator, volume);
    oscillator.start(now);
    oscillator.stop(end);
  }
  if (texture) {
    const [frequency, volume, resonance] = texture;
    if (!noise) {
      noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const channel = noise.getChannelData(0);
      for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
    }
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    source.buffer = noise;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = resonance;
    source.connect(filter);
    connectEnvelope(filter, volume);
    source.start(now, Math.random() * .6);
    source.stop(end);
  }
}
