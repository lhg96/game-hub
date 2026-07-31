// 공용 캐릭터 유틸 — 모든 게임에서 재사용하는 작은 애니메이션 캐릭터
// 의존성 0, canvas 2D 기반 (WebGL ❌)

export type CharState = 'idle' | 'happy' | 'sad' | 'excited' | 'surprised' | 'think' | 'angry';

export interface CharHandle {
  canvas: HTMLCanvasElement;
  setState: (s: CharState, dur?: number) => void;
  destroy: () => void;
}

export function createChar(opts?: {
  size?: number;
  color?: string;
  label?: string;
}): CharHandle {
  const size = opts?.size ?? 110;
  const baseColor = opts?.color ?? '#6c8cff';

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.cssText =
    'width:72px;max-width:72px;height:72px;aspect-ratio:1/1;border-radius:12px;background:linear-gradient(160deg,#16203a,#0b0e1a);border:1px solid #2a3150';

  const ctx = canvas.getContext('2d')!;
  let state: CharState = 'idle';
  let timer = 0;
  let t = 0;
  let loop: number | undefined;

  function setState(s: CharState, dur = 600) {
    state = s;
    timer = dur;
  }

  function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function draw() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2 + 8;
    const bob = Math.sin(t / 320) * 3;
    const tt = t / 1000;

    let rot = 0;
    let col = baseColor;
    let eyeY = 0;
    let mouth: 'smile' | 'open' | 'flat' | 'o' = 'smile';
    let blush = false;

    switch (state) {
      case 'happy':
        col = '#5ce16a';
        mouth = 'open';
        blush = true;
        break;
      case 'excited':
        rot = Math.sin(tt * 16) * 0.1;
        col = '#f7d038';
        mouth = 'open';
        blush = true;
        break;
      case 'sad':
        col = '#6c8cff';
        eyeY = 3;
        mouth = 'flat';
        break;
      case 'angry':
        col = '#ff6b6b';
        eyeY = -2;
        mouth = 'flat';
        break;
      case 'surprised':
        col = '#ff9f43';
        mouth = 'o';
        eyeY = -2;
        break;
      case 'think':
        col = '#b06cf0';
        eyeY = 1;
        mouth = 'flat';
        break;
      default:
        eyeY = bob * 0.3;
    }

    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.rotate(rot);

    // 몸
    ctx.fillStyle = col;
    roundRect(ctx, -30, -30, 60, 60, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 눈
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-12, -8 + eyeY, 8, 0, Math.PI * 2);
    ctx.arc(12, -8 + eyeY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16203a';
    const look = state === 'think' ? 2 : 0;
    ctx.beginPath();
    ctx.arc(-12 + look, -6 + eyeY, 4, 0, Math.PI * 2);
    ctx.arc(12 + look, -6 + eyeY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 입
    ctx.strokeStyle = '#16203a';
    ctx.fillStyle = '#16203a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (mouth === 'open') {
      ctx.arc(0, 12, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (mouth === 'o') {
      ctx.arc(0, 10, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (mouth === 'flat') {
      ctx.moveTo(-9, 12);
      ctx.lineTo(9, 12);
      ctx.stroke();
    } else {
      ctx.arc(0, 6, 10, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    // 블러시
    if (blush) {
      ctx.fillStyle = 'rgba(255,120,140,0.5)';
      ctx.beginPath();
      ctx.arc(-20, 4, 4, 0, Math.PI * 2);
      ctx.arc(20, 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // excited 파티클
    if (state === 'excited' || state === 'happy') {
      for (let i = 0; i < 5; i++) {
        const a = (tt * 4 + i) % (Math.PI * 2);
        const rr = 40 + Math.sin(tt * 8 + i) * 8;
        ctx.fillStyle = i % 2 ? '#f7d038' : '#5ce16a';
        ctx.font = '13px serif';
        ctx.fillText('⭐', cx + Math.cos(a) * rr - 6, cy + bob + Math.sin(a) * rr + 4);
      }
    }
  }

  function frame() {
    const now = performance.now();
    if (!t) t = now;
    const dt = now - t;
    t = now;
    if (timer > 0) {
      timer -= dt;
      if (timer <= 0 && state !== 'angry' && state !== 'sad') state = 'idle';
    }
    draw();
    loop = window.setTimeout(frame, 50) as unknown as number;
  }
  loop = window.setTimeout(frame, 50) as unknown as number;

  return {
    canvas,
    setState,
    destroy() {
      if (loop) clearTimeout(loop);
    },
  };
}
