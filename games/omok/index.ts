import type { GameModule } from '../../src/types';
import { GomokuSolution, createScoreMap } from '@algorithm.ts/gomoku';

const SIZE = 15;
const CELL = 32;
const PAD = 24;
const CANVAS = CELL * (SIZE - 1) + PAD * 2;

// Map: my player 1(black) → library 1, my player 2(white) → library 0
function toLib(p: number): number { return p === 1 ? 1 : 0; }
function fromLib(p: number): number { return p === 1 ? 1 : 2; }

let game: GameModule = {
  id: 'omok',
  title: '오목',
  description: 'AI와 15×15 오목 (@algorithm.ts/gomoku)',

  mount(root) {
    const scoreMap = createScoreMap(5);
    const solution = new GomokuSolution({
      MAX_ROW: SIZE,
      MAX_COL: SIZE,
      MAX_ADJACENT: 5,
      MAX_DISTANCE_OF_NEIGHBOR: 2,
      scoreMap,
    });

    let turn: number = 1; // 1=player(black), 2=AI(white)
    let gameOver = false;
    let thinking = false;
    let winCells: [number, number][] | null = null;
    let hoverCell: [number, number] | null = null;
    let moveHistory: [number, number, number][] = []; // r, c, player

    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 0;';

    const style = document.createElement('style');
    style.textContent = `
      @keyframes stoneDrop { 0% { transform:scale(0.3);opacity:0.3; } 100% { transform:scale(1);opacity:1; } }
      .stone-placed { animation:stoneDrop 0.25s ease-out; }
    `;

    const status = document.createElement('div');
    status.style.cssText = 'font-size:0.95rem;font-weight:600;color:#ffd700;min-height:24px;';
    status.textContent = '⚫ 당신 차례 (흑돌)';

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS; canvas.height = CANVAS;
    canvas.style.cssText = 'border-radius:8px;cursor:pointer;max-width:100%;height:auto;';
    const ctx = canvas.getContext('2d')!;

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 새 게임';
    resetBtn.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:8px 20px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;';

    container.append(style, status, canvas, resetBtn);
    root.appendChild(container);

    // Audio
    function tone(f: number, d: number, t: OscillatorType = 'sine', v = 0.1) {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        const c = new Ctor();
        const o = c.createOscillator(); const g = c.createGain();
        o.type = t; o.frequency.value = f;
        g.gain.setValueAtTime(v, 0); g.gain.exponentialRampToValueAtTime(0.0001, d);
        o.connect(g).connect(c.destination); o.start(); o.stop(d);
        setTimeout(() => c.close(), d * 1000 + 100);
      } catch(_) {}
    }
    function sPlace() { tone(600, 0.08, 'triangle', 0.12); }
    function sWin() { [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>tone(f,0.15,'sine',0.1),i*80)); }
    function sLose() { [440,370,294,220].forEach((f,i)=>setTimeout(()=>tone(f,0.18,'sawtooth',0.08),i*100)); }

    // Board access
    function getCell(r: number, c: number): number {
      // library board stores player at each position (0=empty, 1=black, 0=white)
      const v = (solution as any).mover.context.board[r * SIZE + c] as number;
      if (v === 0) return 0;
      return fromLib(v);
    }

    function checkWinOnBoard(): [number, number][] | null {
      const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) {
          const p = getCell(r, c);
          if (p === 0) continue;
          for (const [dr, dc] of DIRS) {
            const cells: [number, number][] = [];
            let nr = r, nc = c;
            while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && getCell(nr, nc) === p) {
              cells.push([nr, nc]); nr += dr; nc += dc;
            }
            if (cells.length >= 5) return cells.slice(0, 5);
          }
        }
      return null;
    }

    function draw() {
      // 배경
      const grad = ctx.createLinearGradient(0, 0, CANVAS, CANVAS);
      grad.addColorStop(0, '#d4a658'); grad.addColorStop(0.5, '#c49540'); grad.addColorStop(1, '#a67830');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS, CANVAS);

      // 나무 질감
      ctx.strokeStyle = 'rgba(160,120,60,0.12)'; ctx.lineWidth = 1;
      for (let i = 0; i < 30; i++) {
        const y = Math.random() * CANVAS;
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x < CANVAS; x += 5) ctx.lineTo(x, y + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }

      // 격자
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8;
      for (let i = 0; i < SIZE; i++) {
        const p = PAD + i * CELL;
        ctx.beginPath(); ctx.moveTo(PAD, p); ctx.lineTo(PAD + (SIZE - 1) * CELL, p); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p, PAD); ctx.lineTo(p, PAD + (SIZE - 1) * CELL); ctx.stroke();
      }

      // 별표
      const stars = [[3,3],[3,11],[7,7],[11,3],[11,11]];
      ctx.fillStyle = '#333';
      for (const [r, c] of stars) { ctx.beginPath(); ctx.arc(PAD + c * CELL, PAD + r * CELL, 3, 0, Math.PI * 2); ctx.fill(); }

      // 돌
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) {
          const p = getCell(r, c);
          if (p === 0) continue;
          const x = PAD + c * CELL, y = PAD + r * CELL;
          const isWin = winCells !== null && winCells.some(([wr, wc]) => wr === r && wc === c);
          const grad2 = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 14);
          if (p === 1) {
            grad2.addColorStop(0, '#555'); grad2.addColorStop(0.6, '#222'); grad2.addColorStop(1, '#000');
          } else {
            grad2.addColorStop(0, '#fff'); grad2.addColorStop(0.5, '#f0f0f0'); grad2.addColorStop(1, '#ccc');
          }
          ctx.fillStyle = grad2;
          ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = p === 1 ? '#000' : '#aaa'; ctx.lineWidth = 0.5; ctx.stroke();
          if (isWin) {
            ctx.fillStyle = 'rgba(255,50,50,0.25)';
            ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
          }
        }

      // 승리 라인
      if (winCells) {
        ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255,50,50,0.6)'; ctx.shadowBlur = 10;
        const f = winCells[0], l = winCells[winCells.length - 1];
        ctx.beginPath(); ctx.moveTo(PAD + f[1] * CELL, PAD + f[0] * CELL);
        ctx.lineTo(PAD + l[1] * CELL, PAD + l[0] * CELL); ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 호버
      if (hoverCell && !gameOver && !thinking && getCell(hoverCell[0], hoverCell[1]) === 0) {
        const x = PAD + hoverCell[1] * CELL, y = PAD + hoverCell[0] * CELL;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
      }
    }

    function place(r: number, c: number) {
      if (gameOver || thinking || getCell(r, c) !== 0) return;
      solution.forward(r, c, toLib(turn));
      moveHistory.push([r, c, turn]);
      sPlace();
      draw();

      const w = checkWinOnBoard();
      if (w) {
        gameOver = true; winCells = w; draw();
        if (turn === 1) { status.textContent = '🎉 승리!'; sWin(); }
        else { status.textContent = '😢 패배!'; sLose(); }
        return;
      }
      if (moveHistory.length >= SIZE * SIZE) {
        gameOver = true; status.textContent = '🤝 무승부!'; return;
      }

      // Check if library says final (5 in a row detected internally)
      if ((solution as any).mover.state.isFinal()) {
        // Try to find who won by scanning
        const w2 = checkWinOnBoard();
        if (w2) {
          gameOver = true; winCells = w2; draw();
          if (turn === 1) { status.textContent = '🎉 승리!'; sWin(); }
          else { status.textContent = '😢 패배!'; sLose(); }
          return;
        }
      }

      turn = turn === 1 ? 2 : 1;
      if (turn === 1) {
        status.textContent = '⚫ 당신 차례';
      } else {
        status.textContent = '🤖 AI 생각 중...';
        thinking = true;
        setTimeout(() => {
          try {
            const [aiR, aiC] = solution.minimaxSearch(toLib(2));
            // Check if library returned a valid move (not out of bounds)
            if (aiR >= 0 && aiR < SIZE && aiC >= 0 && aiC < SIZE && getCell(aiR, aiC) === 0) {
              solution.forward(aiR, aiC, toLib(2));
              moveHistory.push([aiR, aiC, 2]);
              sPlace();
              draw();

              const w2 = checkWinOnBoard();
              if (w2) {
                gameOver = true; winCells = w2; draw();
                status.textContent = '😢 패배!'; sLose();
                thinking = false; return;
              }
              if (moveHistory.length >= SIZE * SIZE) {
                gameOver = true; status.textContent = '🤝 무승부!';
                thinking = false; return;
              }
            }
          } catch(e) {
            console.warn('AI error:', e);
          }
          turn = 1; thinking = false;
          status.textContent = '⚫ 당신 차례';
        }, 100);
      }
    }

    function resetGame() {
      // Reinitialize
      const sc = createScoreMap(5);
      Object.assign(solution, new GomokuSolution({
        MAX_ROW: SIZE, MAX_COL: SIZE, MAX_ADJACENT: 5,
        MAX_DISTANCE_OF_NEIGHBOR: 2, scoreMap: sc,
      }));
      // HACK: reset internal state via init
      (solution as any).init([]);
      turn = 1; gameOver = false; thinking = false; winCells = null; moveHistory = [];
      status.textContent = '⚫ 당신 차례 (흑돌)';
      draw();
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver || thinking) return;
      const rect = canvas.getBoundingClientRect();
      const sx = CANVAS / rect.width, sy = CANVAS / rect.height;
      const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
      const c = Math.round((mx - PAD) / CELL), r = Math.round((my - PAD) / CELL);
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) place(r, c);
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const ev = new MouseEvent('click', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      canvas.dispatchEvent(ev);
    }, { passive: false });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = CANVAS / rect.width, sy = CANVAS / rect.height;
      const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
      const c = Math.round((mx - PAD) / CELL), r = Math.round((my - PAD) / CELL);
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && !gameOver && !thinking) {
        hoverCell = [r, c];
      } else { hoverCell = null; }
      draw();
    });

    canvas.addEventListener('mouseleave', () => { hoverCell = null; draw(); });
    resetBtn.addEventListener('click', resetGame);

    draw();
    game.unmount = () => {};
  },
};

export default game;
