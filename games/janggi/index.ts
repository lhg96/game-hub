import type { GameModule } from '../../src/types';
import { createBoard, getMovesFor, findBestMoveJ, isCheckmate, PIECE_SYMBOLS, PIECE_NAMES } from './ai';
import type { Board, Player } from './ai';

const ROWS = 10, COLS = 9, CELL = 50, PAD = 30;
const CW = CELL * (COLS - 1) + PAD * 2;
const CH = CELL * (ROWS - 1) + PAD * 2;

let game: GameModule = {
  id: 'janggi',
  title: '장기',
  description: 'AI와 한·초 장기 대결',

  mount(root) {
    let board: Board = createBoard();
    let turn: Player = 1; // 1=bottom(red), 2=top(blue)
    let selected: [number, number] | null = null;
    let validMoves: [number, number][] = [];
    let gameOver = false;
    let thinking = false;

    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0;';

    const style = document.createElement('style');
    style.textContent = `
      @keyframes piecePop { 0% { transform:scale(0.6);opacity:0.5; } 100% { transform:scale(1);opacity:1; } }
      .piece-placed { animation:piecePop 0.2s ease-out; }
    `;

    const status = document.createElement('div');
    status.style.cssText = 'font-size:0.9rem;font-weight:600;color:#ffd700;min-height:22px;';
    status.textContent = '🔴 당신 차례 (한)';

    const canvas = document.createElement('canvas');
    canvas.width = CW; canvas.height = CH;
    canvas.style.cssText = 'border-radius:6px;cursor:pointer;max-width:100%;height:auto;';
    const ctx = canvas.getContext('2d')!;

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 새 게임';
    resetBtn.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:6px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.8rem;';

    container.append(style, status, canvas, resetBtn);
    root.appendChild(container);

    // Audio
    function tone(f: number, d: number, t: OscillatorType = 'sine', v = 0.08) {
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
    function sMove() { tone(500, 0.06, 'triangle', 0.1); }
    function sCapture() { tone(300, 0.12, 'square', 0.1); }
    function sWin() { [523,659,784,1047].forEach((f,i) => setTimeout(()=>tone(f,0.12,'sine',0.08),i*70)); }
    function sLose() { [440,350,260].forEach((f,i) => setTimeout(()=>tone(f,0.15,'sawtooth',0.06),i*90)); }

    function draw() {
      // 배경
      ctx.fillStyle = '#c8954a';
      ctx.fillRect(0, 0, CW, CH);

      // 격자
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.6;
      for (let r = 0; r < ROWS; r++) {
        const y = PAD + r * CELL;
        ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(PAD + (COLS - 1) * CELL, y); ctx.stroke();
      }
      for (let c = 0; c < COLS; c++) {
        const x = PAD + c * CELL;
        // 궁성 대각선
        if (c === 3 || c === 5) {
          for (const pr of [0, 7]) {
            ctx.beginPath(); ctx.moveTo(x, PAD + pr * CELL); ctx.lineTo(PAD + (c === 3 ? 5 : 3) * CELL, PAD + (pr + 2) * CELL); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, PAD + (pr + 2) * CELL); ctx.lineTo(PAD + (c === 3 ? 5 : 3) * CELL, PAD + pr * CELL); ctx.stroke();
          }
        }
        // 세로선 (궁성 내부는 생략)
        if (c === 3 || c === 4 || c === 5) {
          ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, PAD + 2 * CELL); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, PAD + 7 * CELL); ctx.lineTo(x, PAD + 9 * CELL); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, PAD + (ROWS - 1) * CELL); ctx.stroke();
        }
      }

      // 기물
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const pc = board[r][c];
          if (!pc) continue;
          const x = PAD + c * CELL, y = PAD + r * CELL;
          const isSel = selected && selected[0] === r && selected[1] === c;

          // 원형 배경
          const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, 18);
          const isRed = pc.player === 1;
          if (isSel) {
            grad.addColorStop(0, '#ffe066'); grad.addColorStop(1, '#ffcc00');
          } else if (isRed) {
            grad.addColorStop(0, '#ff7766'); grad.addColorStop(1, '#cc3322');
          } else {
            grad.addColorStop(0, '#6699ff'); grad.addColorStop(1, '#2244aa');
          }
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isRed ? '#881100' : '#002288';
          ctx.lineWidth = 1.2; ctx.stroke();

          // 글자
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(PIECE_NAMES[pc.type][pc.player === 1 ? 0 : 1], x, y + 1);
        }

      // 선택 표시
      for (const [mr, mc] of validMoves) {
        const x = PAD + mc * CELL, y = PAD + mr * CELL;
        if (board[mr][mc]) {
          ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255,255,100,0.4)';
          ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    function gameEnd(winner: Player) {
      gameOver = true;
      if (winner === 1) { status.textContent = '🎉 승리!'; sWin(); }
      else { status.textContent = '😢 패배!'; sLose(); }
      draw();
    }

    function tryMove(r: number, c: number, nr: number, nc: number) {
      const captured = board[nr][nc];
      board[nr][nc] = board[r][c]; board[r][c] = null;
      if (captured) sCapture(); else sMove();
      draw();

      // 체크메이트?
      const opp: Player = turn === 1 ? 2 : 1;
      if (isCheckmate(board, opp)) { gameEnd(turn); return true; }

      turn = opp;
      selected = null; validMoves = [];
      if (turn === 1) {
        status.textContent = '🔴 당신 차례 (한)';
        draw();
      } else {
        status.textContent = '🤖 AI 생각 중...';
        thinking = true;
        setTimeout(() => {
          const mv = findBestMoveJ(board, 2);
          thinking = false;
          if (!mv) { status.textContent = '🤝 무승부!'; draw(); return; }
          const [fr, fc, tr, tc] = mv;
          const cap = board[tr][tc];
          board[tr][tc] = board[fr][fc]; board[fr][fc] = null;
          if (cap) sCapture(); else sMove();
          draw();
          if (isCheckmate(board, 1)) { gameEnd(2); return; }
          turn = 1;
          status.textContent = '🔴 당신 차례 (한)';
        }, 100);
      }
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver || thinking) return;
      const rect = canvas.getBoundingClientRect();
      const sx = CW / rect.width, sy = CH / rect.height;
      const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
      const c = Math.round((mx - PAD) / CELL), r = Math.round((my - PAD) / CELL);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

      if (selected) {
        // 이동
        const valid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (valid) { tryMove(selected[0], selected[1], r, c); return; }
        // 다른 내 기물 선택
        if (board[r][c] && board[r][c]!.player === turn) {
          selected = [r, c];
          validMoves = getMovesFor(board, r, c);
          draw();
          return;
        }
        selected = null; validMoves = []; draw();
      } else {
        if (board[r][c] && board[r][c]!.player === turn) {
          selected = [r, c];
          validMoves = getMovesFor(board, r, c);
          draw();
        }
      }
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const sx = CW / rect.width, sy = CH / rect.height;
      const mx = (touch.clientX - rect.left) * sx, my = (touch.clientY - rect.top) * sy;
      const c = Math.round((mx - PAD) / CELL), r = Math.round((my - PAD) / CELL);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      // Trigger click logic
      const ev = new MouseEvent('click', { clientX: touch.clientX, clientY: touch.clientY });
      canvas.dispatchEvent(ev);
    }, { passive: false });

    function reset() {
      board = createBoard();
      turn = 1; selected = null; validMoves = []; gameOver = false; thinking = false;
      status.textContent = '🔴 당신 차례 (한)';
      draw();
    }

    resetBtn.addEventListener('click', reset);
    draw();

    game.unmount = () => {};
  },
};

export default game;
