// 게임 공용 헬퍼 — 모든 게임 모듈에서 재사용하는 UI/레이아웃 조각
// 의존성 0, 모바일 최적화. (char.ts/sound.ts 와 함께 사용)
import { createChar, type CharHandle, type CharState } from './char';

export interface GameCommon {
  wrap: HTMLDivElement;
  status: HTMLDivElement;
  char: CharHandle;
}

/** 표준 게임 래퍼 + 상단 캐릭터 행 생성 */
export function createGameShell(opts: {
  charLabel: string;
  charColor?: string;
  maxWidth?: number;
}): GameCommon {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:' +
    (opts.maxWidth ?? 460) +
    'px;margin:0 auto';

  const char = createChar({ color: opts.charColor ?? '#6c8cff', label: opts.charLabel });

  const charRow = document.createElement('div');
  charRow.style.cssText = 'display:flex;align-items:center;gap:8px';
  const charLabel = document.createElement('div');
  charLabel.style.cssText = 'font-size:12px;color:var(--muted);font-weight:600';
  charLabel.textContent = opts.charLabel;
  charRow.append(char.canvas, charLabel);

  const status = document.createElement('div');
  status.style.cssText = 'font-size:14px;color:var(--muted);min-height:20px';

  return { wrap, status, char };
}

/** 컨트롤 버튼 행 생성 (flex wrap) */
export function createButtonRow(): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;width:100%';
  return row;
}

/** 표준 버튼 */
export function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = 'back-btn';
  b.style.cssText = 'font-size:13px;padding:8px 12px';
  b.addEventListener('click', onClick);
  return b;
}

/** 음소거 토글 버튼 */
export function createMuteButton(): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'back-btn';
  // sound 모듈은 런타임에 동적 import 피하기 위해 호출부에서 처리
  return b;
}

/** 터치/마우스 press 헬퍼 (모바일 대응) */
export function bindPress(
  el: HTMLElement,
  onDown: () => void,
  onUp?: () => void
) {
  const down = (e: Event) => {
    e.preventDefault();
    onDown();
  };
  const up = (e: Event) => {
    e.preventDefault();
    onUp?.();
  };
  el.addEventListener('touchstart', down, { passive: false });
  el.addEventListener('mousedown', down);
  if (onUp) {
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }
}

/** requestAnimationFrame 기반 루프 (setTimeout 폴백) */
export function startLoop(step: (dt: number) => void): () => void {
  let raf = 0;
  let last = 0;
  let stopped = false;
  const tick = (now: number) => {
    if (stopped) return;
    if (!last) last = now;
    const dt = now - last;
    last = now;
    step(dt);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/** 모바일 반응형 캔버스 래퍼 (부모 폭에 맞춤, 내부 해상도 고정) */
export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.style.cssText =
    'width:100%;max-width:' + w + 'px;aspect-ratio:' + w + '/' + h +
    ';background:#000;border-radius:8px;border:1px solid #2a3150;touch-action:none;display:block';
  return c;
}

/** 키보드 + 캐릭터 상태 동기 헬퍼 (간편화) */
export function setChar(char: CharHandle, s: CharState, dur = 600) {
  char.setState(s, dur);
}
