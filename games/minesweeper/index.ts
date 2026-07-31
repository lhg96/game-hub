import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';
import { createChar } from '../../src/char';

let game: GameModule = {
  id: 'minesweeper',
  title: '지뢰찾기',
  description: '지뢰를 피해 칸을 열어라',

  mount(root) {
    const char = createChar({ color: '#6c8cff', label: 'DETECTIVE' });
    const N = 9;
    const MINES = 10;
    const NUM_COLOR = [
      '',
      '#6c8cff',
      '#5ce1a6',
      '#ff7a59',
      '#ff5e5e',
      '#a0e7a0',
      '#ffd166',
      '#ffe08a',
      '#fff3b0',
    ];

    let board: number[]; // -1 mine, >=0 neighbor count
    let revealed: boolean[];
    let flagged: boolean[];
    let over = false;
    let revealedCount = 0;

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;touch-action:manipulation';
    const status = document.createElement('div');
    status.style.cssText = 'font-size:18px;min-height:24px';
    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(9,32px);gap:3px';
    const cells: HTMLButtonElement[] = [];
    const restart = document.createElement('button');
    restart.textContent = '다시 하기';
    restart.className = 'back-btn';
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--muted)';
    hint.textContent = '좌클릭: 열기 · 우클릭: 깃발';
    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:11px;color:var(--muted)';
    charLabel.textContent = 'DETECTIVE';
    wrap.append(charLabel, char.canvas, status, grid, hint, restart);
    root.appendChild(wrap);

    function setStatus(t: string) {
      status.textContent = t;
    }

    function neighbors(i: number): number[] {
      const x = i % N;
      const y = Math.floor(i / N);
      const r: number[] = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < N && ny < N) r.push(ny * N + nx);
        }
      return r;
    }

    function build() {
      board = new Array(N * N).fill(0);
      revealed = new Array(N * N).fill(false);
      flagged = new Array(N * N).fill(false);
      over = false;
      revealedCount = 0;
      const idxs = [...Array(N * N).keys()];
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
      }
      for (let k = 0; k < MINES; k++) board[idxs[k]] = -1;
      for (let i = 0; i < N * N; i++) {
        if (board[i] === -1) continue;
        board[i] = neighbors(i).filter((n) => board[n] === -1).length;
      }
    }

    function draw() {
      for (let i = 0; i < N * N; i++) {
        const c = cells[i];
        if (revealed[i]) {
          c.textContent = board[i] === -1 ? '💣' : board[i] ? String(board[i]) : '';
          c.style.background = board[i] === -1 ? '#5c1a1a' : '#11162a';
          c.style.color = NUM_COLOR[board[i]] ?? '#fff';
        } else {
          c.textContent = flagged[i] ? '🚩' : '';
          c.style.background = '#2a3150';
          c.style.color = '#fff';
        }
      }
    }

    function revealAllMines() {
      for (let i = 0; i < N * N; i++) if (board[i] === -1) revealed[i] = true;
    }

    function reveal(i: number) {
      if (revealed[i] || flagged[i] || over) return;
      if (board[i] === -1) {
        revealed[i] = true;
        over = true;
        revealAllMines();
        draw();
        setStatus('💥 게임 오버');
        char.setState('sad', 999999);
        sound.sad();
        return;
      }
      const stack = [i];
      while (stack.length) {
        const cur = stack.pop()!;
        if (revealed[cur] || flagged[cur]) continue;
        revealed[cur] = true;
        revealedCount++;
        if (board[cur] === 0) {
          for (const n of neighbors(cur))
            if (!revealed[n] && !flagged[n] && board[n] !== -1) stack.push(n);
        }
      }
      if (revealedCount === N * N - MINES) {
        over = true;
        setStatus('🎉 클리어!');
        char.setState('excited', 3000);
        sound.win();
      } else {
        setStatus(`남은 칸: ${N * N - MINES - revealedCount}`);
        sound.tap();
        char.setState('think', 300);
      }
      draw();
    }

    function onLeft(i: number) {
      if (over) return;
      reveal(i);
    }
    function onRight(i: number) {
      if (over || revealed[i]) return;
      flagged[i] = !flagged[i];
      sound.blip();
      draw();
    }

    for (let i = 0; i < N * N; i++) {
      const c = document.createElement('button');
      c.style.cssText =
        'width:32px;height:32px;font-size:15px;border-radius:4px;border:1px solid #1a1f35;cursor:pointer;padding:0';
      c.addEventListener('click', () => onLeft(i));
      c.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onRight(i);
      });
      cells.push(c);
      grid.appendChild(c);
    }

    restart.addEventListener('click', () => {
      build();
      setStatus('좌클릭: 열기');
      draw();
    });
    build();
    setStatus('좌클릭: 열기');
    draw();
  },
};

export default game;
