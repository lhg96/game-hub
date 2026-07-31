import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';
import { createChar } from '../../src/char';

const BEST_KEY = 'game2048.best';

const COLORS: Record<number, string> = {
  0: '#0b0e1a',
  2: '#3a4170',
  4: '#4a5398',
  8: '#6c8cff',
  16: '#ff9f6b',
  32: '#ff7a59',
  64: '#ff5e5e',
  128: '#ffd166',
  256: '#ffe08a',
  512: '#fff3b0',
  1024: '#a0e7a0',
  2048: '#5ce1a6',
};

let game: GameModule = {
  id: '2048',
  title: '2048',
  description: '타일을 합쳐 2048을 만들어라',

  mount(root) {
    const char = createChar({ color: '#5ce1a6', label: 'TILE' });
    let board: number[];
    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) ?? '0');
    let over = false;

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;touch-action:none';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:18px;min-height:24px';
    const bestLine = document.createElement('div');
    bestLine.style.cssText = 'font-size:13px;color:var(--muted)';
    bestLine.textContent = `최고: ${best}`;
    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:11px;color:var(--muted)';
    charLabel.textContent = 'TILE (요정)';

    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(4,72px);grid-template-rows:repeat(4,72px);gap:8px;background:#1a1f35;padding:8px;border-radius:14px';

    const cells: HTMLDivElement[] = [];
    for (let i = 0; i < 16; i++) {
      const c = document.createElement('div');
      c.style.cssText =
        'display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;border-radius:8px;background:#0b0e1a;color:#fff';
      cells.push(c);
      grid.appendChild(c);
    }

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--muted)';
    hint.textContent = '방향키 또는 스와이프';

    const restart = document.createElement('button');
    restart.textContent = '다시 하기';
    restart.className = 'back-btn';

    wrap.append(charLabel, char.canvas, status, bestLine, grid, hint, restart);
    root.appendChild(wrap);

    function draw() {
      for (let i = 0; i < 16; i++) {
        const v = board[i];
        cells[i].textContent = v ? String(v) : '';
        cells[i].style.background = COLORS[v] ?? '#5ce1a6';
      }
    }

    function spawn() {
      const empties: number[] = [];
      for (let i = 0; i < 16; i++) if (board[i] === 0) empties.push(i);
      if (!empties.length) return;
      const idx = empties[Math.floor(Math.random() * empties.length)];
      board[idx] = Math.random() < 0.9 ? 2 : 4;
    }

    function setStatus(t: string) {
      status.textContent = t;
    }

    // clockwise rotation of 4x4
    function rotate(b: number[]): number[] {
      const r = new Array<number>(16).fill(0);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) r[x * 4 + (3 - y)] = b[y * 4 + x];
      return r;
    }

    function rotateTimes(n: number) {
      for (let k = 0; k < n; k++) board = rotate(board);
    }

    function moveLeft(): boolean {
      let moved = false;
      for (let y = 0; y < 4; y++) {
        const row = board.slice(y * 4, y * 4 + 4).filter((v) => v);
        for (let i = 0; i < row.length - 1; i++) {
          if (row[i] === row[i + 1]) {
            row[i] *= 2;
            score += row[i];
            row.splice(i + 1, 1);
          }
        }
        while (row.length < 4) row.push(0);
        for (let x = 0; x < 4; x++) {
          if (board[y * 4 + x] !== row[x]) moved = true;
          board[y * 4 + x] = row[x];
        }
      }
      return moved;
    }

    function canMove(): boolean {
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const v = board[y * 4 + x];
          if (v === 0) return true;
          if (x < 3 && board[y * 4 + x + 1] === v) return true;
          if (y < 3 && board[(y + 1) * 4 + x] === v) return true;
        }
      return false;
    }

    function updateBest() {
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
        bestLine.textContent = `최고: ${best}`;
      }
    }

    function move(dir: 'left' | 'up' | 'right' | 'down') {
      if (over) return;
      const rotations: Record<string, number> = {
        left: 0,
        up: 3,
        right: 2,
        down: 1,
      };
      const r = rotations[dir];
      rotateTimes(r);
      const moved = moveLeft();
      rotateTimes((4 - r) % 4);
      if (moved) {
        spawn();
        updateBest();
        setStatus(`점수: ${score}`);
        sound.tap();
        char.setState('excited', 300);
        draw();
        if (board.every((v) => v !== 0) && !canMove()) {
          over = true;
          setStatus(`게임 오버 · 점수: ${score}`);
          char.setState('sad', 999999);
          sound.sad();
        }
      }
    }

    function reset() {
      board = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      score = 0;
      over = false;
      spawn();
      spawn();
      setStatus('점수: 0');
      draw();
    }

    function onKey(e: KeyboardEvent) {
      const map: Record<string, 'left' | 'up' | 'right' | 'down'> = {
        ArrowLeft: 'left',
        ArrowUp: 'up',
        ArrowRight: 'right',
        ArrowDown: 'down',
      };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      move(d);
    }
    window.addEventListener('keydown', onKey);

    let tStart: { x: number; y: number } | null = null;
    grid.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        tStart = { x: t.clientX, y: t.clientY };
      },
      { passive: true }
    );
    grid.addEventListener(
      'touchend',
      (e) => {
        if (!tStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - tStart.x;
        const dy = t.clientY - tStart.y;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
        const d: 'left' | 'up' | 'right' | 'down' =
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? 'right'
              : 'left'
            : dy > 0
              ? 'down'
              : 'up';
        move(d);
        tStart = null;
      },
      { passive: true }
    );

    restart.addEventListener('click', reset);

    reset();

    game.unmount = () => {
      window.removeEventListener('keydown', onKey);
      char.destroy();
    };
  },
};

export default game;
