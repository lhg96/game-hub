import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';
import { createChar } from '../../src/char';

const BEST_KEY = 'snake.best';

type Dir = { x: number; y: number };
const DIRS: Record<string, Dir> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let game: GameModule = {
  id: 'snake',
  title: '스네이크',
  description: '방향키/스와이프로 먹이를 잡아라',

  mount(root) {
    const GRID = 20; // 20x20 셀
    const CELL = 18; // px
    const SIZE = GRID * CELL;

    let snake: { x: number; y: number }[];
    let dir: Dir = DIRS.right;
    let nextDir: Dir = DIRS.right;
    let food: { x: number; y: number };
    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) ?? '0');
    let over = false;
    let loop: number | undefined;
    let acc = 0;
    let last = 0;
    let stepMs = 160; // 한 칸 이동 주기 (처음 느리게)
    const STEP_START = 160;
    const STEP_MIN = 80;

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;touch-action:none';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:18px;min-height:24px';

    const bestLine = document.createElement('div');
    bestLine.style.cssText = 'font-size:13px;color:var(--muted)';
    bestLine.textContent = `최고 점수: ${best}`;

    const char = createChar({ color: '#5ce16a', label: 'SNEK' });
    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:12px;color:var(--muted);font-weight:600';
    charLabel.textContent = 'SNEK';

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText =
      'border-radius:14px;border:1px solid #2a3150;background:#0b0e1a;max-width:100%';
    const ctx = canvas.getContext('2d')!;

    const charRow = document.createElement('div');
    charRow.style.cssText = 'display:flex;align-items:center;gap:8px';
    charRow.append(char.canvas, charLabel);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--muted)';
    hint.textContent = '방향키 또는 화면 스와이프로 조작 · 스페이스로 재시작';

    const restart = document.createElement('button');
    restart.textContent = '다시 하기';
    restart.className = 'back-btn';

    wrap.append(charRow, status, bestLine, canvas, hint, restart);
    root.appendChild(wrap);

    function placeFood(): { x: number; y: number } {
      while (true) {
        const f = {
          x: Math.floor(Math.random() * GRID),
          y: Math.floor(Math.random() * GRID),
        };
        if (!snake.some((s) => s.x === f.x && s.y === f.y)) return f;
      }
    }

    function reset() {
      snake = [
        { x: 9, y: 10 },
        { x: 8, y: 10 },
        { x: 7, y: 10 },
      ];
      dir = DIRS.right;
      nextDir = DIRS.right;
      food = placeFood();
      score = 0;
      over = false;
      acc = 0;
      stepMs = STEP_START; // 시작 속도로 리셋
      status.textContent = `점수: 0`;
      draw();
    }

    function setStatus(t: string) {
      status.textContent = t;
    }

    function step() {
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      // 벽 충돌
      if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
        return end();
      }
      // 자기 충돌
      if (snake.some((s) => s.x === head.x && s.y === head.y)) return end();

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        best = Math.max(best, score);
        localStorage.setItem(BEST_KEY, String(best));
        bestLine.textContent = `최고 점수: ${best}`;
        setStatus(`점수: ${score}`);
        sound.coin();
        char.setState('excited', 300);
        // 먹을수록 살짝 빨라짐 (STEP_MIN 까지)
        stepMs = Math.max(STEP_MIN, stepMs - 3);
        food = placeFood();
      } else {
        snake.pop();
      }
      draw();
    }

    function end() {
      over = true;
      setStatus(`게임 오버 · 점수: ${score} (최고 ${best})`);
      char.setState('sad', 999999);
      sound.sad();
      draw();
    }

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function draw() {
      ctx.fillStyle = '#0b0e1a';
      ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(SIZE, i * CELL);
        ctx.stroke();
      }

      ctx.fillStyle = '#ff6b6b';
      roundRect(food.x * CELL + 3, food.y * CELL + 3, CELL - 6, CELL - 6, 5);
      ctx.fill();

      snake.forEach((s, i) => {
        if (i === 0) {
          // 머리: 밝은 색 + 눈
          ctx.fillStyle = '#7ee0a0';
          roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 7);
          ctx.fill();
          // 눈 (진행 방향 기준 간단히 가운데 상단)
          ctx.fillStyle = '#0b0e1a';
          const ex = s.x * CELL;
          const ey = s.y * CELL;
          ctx.beginPath();
          ctx.arc(ex + CELL * 0.35, ey + CELL * 0.38, 2.2, 0, Math.PI * 2);
          ctx.arc(ex + CELL * 0.65, ey + CELL * 0.38, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 몸통: 그라데이션 톤
          const shade = 0.5 + 0.5 * (1 - i / snake.length);
          ctx.fillStyle = `rgba(92, 225, 166, ${shade.toFixed(2)})`;
          roundRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4, 5);
          ctx.fill();
        }
      });
    }

    function frame() {
      if (over) return;
      const now = performance.now();
      if (!last) last = now;
      acc += now - last;
      last = now;
      if (acc >= stepMs) {
        acc -= stepMs;
        step();
      }
      loop = window.setTimeout(frame, 30) as unknown as number;
    }

    function startLoop() {
      if (loop) clearTimeout(loop);
      last = 0;
      loop = window.setTimeout(frame, 30) as unknown as number;
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === ' ') {
        e.preventDefault();
        if (over) {
          reset();
          startLoop();
        }
        return;
      }
      const map: Record<string, Dir> = {
        ArrowUp: DIRS.up,
        ArrowDown: DIRS.down,
        ArrowLeft: DIRS.left,
        ArrowRight: DIRS.right,
      };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      if (d.x === -dir.x && d.y === -dir.y) return; // 180도 반전 방지
      nextDir = d;
    }
    window.addEventListener('keydown', onKey);

    // 터치 스와이프
    let tStart: { x: number; y: number } | null = null;
    canvas.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        tStart = { x: t.clientX, y: t.clientY };
      },
      { passive: true }
    );
    canvas.addEventListener(
      'touchend',
      (e) => {
        if (!tStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - tStart.x;
        const dy = t.clientY - tStart.y;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
        const d = Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? DIRS.right
            : DIRS.left
          : dy > 0
            ? DIRS.down
            : DIRS.up;
        if (!(d.x === -dir.x && d.y === -dir.y)) nextDir = d;
        tStart = null;
      },
      { passive: true }
    );

    restart.addEventListener('click', () => {
      reset();
      startLoop();
    });

    reset();
    startLoop();

    game.unmount = () => {
      if (loop) clearTimeout(loop);
      window.removeEventListener('keydown', onKey);
      char.destroy();
    };
  },
};

export default game;
