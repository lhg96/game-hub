import type { GameModule } from '../../src/types';
import { Board, createBoard, findBestMove, checkWin, isDraw } from './ai';
import type { Player } from './ai';

const SIZE = 15;
const CELL = 32;
const PAD = 24;
const CANVAS = CELL * (SIZE - 1) + PAD * 2;

let game: GameModule = {
  id: 'omok',
  title: '오목',
  description: 'AI와 15×15 오목 대결',

  mount(root) {
    let board: Board = createBoard();
    let turn: Player = 1; // 1=player(black), 2=AI(white)
    let gameOver = false;
    let thinking = false;
    let winCells: [number, number][] | null = null;
    let hoverCell: [number, number] | null = null;

    // ====== CSS ======
    const style = document.createElement('style');
    style.textContent = `
      @keyframes stoneDrop {
        0% { transform: scale(0.3); opacity: 0.3; }
        60% { transform: scale(1.1); }
        100% { transform: scale(1); opacity: 1; }
      }
      .stone-placed { animation: stoneDrop 0.25s ease-out; }
      @keyframes winPulse {
        0%, 100% { r: 13; opacity: 0.8; }
        50% { r: 16; opacity: 1; }
      }
      @keyframes boardFadeIn {
        0% { opacity: 0; transform: scale(0.95); }
        100% { opacity: 1; transform: scale(1); }
      }
      .omok-container { animation: boardFadeIn 0.4s ease-out; }
    `;

    const container = document.createElement('div');
    container.className = 'omok-container';
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 0;';

    const infoBar = document.createElement('div');
    infoBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;width:100%;max-width:480px;';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:0.95rem;font-weight:600;color:#ffd700;min-height:24px;';
    status.textContent = '⚫ 당신 차례 (흑돌)';

    const scoreDisplay = document.createElement('div');
    scoreDisplay.style.cssText = 'display:flex;gap:12px;font-size:0.8rem;';
    scoreDisplay.innerHTML = `
      <span style="color:#fff">⚫ <b id="omok-wins">0</b></span>
      <span style="color:#888">⚪ <b id="omok-losses">0</b></span>
    `;

    infoBar.append(status, scoreDisplay);

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS;
    canvas.height = CANVAS;
    canvas.style.cssText = 'border-radius:8px;cursor:pointer;max-width:100%;height:auto;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    const ctx = canvas.getContext('2d')!;

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 새 게임';
    resetBtn.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:8px 20px;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s;font-size:0.85rem;';

    container.append(style, infoBar, canvas, resetBtn);
    root.appendChild(container);

    // save refs
    const winsEl = document.getElementById('omok-wins')!;
    const lossesEl = document.getElementById('omok-losses')!;
    let wins = Number(localStorage.getItem('omok.wins') ?? '0');
    let losses = Number(localStorage.getItem('omok.losses') ?? '0');
    winsEl.textContent = String(wins);
    lossesEl.textContent = String(losses);

    // ====== Audio ======
    function playTone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.1) {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        const c = new Ctor();
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(vol, 0);
        g.gain.exponentialRampToValueAtTime(0.0001, dur);
        osc.connect(g).connect(c.destination);
        osc.start();
        osc.stop(dur);
        setTimeout(() => c.close(), dur * 1000 + 100);
      } catch (_) {}
    }
    function soundPlace() { playTone(600, 0.08, 'triangle', 0.12); }
    function soundWin() {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.15, 'sine', 0.1), i * 80)
      );
    }
    function soundLose() {
      [440, 370, 294, 220].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.18, 'sawtooth', 0.08), i * 100)
      );
    }
    function soundThink() { playTone(350, 0.04, 'square', 0.06); }

    // ====== Board Rendering ======
    function drawBoard() {
      // 배경
      const grad = ctx.createLinearGradient(0, 0, CANVAS, CANVAS);
      grad.addColorStop(0, '#d4a658');
      grad.addColorStop(0.3, '#c49540');
      grad.addColorStop(0.6, '#b8883a');
      grad.addColorStop(1, '#a67830');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS, CANVAS);

      // 나무 질감 (가로선)
      ctx.strokeStyle = 'rgba(160,120,60,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const y = Math.random() * CANVAS;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < CANVAS; x += 5) {
          ctx.lineTo(x, y + (Math.random() - 0.5) * 2);
        }
        ctx.stroke();
      }

      // 격자선
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < SIZE; i++) {
        const p = PAD + i * CELL;
        ctx.beginPath();
        ctx.moveTo(PAD, p);
        ctx.lineTo(PAD + (SIZE - 1) * CELL, p);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p, PAD);
        ctx.lineTo(p, PAD + (SIZE - 1) * CELL);
        ctx.stroke();
      }

      // 별표 (5곳)
      const stars = [[3,3],[3,11],[7,7],[11,3],[11,11]];
      ctx.fillStyle = '#333';
      for (const [r, c] of stars) {
        ctx.beginPath();
        ctx.arc(PAD + c * CELL, PAD + r * CELL, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 돌
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (board[r][c] !== 0) continue;
          const x = PAD + c * CELL;
          const y = PAD + r * CELL;
          const isLast = winCells !== null && winCells.some(([wr, wc]) => wr === r && wc === c);
          drawStone(x, y, board[r][c], isLast);
        }
      }

      // 승리 라인
      if (winCells) {
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255,50,50,0.6)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const f = winCells[0], l = winCells[winCells.length - 1];
        ctx.moveTo(PAD + f[1] * CELL, PAD + f[0] * CELL);
        ctx.lineTo(PAD + l[1] * CELL, PAD + l[0] * CELL);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 호버 표시
      if (hoverCell && !gameOver && !thinking && board[hoverCell[0]][hoverCell[1]] === 0) {
        const x = PAD + hoverCell[1] * CELL;
        const y = PAD + hoverCell[0] * CELL;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawStone(x: number, y: number, player: Player, isWin: boolean) {
      const r = 13;
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
      ctx.fill();

      if (player === 1) {
        // 흑돌
        const g = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, r);
        g.addColorStop(0, '#555');
        g.addColorStop(0.4, '#222');
        g.addColorStop(1, '#000');
        ctx.fillStyle = g;
      } else {
        // 백돌
        const g = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, r);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.5, '#f0f0f0');
        g.addColorStop(1, '#ccc');
        ctx.fillStyle = g;
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // 테두리
      ctx.strokeStyle = player === 1 ? '#000' : '#aaa';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 당첨 glow
      if (isWin) {
        ctx.fillStyle = 'rgba(255,50,50,0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ====== Game Logic ======
    function placeStone(r: number, c: number) {
      if (gameOver || thinking || board[r][c] !== 0) return false;
      board[r][c] = turn;
      soundPlace();
      drawBoard();

      const w = checkWin(board, turn);
      if (w) {
        gameOver = true;
        winCells = w;
        drawBoard();
        if (turn === 1) {
          status.textContent = '🎉 승리!';
          wins++; winsEl.textContent = String(wins);
          localStorage.setItem('omok.wins', String(wins));
          soundWin();
        } else {
          status.textContent = '😢 패배!';
          losses++; lossesEl.textContent = String(losses);
          localStorage.setItem('omok.losses', String(losses));
          soundLose();
        }
        return true;
      }
      if (isDraw(board)) {
        gameOver = true;
        status.textContent = '🤝 무승부!';
        return true;
      }

      turn = turn === 1 ? 2 : 1;
      if (turn === 1) {
        status.textContent = '⚫ 당신 차례 (흑돌)';
      } else {
        status.textContent = '🤖 AI 생각 중...';
        thinking = true;
        drawBoard();
        setTimeout(() => aiMove(), 200);
      }
      return true;
    }

    function aiMove() {
      const move = findBestMove(board, 2, 3);
      if (!move) { thinking = false; return; }
      const [r, c] = move;
      soundThink();
      board[r][c] = 2;
      drawBoard();

      const w = checkWin(board, 2);
      if (w) {
        gameOver = true;
        winCells = w;
        drawBoard();
        status.textContent = '😢 패배!';
        losses++; lossesEl.textContent = String(losses);
        localStorage.setItem('omok.losses', String(losses));
        soundLose();
        thinking = false;
        return;
      }
      if (isDraw(board)) {
        gameOver = true;
        status.textContent = '🤝 무승부!';
        thinking = false;
        return;
      }

      turn = 1;
      thinking = false;
      status.textContent = '⚫ 당신 차례 (흑돌)';
      drawBoard();
    }

    function resetGame() {
      board = createBoard();
      turn = 1;
      gameOver = false;
      thinking = false;
      winCells = null;
      status.textContent = '⚫ 당신 차례 (흑돌)';
      drawBoard();
    }

    // ====== Events ======
    function getCell(e: MouseEvent): [number, number] | null {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS / rect.width;
      const scaleY = CANVAS / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      const c = Math.round((mx - PAD) / CELL);
      const r = Math.round((my - PAD) / CELL);
      if (!(r >= 0 && r < SIZE && c >= 0 && c < SIZE)) return null;
      const dx = mx - (PAD + c * CELL);
      const dy = my - (PAD + r * CELL);
      if (dx * dx + dy * dy > 18 * 18) return null;
      return [r, c];
    }

    canvas.addEventListener('click', (e) => {
      const cell = getCell(e);
      if (!cell) return;
      placeStone(cell[0], cell[1]);
    });

    canvas.addEventListener('mousemove', (e) => {
      const cell = getCell(e);
      if (cell && !gameOver && !thinking && board[cell[0]][cell[1]] === 0) {
        hoverCell = cell;
      } else {
        hoverCell = null;
      }
      drawBoard();
    });

    canvas.addEventListener('mouseleave', () => {
      hoverCell = null;
      drawBoard();
    });

    // 터치 지원
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS / rect.width;
      const scaleY = CANVAS / rect.height;
      const mx = (touch.clientX - rect.left) * scaleX;
      const my = (touch.clientY - rect.top) * scaleY;
      const c = Math.round((mx - PAD) / CELL);
      const r = Math.round((my - PAD) / CELL);
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
        placeStone(r, c);
      }
    }, { passive: false });

    resetBtn.addEventListener('click', resetGame);
    resetBtn.addEventListener('touchstart', (e) => { e.preventDefault(); resetGame(); }, { passive: false });

    drawBoard();

    game.unmount = () => {};
  },
};

export default game;
