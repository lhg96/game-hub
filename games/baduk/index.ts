/**
 * 바둑 게임 — weiqi.js 엔진 (https://github.com/cjlarose/weiqi.js)
 * - 규칙: liberty capture, superko, 패스, 영역 점수 (전부 엔진 제공)
 * - AI: 간단 휴리스틱 (포위 위협 감지 + 영향력)
 */
import Weiqi from 'weiqi';
import type { GameModule } from '../../src/types';

const SIZE = 19;
const CELL = 26;
const PAD = 18;
const CW = CELL * (SIZE - 1) + PAD * 2;

type GameState = ReturnType<typeof Weiqi.createGame>;

// ====== AI: weiqi.js 위에 얹는 간단 휴리스틱 ======
function getBoardArray(game: GameState): string[][] {
  // x=black, o=white, .=empty
  const b: string[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill('.'));
  const stones = game.get('board').get('stones') as any;
  stones.forEach((color: string, pos: any) => {
    b[pos.get('i')][pos.get('j')] = color === 'black' ? 'x' : 'o';
  });
  return b;
}

function findGroup(board: string[][], r: number, c: number): { stones: [number, number][]; liberties: [number, number][] } {
  const color = board[r][c];
  if (color === '.') return { stones: [], liberties: [] };
  const stones: [number, number][] = [];
  const liberties = new Set<string>();
  const visited = new Set<string>();
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const key = `${cr},${cc}`;
    if (visited.has(key)) continue;
    visited.add(key);
    stones.push([cr, cc]);
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = cr + dr, nc = cc + dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
      if (board[nr][nc] === color && !visited.has(`${nr},${nc}`)) stack.push([nr, nc]);
      if (board[nr][nc] === '.') liberties.add(`${nr},${nc}`);
    }
  }
  return { stones, liberties: [...liberties].map(s => s.split(',').map(Number) as [number, number]) };
}

function aiFindMove(game: GameState): [number, number] | null {
  const board = getBoardArray(game);
  const myColor: string = game.get('currentPlayer') === 'black' ? 'x' : 'o';
  const oppColor = myColor === 'x' ? 'o' : 'x';
  const moves: [number, number, number][] = []; // r, c, score

  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== '.') continue;

      // 착수 시뮬레이션
      let score = 0;

      // 1. 상대 그룹 포위 (죽일 수 있는지)
      let captures = 0;
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || board[nr][nc] !== oppColor) continue;
        const g = findGroup(board, nr, nc);
        if (g.liberties.length === 1) captures += g.stones.length;
      }
      score += captures * 50;

      // 2. 내 그룹 연결/확장
      let myNeighbors = 0, oppNeighbors = 0;
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (board[nr][nc] === myColor) myNeighbors++;
        if (board[nr][nc] === oppColor) oppNeighbors++;
      }
      score += myNeighbors * 8;
      score += oppNeighbors * 2;

      // 4. 중앙 선호 (초반)
      const totalStones = board.flat().filter(x => x !== '.').length;
      if (totalStones < 40) {
        const dist = Math.abs(r - 9) + Math.abs(c - 9);
        score += Math.max(0, 16 - dist) * 3;
      }

      if (score > 0 || captures > 0) moves.push([r, c, score]);
    }

  // 아무 수 없으면 빈 곳 아무데나 (중앙 근처)
  if (moves.length === 0) {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (board[r][c] === '.') moves.push([r, c, Math.max(0, 16 - (Math.abs(r - 9) + Math.abs(c - 9))) * 3]);
  }

  moves.sort((a, b) => b[2] - a[2]);
  // 상위 몇 개에서 랜덤 (다양성)
  const top = moves.slice(0, Math.min(5, moves.length));
  const pick = top[Math.floor(Math.random() * top.length)];
  return pick ? [pick[0], pick[1]] : null;
}

// ====== Game Module ======
let game: GameModule = {
  id: 'baduk',
  title: '바둑',
  description: 'AI와 19×19 바둑 (weiqi.js 엔진)',

  mount(root) {
    let gameState: GameState = Weiqi.createGame(SIZE);
    let gameOver = false;
    let thinking = false;
    let captures: [number, number] = [0, 0];

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

    const canvas = document.createElement('canvas');
    canvas.width = CW; canvas.height = CW;
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
    function tone(f: number, d: number, t: OscillatorType = 'sine', v = 0.07) {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        const c = new Ctor(); const o = c.createOscillator(); const g = c.createGain();
        o.type = t; o.frequency.value = f;
        g.gain.setValueAtTime(v, 0); g.gain.exponentialRampToValueAtTime(0.0001, d);
        o.connect(g).connect(c.destination); o.start(); o.stop(d);
        setTimeout(() => c.close(), d * 1000 + 100);
      } catch (_) { }
    }
    function sPlace() { tone(700, 0.05, 'triangle', 0.1); }
    function sWin() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'sine', 0.08), i * 70)); }
    function sLose() { [440, 350, 260].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'sawtooth', 0.06), i * 90)); }

    // Board helpers
    function getBoard(): string[][] {
      return getBoardArray(gameState);
    }

    function draw() {
      // 배경
      ctx.fillStyle = '#c8954a'; ctx.fillRect(0, 0, CW, CW);
      ctx.strokeStyle = 'rgba(160,120,60,0.15)'; ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const y = Math.random() * CW;
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x < CW; x += 4) ctx.lineTo(x, y + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }

      // 격자
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.6;
      for (let i = 0; i < SIZE; i++) {
        const p = PAD + i * CELL;
        ctx.beginPath(); ctx.moveTo(PAD, p); ctx.lineTo(PAD + (SIZE - 1) * CELL, p); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p, PAD); ctx.lineTo(p, PAD + (SIZE - 1) * CELL); ctx.stroke();
      }

      // 별표 (19×19 = 9곳)
      const stars = [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
      ctx.fillStyle = '#333';
      for (const [r, c] of stars) { ctx.beginPath(); ctx.arc(PAD + c * CELL, PAD + r * CELL, 2.5, 0, Math.PI * 2); ctx.fill(); }

      // 돌
      const b = getBoard();
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) {
          if (b[r][c] === '.') continue;
          const x = PAD + c * CELL, y = PAD + r * CELL;
          const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 14);
          if (b[r][c] === 'x') { g.addColorStop(0, '#555'); g.addColorStop(0.6, '#222'); g.addColorStop(1, '#000'); }
          else { g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#eee'); g.addColorStop(1, '#ccc'); }
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = b[r][c] === 'x' ? '#000' : '#aaa'; ctx.lineWidth = 0.5; ctx.stroke();
        }
    }

    function updateCaptured(prev: string[][], next: string[][]) {
      // 포획 수 계산 (간단히 돌 개수 차이)
      const count = (b: string[][], color: string) => b.flat().filter(x => x === color).length;
      const prevB = count(prev, 'x'), prevW = count(prev, 'o');
      const nextB = count(next, 'x'), nextW = count(next, 'o');
      if (nextB < prevB) captures[1] += prevB - nextB; // 백이 흑 잡음
      if (nextW < prevW) captures[0] += prevW - nextW;
      bcapEl.textContent = String(captures[0]);
      wcapEl.textContent = String(captures[1]);
    }

    function endGame() {
      gameOver = true;
      const score = Weiqi.areaScore(gameState, 7.5); // 백에게 7.5점 komi
      // score > 0 → 흑 승, score < 0 → 백 승
      if (score > 0) {
        status.textContent = `🎉 흑 승! (${score.toFixed(1)}점)`;
        sWin();
      } else {
        status.textContent = `😢 백 승... (${(-score).toFixed(1)}점)`;
        sLose();
      }
    }

    function doPlay(r: number, c: number): boolean {
      const cur = gameState.get('currentPlayer');
      const prev = getBoard();
      try {
        gameState = Weiqi.play(gameState, cur, [r, c]);
      } catch (e) {
        return false;
      }
      const next = getBoard();
      updateCaptured(prev, next);
      sPlace();
      draw();
      return true;
    }

    function aiTurn() {
      thinking = true;
      setTimeout(() => {
        if (gameOver) { thinking = false; return; }
        const cur = gameState.get('currentPlayer');
        const move = aiFindMove(gameState);
        if (!move) {
          // 수 없으면 패스
          gameState = Weiqi.pass(gameState, cur);
          if (Weiqi.isOver(gameState)) { endGame(); thinking = false; return; }
          status.textContent = '🤖 AI 패스';
          thinking = false;
          setTimeout(() => { if (!gameOver) { status.textContent = '⚫ 당신 차례'; } }, 300);
          return;
        }
        const prev = getBoard();
        try {
          gameState = Weiqi.play(gameState, cur, move);
        } catch (e) {
          // 실패 시 패스
          gameState = Weiqi.pass(gameState, cur);
        }
        const next = getBoard();
        updateCaptured(prev, next);
        sPlace();
        draw();
        if (Weiqi.isOver(gameState)) { endGame(); thinking = false; return; }
        thinking = false;
        status.textContent = '⚫ 당신 차례';
      }, 300);
    }

    canvas.addEventListener('click', (e) => {
      if (gameOver || thinking) return;
      const rect = canvas.getBoundingClientRect();
      const sx = CW / rect.width, sy = CW / rect.height;
      const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
      const c = Math.round((mx - PAD) / CELL), r = Math.round((my - PAD) / CELL);
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
      if (doPlay(r, c)) {
        if (Weiqi.isOver(gameState)) { endGame(); return; }
        status.textContent = '🤖 AI 생각 중...';
        aiTurn();
      }
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const ev = new MouseEvent('click', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      canvas.dispatchEvent(ev);
    }, { passive: false });

    passBtn.addEventListener('click', () => {
      if (gameOver || thinking) return;
      const cur = gameState.get('currentPlayer');
      gameState = Weiqi.pass(gameState, cur);
      if (Weiqi.isOver(gameState)) { endGame(); return; }
      status.textContent = '🤖 AI 생각 중...';
      aiTurn();
    });

    function reset() {
      gameState = Weiqi.createGame(SIZE);
      gameOver = false; thinking = false; captures = [0, 0];
      bcapEl.textContent = '0'; wcapEl.textContent = '0';
      status.textContent = '⚫ 당신 차례 (흑)';
      draw();
    }

    resetBtn.addEventListener('click', reset);
    draw();
    game.unmount = () => { };
  },
};

export default game;
