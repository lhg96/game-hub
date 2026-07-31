import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';

// 순수 TS 테트리스 — 의존성 0, 모바일 최적화 (스와이프 + 버튼), 효과음 포함

const COLS = 10;
const ROWS = 20;
const BEST_KEY = 'tetris.best';

type Piece = {
  shape: number[][];
  color: string;
};

// 7 테트로미노 (회전 상태 0 기준)
const SHAPES: number[][][] = [
  [[1, 1, 1, 1]], // I
  [[1, 1], [1, 1]], // O
  [[0, 1, 0], [1, 1, 1]], // T
  [[0, 1, 1], [1, 1, 0]], // S
  [[1, 1, 0], [0, 1, 1]], // Z
  [[1, 0, 0], [1, 1, 1]], // J
  [[0, 0, 1], [1, 1, 1]], // L
];
const COLORS = [
  '#39d0d8', // I cyan
  '#f7d038', // O yellow
  '#b06cf0', // T purple
  '#5ce16a', // S green
  '#ff6b6b', // Z red
  '#5b8cff', // J blue
  '#ff9f43', // L orange
];

function rotateCW(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const res = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) res[c][rows - 1 - r] = m[r][c];
  return res;
}

function makePiece(): Piece & { x: number; y: number; rot: number[][] } {
  const idx = Math.floor(Math.random() * SHAPES.length);
  const shape = SHAPES[idx];
  return {
    shape,
    color: COLORS[idx],
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
    rot: shape,
  };
}

let game: GameModule = {
  id: 'tetris',
  title: '테트리스',
  description: '블록 퍼즐 (Tetris)',

  mount(root) {
    let board: number[][]; // 0 = empty, else color index+1
    let cur: Piece & { x: number; y: number; rot: number[][] };
    let next: Piece;
    let score = 0;
    let lines = 0;
    let level = 1;
    let best = Number(localStorage.getItem(BEST_KEY) ?? '0');
    let over = false;
    let paused = false;
    let dropAcc = 0;
    let loop: number | undefined;
    let animLoop: number | undefined;
    let dropMs = 800;

    // 캐릭터 애니메이션 상태
    type CharState = 'idle' | 'move' | 'rotate' | 'drop' | 'clear' | 'levelup' | 'over';
    let charState: CharState = 'idle';
    let charTimer = 0; // 상태 지속 시간 (ms)
    let charT = 0; // 애니메이션 시간축

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:440px;margin:0 auto';

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center';

    const diffInfo = document.createElement('div');
    diffInfo.style.cssText = 'font-size:13px;color:var(--muted)';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'back-btn';
    muteBtn.textContent = sound.isMuted() ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      const m = sound.toggleMute();
      muteBtn.textContent = m ? '🔇' : '🔊';
    });

    const restart = document.createElement('button');
    restart.className = 'back-btn';
    restart.textContent = '새 게임';

    top.append(diffInfo, muteBtn, restart);

    // 보드 + 사이드바
    const area = document.createElement('div');
    area.style.cssText = 'display:flex;gap:12px;width:100%;justify-content:center';

    const boardEl = document.createElement('div');
    boardEl.style.cssText =
      'display:grid;grid-template-columns:repeat(' + COLS + ',1fr);gap:2px;background:#0b0e1a;padding:4px;border-radius:10px;border:1px solid #2a3150;touch-action:none;aspect-ratio:' + COLS + '/' + ROWS + ';width:62%';

    const side = document.createElement('div');
    side.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:38%;max-width:140px';

    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size:13px;color:var(--muted)';
    const nextWrap = document.createElement('div');
    nextWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px';
    const nextLabel = document.createElement('div');
    nextLabel.style.cssText = 'font-size:12px;color:var(--muted)';
    nextLabel.textContent = 'NEXT';
    const nextEl = document.createElement('div');
    nextEl.style.cssText =
      'display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:#0b0e1a;padding:4px;border-radius:8px;aspect-ratio:1/1';

    // 캐릭터 캔버스
    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:12px;color:var(--muted)';
    charLabel.textContent = 'BLOKY';
    const charCanvas = document.createElement('canvas');
    charCanvas.width = 72;
    charCanvas.height = 72;
    charCanvas.style.cssText = 'width:56px;max-width:56px;height:56px;border-radius:10px;background:linear-gradient(160deg,#1a1f35,#0b0e1a);border:1px solid #2a3150';

    const charRow = document.createElement('div');
    charRow.style.cssText = 'display:flex;align-items:center;gap:6px';
    charRow.append(charCanvas, charLabel);

    side.append(scoreEl, nextWrap, nextLabel, nextEl, charRow);

    // 조작 버튼 (모바일)
    const pad = document.createElement('div');
    pad.style.cssText =
      'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;max-width:320px';
    const mkBtn = (label: string, fn: () => void, gy: string) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = 'back-btn';
      b.style.cssText = `grid-row:${gy};font-size:20px;padding:14px 0;height:auto`;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        fn();
      });
      pad.appendChild(b);
      return b;
    };
    mkBtn('◀', () => move(-1), '1');
    mkBtn('⟳', () => rotate(), '1');
    mkBtn('▶', () => move(1), '1');
    mkBtn('▼', () => softDrop(), '2');
    const pauseBtn = mkBtn('⏸', () => togglePause(), '2');
    mkBtn('⤓', () => hardDrop(), '2');

    wrap.append(top, area, pad);
    area.append(boardEl, side);
    nextWrap.append(nextLabel, nextEl);
    root.appendChild(wrap);

    const cells: HTMLDivElement[] = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = document.createElement('div');
      c.style.cssText = 'background:#11162b;border-radius:3px';
      cells.push(c);
      boardEl.appendChild(c);
    }

    const nextCells: HTMLDivElement[] = [];
    for (let i = 0; i < 16; i++) {
      const c = document.createElement('div');
      c.style.cssText = 'background:#11162b;border-radius:2px';
      nextCells.push(c);
      nextEl.appendChild(c);
    }

    function emptyBoard(): number[][] {
      return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    function collides(p: typeof cur, boardChk: number[][]): boolean {
      const m = p.rot;
      for (let r = 0; r < m.length; r++)
        for (let c = 0; c < m[r].length; c++) {
          if (!m[r][c]) continue;
          const nx = p.x + c;
          const ny = p.y + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && boardChk[ny][nx]) return true;
        }
      return false;
    }

    function spawn() {
      cur = {
        ...next,
        x: Math.floor((COLS - next.shape[0].length) / 2),
        y: 0,
        rot: next.shape,
      };
      next = makePiece();
      if (collides(cur, board)) {
        end();
      }
    }

    function merge() {
      const m = cur.rot;
      for (let r = 0; r < m.length; r++)
        for (let c = 0; c < m[r].length; c++) {
          if (!m[r][c]) continue;
          const ny = cur.y + r;
          const nx = cur.x + c;
          if (ny >= 0) board[ny][nx] = COLORS.indexOf(cur.color) + 1;
        }
    }

    function clearLines(): number {
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every((v) => v !== 0)) {
          board.splice(r, 1);
          board.unshift(Array(COLS).fill(0));
          cleared++;
          r++; // recheck same row index
        }
      }
      return cleared;
    }

    function move(dx: number) {
      if (over || paused) return;
      const tmp = { ...cur, x: cur.x + dx };
      if (!collides(tmp, board)) {
        cur.x += dx;
        sound.tetrisMove();
        setChar('move');
        draw();
      }
    }

    function rotate() {
      if (over || paused) return;
      const r = rotateCW(cur.rot);
      const tmp = { ...cur, rot: r };
      // wall kick 간단히: 좌/우 시프트 시도
      for (const off of [0, -1, 1, -2, 2]) {
        const t2 = { ...tmp, x: cur.x + off };
        if (!collides(t2, board)) {
          cur.rot = r;
          cur.x += off;
          sound.tetrisRotate();
          setChar('rotate');
          draw();
          return;
        }
      }
    }

    function softDrop() {
      if (over || paused) return;
      step();
      setChar('drop', 200);
    }

    function hardDrop() {
      if (over || paused) return;
      while (!collides({ ...cur, y: cur.y + 1 }, board)) cur.y++;
      setChar('drop');
      lock();
    }

    function step() {
      if (over || paused) return;
      if (!collides({ ...cur, y: cur.y + 1 }, board)) {
        cur.y++;
      } else {
        lock();
      }
      draw();
    }

    function lock() {
      merge();
      const n = clearLines();
      if (n > 0) {
        score += [0, 100, 300, 500, 800][n] * level;
        lines += n;
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
          level = newLevel;
          dropMs = Math.max(120, 800 - (level - 1) * 70);
          sound.tetrisLevelUp();
          setChar('levelup');
        } else {
          sound.tetrisClear(n);
          setChar('clear');
        }
      } else {
        sound.tetrisDrop();
      }
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
      }
      spawn();
      updateInfo();
    }

    function end() {
      over = true;
      sound.gameOver();
      setChar('over', 999999);
      updateInfo();
      draw();
    }

    function togglePause() {
      if (over) return;
      paused = !paused;
      pauseBtn.textContent = paused ? '▶' : '⏸';
      draw();
    }

    function updateInfo() {
      diffInfo.textContent = `점수 ${score} · 라인 ${lines} · Lv ${level} · 최고 ${best}${over ? ' · 게임오버' : paused ? ' · 일시정지' : ''}`;
    }

    function draw() {
      // board
      const view = board.map((row) => row.slice());
      if (!over) {
        const m = cur.rot;
        for (let r = 0; r < m.length; r++)
          for (let c = 0; c < m[r].length; c++) {
            if (!m[r][c]) continue;
            const ny = cur.y + r;
            const nx = cur.x + c;
            if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS)
              view[ny][nx] = COLORS.indexOf(cur.color) + 1;
          }
      }
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const v = view[r][c];
          const cell = cells[r * COLS + c];
          if (v) {
            const col = COLORS[v - 1];
            cell.style.background = col;
            cell.style.boxShadow = `inset 0 0 6px rgba(255,255,255,0.25)`;
          } else {
            cell.style.background = '#11162b';
            cell.style.boxShadow = 'none';
          }
        }
      // next
      nextCells.forEach((c) => {
        c.style.background = '#11162b';
        c.style.boxShadow = 'none';
      });
      const ns = next.shape;
      const offR = Math.floor((4 - ns.length) / 2);
      const offC = Math.floor((4 - ns[0].length) / 2);
      for (let r = 0; r < ns.length; r++)
        for (let c = 0; c < ns[r].length; c++) {
          if (!ns[r][c]) continue;
          const idx = (r + offR) * 4 + (c + offC);
          if (idx >= 0 && idx < 16) {
            nextCells[idx].style.background = next.color;
            nextCells[idx].style.boxShadow = `inset 0 0 4px rgba(255,255,255,0.25)`;
          }
        }
    }

    // 캐릭터 애니메이션 (BLOKY)
    const cctx = charCanvas.getContext('2d')!;
    function setChar(state: CharState, dur = 600) {
      charState = state;
      charTimer = dur;
    }
    function drawChar() {
      const W = charCanvas.width;
      const H = charCanvas.height;
      cctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2 + 10;
      const bob = Math.sin(charT / 300) * 4;
      const t = charT / 1000;

      // 상태별 변형
      let eyeY = 0;
      let mouth = 'smile';
      let rot = 0;
      let scale = 1;
      let col = '#6c8cff';
      let tear = false;

      switch (charState) {
        case 'move':
          eyeY = 0;
          rot = Math.sin(t * 12) * 0.12;
          break;
        case 'rotate':
          rot = t * 6;
          col = '#b06cf0';
          break;
        case 'drop':
          scale = 1 + Math.sin(t * 20) * 0.08;
          col = '#ff9f43';
          break;
        case 'clear':
          scale = 1 + Math.sin(t * 18) * 0.15;
          col = '#5ce16a';
          mouth = 'open';
          break;
        case 'levelup':
          scale = 1 + Math.sin(t * 10) * 0.2;
          col = '#f7d038';
          mouth = 'open';
          break;
        case 'over':
          rot = 1.4;
          eyeY = 6;
          mouth = 'flat';
          col = '#ff6b6b';
          tear = true;
          break;
        default: // idle
          eyeY = bob * 0.3;
          break;
      }

      cctx.save();
      cctx.translate(cx, cy + bob);
      cctx.rotate(rot);
      cctx.scale(scale, scale);

      // 몸 (둥근 사각형 블록)
      cctx.fillStyle = col;
      roundRectCtx(cctx, -28, -28, 56, 56, 14);
      cctx.fill();
      cctx.strokeStyle = 'rgba(255,255,255,0.3)';
      cctx.lineWidth = 2;
      cctx.stroke();

      // 눈
      cctx.fillStyle = '#fff';
      cctx.beginPath();
      cctx.arc(-11, -6 + eyeY, 7, 0, Math.PI * 2);
      cctx.arc(11, -6 + eyeY, 7, 0, Math.PI * 2);
      cctx.fill();
      cctx.fillStyle = '#1a1f35';
      cctx.beginPath();
      cctx.arc(-11, -4 + eyeY, 3.5, 0, Math.PI * 2);
      cctx.arc(11, -4 + eyeY, 3.5, 0, Math.PI * 2);
      cctx.fill();

      // 입
      cctx.strokeStyle = '#1a1f35';
      cctx.lineWidth = 2.5;
      cctx.beginPath();
      if (mouth === 'open') {
        cctx.arc(0, 10, 7, 0, Math.PI * 2);
        cctx.fillStyle = '#1a1f35';
        cctx.fill();
      } else if (mouth === 'flat') {
        cctx.moveTo(-8, 12);
        cctx.lineTo(8, 12);
        cctx.stroke();
      } else {
        cctx.arc(0, 6, 9, 0.15 * Math.PI, 0.85 * Math.PI);
        cctx.stroke();
      }
      cctx.restore();

      // 눈물 (game over)
      if (tear) {
        cctx.fillStyle = '#6cc6ff';
        cctx.beginPath();
        cctx.arc(cx - 11, cy + bob + 14 + Math.sin(t * 6) * 4, 3, 0, Math.PI * 2);
        cctx.fill();
      }

      // 클리어/레벨업 파티클 (⭐)
      if (charState === 'clear' || charState === 'levelup') {
        for (let i = 0; i < 6; i++) {
          const a = (t * 4 + i) % (Math.PI * 2);
          const rr = 40 + Math.sin(t * 8 + i) * 10;
          const px = cx + Math.cos(a) * rr;
          const py = cy + bob + Math.sin(a) * rr;
          cctx.fillStyle = i % 2 ? '#f7d038' : '#5ce16a';
          cctx.font = '14px serif';
          cctx.fillText('⭐', px - 7, py + 5);
        }
      }
    }

    function roundRectCtx(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function animFrame() {
      const now = performance.now();
      if (!charT) charT = now;
      const dt = now - charT;
      charT = now;
      if (charTimer > 0) {
        charTimer -= dt;
        if (charTimer <= 0 && charState !== 'over') charState = 'idle';
      }
      drawChar();
      // setTimeout 사용: 헤드리스/백그라운드에서도 캐릭터 애니메이션 유지
      animLoop = window.setTimeout(animFrame, 50) as unknown as number;
    }

    function startLoop() {
      if (loop) clearTimeout(loop);
      dropAcc = 0;
      // setTimeout 재귀: 백그라운드에서도 완전 정지하지 않음 (rAF 대신)
      const tick = () => {
        if (over || paused) {
          loop = window.setTimeout(tick, 50);
          return;
        }
        dropAcc += 50;
        if (dropAcc >= dropMs) {
          dropAcc = 0;
          step();
        }
        loop = window.setTimeout(tick, 50);
      };
      loop = window.setTimeout(tick, 50);
    }

    // 키보드
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowLeft': move(-1); break;
        case 'ArrowRight': move(1); break;
        case 'ArrowUp': case 'x': case 'X': rotate(); break;
        case 'ArrowDown': softDrop(); break;
        case ' ': hardDrop(); break;
        case 'p': case 'P': togglePause(); break;
        default: return;
      }
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);

    // 스와이프
    let tStart: { x: number; y: number } | null = null;
    boardEl.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        tStart = { x: t.clientX, y: t.clientY };
      },
      { passive: true }
    );
    boardEl.addEventListener(
      'touchend',
      (e) => {
        if (!tStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - tStart.x;
        const dy = t.clientY - tStart.y;
        tStart = null;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) dx > 0 ? move(1) : move(-1);
        else dy > 0 ? softDrop() : rotate();
      },
      { passive: true }
    );

    function newGame() {
      board = emptyBoard();
      next = makePiece();
      score = 0;
      lines = 0;
      level = 1;
      over = false;
      paused = false;
      dropMs = 800;
      pauseBtn.textContent = '⏸';
      spawn();
      updateInfo();
      draw();
      startLoop();
      if (!animLoop) animLoop = requestAnimationFrame(animFrame);
      sound.start();
    }

    restart.addEventListener('click', newGame);
    newGame();

    game.unmount = () => {
      if (loop) clearTimeout(loop);
      if (animLoop) clearTimeout(animLoop);
      window.removeEventListener('keydown', onKey);
    };
  },
};

export default game;
