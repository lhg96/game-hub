import type { GameModule } from '../../src/types';
import { createBoard, place, findBestMoveB, getGroup } from './ai';
import type { Board, Player } from './ai';

const SIZE = 9, CELL = 38, PAD = 24;

let game: GameModule = {
  id: 'baduk',
  title: '바둑',
  description: 'AI와 9×9 바둑 대결',

  mount(root) {
    let board: Board = createBoard();
    let turn: Player = 1;
    let gameOver = false;
    let thinking = false;
    let passCount = 0;
    let captured: [number, number] = [0, 0]; // black, white
    let prevBoard: Board | undefined;

    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0;';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:0.9rem;font-weight:600;color:#ffd700;min-height:22px;';
    status.textContent = '⚫ 당신 차례 (흑)';

    const info = document.createElement('div');
    info.style.cssText = 'display:flex;gap:16px;font-size:0.8rem;';
    info.innerHTML = `
      <span style="color:#fff">⚫ 흑 포획: <b id="bcap">0</b></span>
      <span style="color:#aaa">⚪ 백 포획: <b id="wcap">0</b></span>
    `;

    const CW = CELL * (SIZE - 1) + PAD * 2;
    const CH = CW;
    const canvas = document.createElement('canvas');
    canvas.width = CW; canvas.height = CH;
    canvas.style.cssText = 'border-radius:6px;cursor:pointer;max-width:100%;height:auto;';
    const ctx = canvas.getContext('2d')!;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;';
    const passBtn = document.createElement('button');
    passBtn.textContent = '⏭️ 패스';
    passBtn.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#aaa;padding:6px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.8rem;';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 새 게임';
    resetBtn.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.8rem;';
    btnRow.append(passBtn, resetBtn);

    container.append(status, info, canvas, btnRow);
    root.appendChild(container);

    const bcapEl = document.getElementById('bcap')!;
    const wcapEl = document.getElementById('wcap')!;

    // Audio
    function tone(f: number, d: number, t: OscillatorType = 'sine', v = 0.07, delay = 0) {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        const c = new Ctor();
        const start = delay;
        const o = c.createOscillator(); const g = c.createGain();
        o.type = t; o.frequency.value = f;
        g.gain.setValueAtTime(v, start); g.gain.exponentialRampToValueAtTime(0.0001, start + d);
        o.connect(g).connect(c.destination); o.start(start); o.stop(start + d + 0.05);
        setTimeout(() => c.close(), (start + d) * 1000 + 200);
      } catch(_) {}
    }
    function sPlace() { tone(800, 0.05, 'triangle', 0.1); }
    function sCapture() { tone(400, 0.1, 'square', 0.08); tone(600, 0.08, 'triangle', 0.06, 0.05); }

    function draw() {
      // 배경
      ctx.fillStyle = '#c8954a';
      ctx.fillRect(0, 0, CW, CH);

      // 격자
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.6;
      for (let i = 0; i < SIZE; i++) {
        const p = PAD + i * CELL;
        ctx.beginPath(); ctx.moveTo(PAD, p); ctx.lineTo(PAD + (SIZE - 1) * CELL, p); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p, PAD); ctx.lineTo(p, PAD + (SIZE - 1) * CELL); ctx.stroke();
      }

      // 별표
      const stars = [[2,2],[2,6],[4,4],[6,2],[6,6]];
      ctx.fillStyle = '#333';
      for (const [r, c] of stars) {
        ctx.beginPath(); ctx.arc(PAD + c * CELL, PAD + r * CELL, 3, 0, Math.PI * 2); ctx.fill();
      }

      // 돌
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) {
          if (board[r][c] === 0) continue;
          const x = PAD + c * CELL, y = PAD + r * CELL;
          const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 15);
          if (board[r][c] === 1) {
            grad.addColorStop(0, '#555'); grad.addColorStop(0.6, '#222'); grad.addColorStop(1, '#000');
          } else {
            grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, '#eee'); grad.addColorStop(1, '#ccc');
          }
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = board[r][c] === 1 ? '#000' : '#aaa';
          ctx.lineWidth = 0.5; ctx.stroke();
        }
    }

    function updateCaptured() {
      bcapEl.textContent = String(captured[0]);
      wcapEl.textContent = String(captured[1]);
    }

    function tryPlace(r: number, c: number) {
      if (gameOver || thinking || board[r][c] !== 0) return false;
      const test = board.map(row => [...row]);
      const opp: Player = turn === 1 ? 2 : 1;
      // capture sim
      test[r][c] = turn;
      let capCount = 0;
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || test[nr][nc] !== opp) continue;
        const g = getGroup(test, nr, nc);
        if (g.liberties.size === 0) { capCount += g.stones.length; }
      }
      if (!place(board, r, c, turn, prevBoard)) return false;

      if (capCount > 0) {
        captured[turn === 1 ? 0 : 1] += capCount;
        sCapture();
      } else {
        sPlace();
      }
      updateCaptured();
      prevBoard = board.map(row => [...row]);
      passCount = 0;
      draw();
      turn = opp;
      if (turn === 1) {
        status.textContent = '⚫ 당신 차례';
        setTimeout(() => { if (!gameOver) aiMove(); }, 1000);
      } else {
        status.textContent = '⚪ AI 생각 중...';
        thinking = true;
        setTimeout(() => aiMove(), 300);
      }
      return true;
    }

    function aiMove() {
      thinking = true;
      setTimeout(() => {
        const ai: Player = 2;
        const move = findBestMoveB(board, ai);
        if (!move || gameOver) { thinking = false; return; }
        const [r, c] = move;
        const test = board.map(row => [...row]);
        let capCount = 0;
        const opp: Player = 1;
        test[r][c] = ai;
        for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || test[nr][nc] !== opp) continue;
          const g = getGroup(test, nr, nc);
          if (g.liberties.size === 0) capCount += g.stones.length;
        }
        place(board, r, c, ai, prevBoard);
        if (capCount > 0) {
          captured[1] += capCount;
          sCapture();
        } else {
          sPlace();
        }
        updateCaptured();
        prevBoard = board.map(row => [...row]);
        draw();
        turn = 1;
        thinking = false;
        status.textContent = '⚫ 당신 차례';
      }, 500);
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver || thinking) return;
      const rect = canvas.getBoundingClientRect();
      const sx = CW / rect.width, sy = CH / rect.height;
      const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
      const c = Math.round((mx - PAD) / CELL), r = Math.round((my - PAD) / CELL);
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
      tryPlace(r, c);
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const ev = new MouseEvent('click', { clientX: touch.clientX, clientY: touch.clientY });
      canvas.dispatchEvent(ev);
    }, { passive: false });

    function reset() {
      board = createBoard();
      turn = 1; gameOver = false; thinking = false;
      passCount = 0; captured = [0, 0]; prevBoard = undefined;
      status.textContent = '⚫ 당신 차례 (흑)';
      updateCaptured(); draw();
    }

    passBtn.addEventListener('click', () => {
      if (gameOver || thinking) return;
      passCount++;
      if (passCount >= 2) {
        gameOver = true;
        const bScore = captured[0], wScore = captured[1];
        status.textContent = bScore >= wScore ? '🎉 승리!' : '😢 패배!';
        draw(); return;
      }
      turn = turn === 1 ? 2 : 1;
      status.textContent = turn === 1 ? '⚫ 당신 차례' : '🤖 AI 차례';
      if (turn === 2) { thinking = true; setTimeout(() => aiMove(), 300); }
    });

    resetBtn.addEventListener('click', reset);
    draw();
    // AI 선공 (백) 시작
    setTimeout(() => aiMove(), 500);

    game.unmount = () => {};
  },
};

export default game;
