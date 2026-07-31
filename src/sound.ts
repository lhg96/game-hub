// 공통 효과음 엔진 (외부 파일 없이 Web Audio API로 합성).
// 모든 게임에서 import 해서 playXxx() 호출. 첫 사용자 입력에서 AudioContext 활성화.

let ctx: AudioContext | null = null;
let muted = localStorage.getItem('sound.muted') === '1';

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

function tone({ freq, dur, type = 'sine', gain = 0.18, delay = 0, slideTo }: ToneOpts) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.2, delay = 0) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(g).connect(c.destination);
  src.start(t0);
}

export const sound = {
  isMuted: () => muted,
  toggleMute(): boolean {
    muted = !muted;
    localStorage.setItem('sound.muted', muted ? '1' : '0');
    return muted;
  },
  // 두더지 등장: 짧은 상승 블립
  pop() {
    tone({ freq: 420, slideTo: 720, dur: 0.12, type: 'triangle', gain: 0.16 });
  },
  // 타격: 묵직한 툭 + 노이즈
  hit() {
    tone({ freq: 180, slideTo: 90, dur: 0.12, type: 'square', gain: 0.22 });
    noise(0.08, 0.15);
  },
  // 놓침/빗나감: 낮은 버즈
  miss() {
    tone({ freq: 160, dur: 0.18, type: 'sawtooth', gain: 0.12 });
  },
  // 시작: 상행 아르페지오
  start() {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.14, type: 'triangle', gain: 0.16, delay: i * 0.09 })
    );
  },
  // 게임 종료: 하행 톤
  gameOver() {
    [784, 587, 440, 330].forEach((f, i) =>
      tone({ freq: f, dur: 0.2, type: 'sine', gain: 0.18, delay: i * 0.12 })
    );
  },
  // 콤보 보너스
  combo(level: number) {
    tone({ freq: 660 + level * 80, slideTo: 990 + level * 80, dur: 0.1, type: 'square', gain: 0.14 });
  },
  // 테트리스 효과음
  tetrisMove() {
    tone({ freq: 320, dur: 0.04, type: 'square', gain: 0.08 });
  },
  tetrisRotate() {
    tone({ freq: 480, slideTo: 600, dur: 0.07, type: 'triangle', gain: 0.1 });
  },
  tetrisDrop() {
    tone({ freq: 240, slideTo: 120, dur: 0.09, type: 'square', gain: 0.14 });
  },
  tetrisClear(n: number) {
    // 라인 수에 따라 상행 아르페지오
    const base = [523, 659, 784, 1046, 1318];
    for (let i = 0; i < Math.min(n, 4); i++)
      tone({ freq: base[i], dur: 0.12, type: 'triangle', gain: 0.16, delay: i * 0.06 });
    if (n >= 4) tone({ freq: 1568, dur: 0.25, type: 'sine', gain: 0.2, delay: 0.24 });
  },
  tetrisLevelUp() {
    [659, 880, 1175].forEach((f, i) =>
      tone({ freq: f, dur: 0.12, type: 'square', gain: 0.14, delay: i * 0.07 })
    );
  },
  // 스도쿠 효과음
  sudokuNote() {
    tone({ freq: 880, dur: 0.05, type: 'sine', gain: 0.07 });
  },
  sudokuWrite() {
    tone({ freq: 520, slideTo: 660, dur: 0.06, type: 'triangle', gain: 0.1 });
  },
  sudokuError() {
    tone({ freq: 200, slideTo: 130, dur: 0.16, type: 'sawtooth', gain: 0.14 });
  },
  sudokuWin() {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.16, delay: i * 0.1 })
    );
  },
  sudokuSelect() {
    tone({ freq: 440, dur: 0.03, type: 'sine', gain: 0.05 });
  },
  // 범용 캐릭터/게임 효과음
  blip() {
    tone({ freq: 600, dur: 0.05, type: 'square', gain: 0.08 });
  },
  tap() {
    tone({ freq: 520, slideTo: 680, dur: 0.05, type: 'triangle', gain: 0.1 });
  },
  cheer() {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.14, type: 'triangle', gain: 0.14, delay: i * 0.07 })
    );
  },
  sad() {
    [440, 370, 294].forEach((f, i) =>
      tone({ freq: f, dur: 0.16, type: 'sawtooth', gain: 0.12, delay: i * 0.1 })
    );
  },
  jump() {
    tone({ freq: 300, slideTo: 620, dur: 0.12, type: 'square', gain: 0.12 });
  },
  win() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) =>
      tone({ freq: f, dur: 0.15, type: 'triangle', gain: 0.15, delay: i * 0.09 })
    );
  },
  coin() {
    tone({ freq: 988, dur: 0.06, type: 'square', gain: 0.12 });
    tone({ freq: 1318, dur: 0.1, type: 'square', gain: 0.12, delay: 0.06 });
  },
};
