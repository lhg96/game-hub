/**
 * 오목 게임 엔진 (https://github.com/leekeunhwan/omok)
 * - Gomoku class: 보드/턴/승리판정 (원본 로직)
 * - AI: @algorithm.ts/gomoku (npm 오픈소스)
 * - Canvas 렌더링 + Web Audio 사운드
 */
import { GomokuSolution, createScoreMap } from '@algorithm.ts/gomoku';

// ====== Core Game Engine (from github.com/leekeunhwan/omok) ======
const EMPTY = '';
const BLACK = '●';
const WHITE = '○';

const LINE = 15;

class OmokCore {
  line = LINE;
  board: string[][] = [];
  player: string = BLACK;

  constructor() {
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: LINE }, () => Array(LINE).fill(EMPTY));
    this.player = BLACK;
  }

  turn(row: number, col: number): boolean {
    if (this.board[row][col] !== EMPTY) return false;
    this.board[row][col] = this.player;
    this.player = this.player === BLACK ? WHITE : BLACK;
    return true;
  }

  checkWinner(): string | null {
    const b = this.board;
    const checkFive = (r: number, c: number, dr: number, dc: number, p: string) => {
      for (let i = 0; i < 5; i++)
        if (r + i * dr < 0 || r + i * dr >= LINE || c + i * dc < 0 || c + i * dc >= LINE || b[r + i * dr][c + i * dc] !== p) return false;
      return true;
    };

    for (let r = 0; r < LINE; r++)
      for (let c = 0; c < LINE; c++) {
        const p = b[r][c];
        if (p === EMPTY) continue;
        if (checkFive(r, c, 0, 1, p) || checkFive(r, c, 1, 0, p) || checkFive(r, c, 1, 1, p) || checkFive(r, c, 1, -1, p))
          return p;
      }
    return null;
  }

  getWinCells(p: string): [number, number][] | null {
    for (let r = 0; r < LINE; r++)
      for (let c = 0; c < LINE; c++) {
        if (this.board[r][c] !== p) continue;
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          let ok = true;
          const cells: [number, number][] = [];
          for (let i = 0; i < 5; i++) {
            const nr = r + i * dr, nc = c + i * dc;
            if (nr < 0 || nr >= LINE || nc < 0 || nc >= LINE || this.board[nr][nc] !== p) { ok = false; break; }
            cells.push([nr, nc]);
          }
          if (ok) return cells;
        }
      }
    return null;
  }
}

// ====== Game Module ======
import type { GameModule } from '../../src/types';

const PAD = 24;
const CELL = 32;
const CV = CELL * (LINE - 1) + PAD * 2;

let game: GameModule = {
  id: 'omok',
  title: '오목',
  description: 'AI와 오목 대결',

  mount(root) {
    const core = new OmokCore();
    const scoreMap = createScoreMap(5);
    const ai = new GomokuSolution({
      MAX_ROW: LINE, MAX_COL: LINE, MAX_ADJACENT: 5, MAX_DISTANCE_OF_NEIGHBOR: 2, scoreMap,
    });

    let gameOver = false;
    let thinking = false;
    let winCells: [number, number][] | null = null;

    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 0;';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:0.95rem;font-weight:600;color:#ffd700;min-height:24px;';
    status.textContent = '⚫ 당신 차례';

    const canvas = document.createElement('canvas');
    canvas.width = CV; canvas.height = CV;
    canvas.style.cssText = 'border-radius:8px;cursor:pointer;max-width:100%;height:auto;';
    const ctx = canvas.getContext('2d')!;

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 새 게임';
    resetBtn.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:8px 20px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;';

    container.append(status, canvas, resetBtn);
    root.appendChild(container);

    // Audio
    function tone(f: number, d: number, t: OscillatorType = 'sine', v = 0.1) {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        const c = new Ctor(); const o = c.createOscillator(); const g = c.createGain();
        o.type = t; o.frequency.value = f;
        g.gain.setValueAtTime(v, 0); g.gain.exponentialRampToValueAtTime(0.0001, d);
        o.connect(g).connect(c.destination); o.start(); o.stop(d);
        setTimeout(() => c.close(), d * 1000 + 100);
      } catch (_) { }
    }
    function sPlace() { tone(600, 0.08, 'triangle', 0.12); }
    function sWin() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'sine', 0.1), i * 80)); }
    function sLose() { [440, 370, 294, 220].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sawtooth', 0.08), i * 100)); }

    function draw() {
      // 배경
      const g = ctx.createLinearGradient(0, 0, CV, CV);
      g.addColorStop(0, '#d4a658'); g.addColorStop(0.5, '#c49540'); g.addColorStop(1, '#a67830');
      ctx.fillStyle = g; ctx.fillRect(0, 0, CV, CV);

      // 나무질감
      ctx.strokeStyle = 'rgba(160,120,60,0.1)'; ctx.lineWidth = 1;
      for (let i = 0; i < 25; i++) {
        const y = Math.random() * CV;
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x < CV; x += 4) ctx.lineTo(x, y + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }

      // 격자
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.7;
      for (let i = 0; i < LINE; i++) {
        const p = PAD + i * CELL;
        ctx.beginPath(); ctx.moveTo(PAD, p); ctx.lineTo(PAD + (LINE - 1) * CELL, p); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p, PAD); ctx.lineTo(p, PAD + (LINE - 1) * CELL); ctx.stroke();
      }

      // 별표
      const stars = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
      ctx.fillStyle = '#333';
      for (const [r, c] of stars) { ctx.beginPath(); ctx.arc(PAD + c * CELL, PAD + r * CELL, 2.5, 0, Math.PI * 2); ctx.fill(); }

      // 돌
      for (let r = 0; r < LINE; r++)
        for (let c = 0; c < LINE; c++) {
          const p = core.board[r][c];
          if (p === EMPTY) continue;
          const x = PAD + c * CELL, y = PAD + r * CELL;
          const isWin = winCells?.some(([wr, wc]) => wr === r && wc === c);
          const g2 = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 13);
          if (p === BLACK) { g2.addColorStop(0, '#555'); g2.addColorStop(0.6, '#222'); g2.addColorStop(1, '#000'); }
          else { g2.addColorStop(0, '#fff'); g2.addColorStop(0.5, '#f0f0f0'); g2.addColorStop(1, '#ccc'); }
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = p === BLACK ? '#000' : '#aaa'; ctx.lineWidth = 0.5; ctx.stroke();
          if (isWin) { ctx.fillStyle = 'rgba(255,50,50,0.2)'; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill(); }
        }

      // 승리라인
      if (winCells) {
        ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(255,50,50,0.5)'; ctx.shadowBlur = 8;
        const f = winCells[0], l = winCells[winCells.length - 1];
        ctx.beginPath(); ctx.moveTo(PAD + f[1] * CELL, PAD + f[0] * CELL);
        ctx.lineTo(PAD + l[1] * CELL, PAD + l[0] * CELL); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    function place(r: number, c: number) {
      if (gameOver || thinking || !core.turn(r, c)) return;
      // AI 엔진 동기화 (lib: 0=백, 1=흑)
      ai.forward(r, c, 1); // 사람=흑

      sPlace(); draw();

      const w = core.checkWinner();
      if (w) {
        gameOver = true;
        winCells = core.getWinCells(w);
        draw();
        if (w === BLACK) { status.textContent = '🎉 승리!'; sWin(); }
        else { status.textContent = '😢 패배!'; sLose(); }
        return;
      }

      // AI turn
      status.textContent = '🤖 AI 생각 중...';
      thinking = true;
      setTimeout(() => {
        try {
          const [aiR, aiC] = ai.minimaxSearch(0); // 0 = WHITE in lib
          if (aiR >= 0 && aiR < LINE && aiC >= 0 && aiC < LINE && core.board[aiR][aiC] === EMPTY) {
            core.turn(aiR, aiC);
            ai.forward(aiR, aiC, 0);
            sPlace(); draw();

            const w2 = core.checkWinner();
            if (w2) {
              gameOver = true;
              winCells = core.getWinCells(w2);
              draw();
              status.textContent = '😢 패배!'; sLose();
              thinking = false; return;
            }
          }
        } catch (e) { /* AI fallback */ }
        thinking = false;
        status.textContent = '⚫ 당신 차례';
      }, 50);
    }

    function reset() {
      core.reset();
      // Re-init AI
      const sc = createScoreMap(5);
      Object.assign(ai, new GomokuSolution({
        MAX_ROW: LINE, MAX_COL: LINE, MAX_ADJACENT: 5, MAX_DISTANCE_OF_NEIGHBOR: 2, scoreMap: sc,
      }));
      (ai as any).init([]);
      gameOver = false; thinking = false; winCells = null;
      status.textContent = '⚫ 당신 차례';
      draw();
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver || thinking) return;
      const rect = canvas.getBoundingClientRect();
      const sx = CV / rect.width, sy = CV / rect.height;
      const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
      const c = Math.round((mx - PAD) / CELL), r = Math.round((my - PAD) / CELL);
      if (r >= 0 && r < LINE && c >= 0 && c < LINE) place(r, c);
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const ev = new MouseEvent('click', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      canvas.dispatchEvent(ev);
    }, { passive: false });

    resetBtn.addEventListener('click', reset);
    draw();
    game.unmount = () => { };
  },
};

export default game;
