import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';
import { createChar } from '../../src/char';

const BEST_KEY = 'tictactoe.best'; // 최다 승리 기록 (localStorage)

type Cell = 'X' | 'O' | '';
type Board = Cell[];

const HUMAN: Cell = 'X';
const AI: Cell = 'O';

function loadBest(): number {
  return Number(localStorage.getItem(BEST_KEY) ?? '0');
}
function saveBest(v: number): void {
  localStorage.setItem(BEST_KEY, String(v));
}

function winningLine(b: Board): number[] | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, c, d] of lines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return [a, c, d];
  }
  return null;
}

/** 미니맥스 기반 무패 AI */
function aiMove(b: Board): number {
  function minimax(board: Board, player: Cell): number {
    const line = winningLine(board);
    if (line) return player === AI ? 1 : -1;
    if (board.every((c) => c)) return 0; // 무승부

    let best = player === AI ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      const next = board.slice();
      next[i] = player;
      const score = minimax(next, player === AI ? HUMAN : AI);
      best = player === AI ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
  }

  let bestScore = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    const next = b.slice();
    next[i] = AI;
    const score = minimax(next, HUMAN);
    if (score > bestScore) {
      bestScore = score;
      move = i;
    }
  }
  return move;
}

type Difficulty = 'easy' | 'normal' | 'hard';

/** 난이도별 AI 수 선택. hard=완벽(무패), normal=70% 완벽+30% 랜덤, easy=랜덤 위주 */
function chooseMove(b: Board, diff: Difficulty): number {
  const empties = b.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (empties.length === 0) return -1;
  if (diff === 'hard') return aiMove(b);
  if (diff === 'normal') {
    if (Math.random() < 0.3) return empties[Math.floor(Math.random() * empties.length)];
    return aiMove(b);
  }
  // easy: 60% 랜덤
  if (Math.random() < 0.6) return empties[Math.floor(Math.random() * empties.length)];
  return aiMove(b);
}

const game: GameModule = {
  id: 'tic-tac-toe',
  title: '틱택토',
  description: 'AI(난이도 선택)와 대결',

  mount(root) {
    const char = createChar({ color: '#b06cf0', label: 'SAGE' });
    let board: Board = Array(9).fill('');
    let over = false;
    let best = loadBest();
    let diff: Difficulty = 'hard'; // 기본 어려움(완벽 무패)

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%';

    const status = document.createElement('div');
    status.className = 'ttt-status';
    status.style.cssText = 'font-size:18px;min-height:24px';

    const bestLine = document.createElement('div');
    bestLine.style.cssText = 'font-size:13px;color:var(--muted)';
    bestLine.textContent = `최다 연승: ${best}`;

    // 난이도 선택
    const diffRow = document.createElement('div');
    diffRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center';
    const diffs: { key: Difficulty; label: string }[] = [
      { key: 'easy', label: '쉬움' },
      { key: 'normal', label: '보통' },
      { key: 'hard', label: '어려움' },
    ];
    const diffBtns: Record<string, HTMLButtonElement> = {};
    diffs.forEach((d) => {
      const b = document.createElement('button');
      b.textContent = d.label;
      b.className = 'back-btn';
      b.style.cssText =
        'padding:6px 14px;font-size:13px' + (d.key === diff ? ';outline:2px solid var(--accent)' : '');
      b.addEventListener('click', () => {
        diff = d.key;
        Object.values(diffBtns).forEach((x) => (x.style.outline = 'none'));
        b.style.outline = '2px solid var(--accent)';
        resetGame();
      });
      diffBtns[d.key] = b;
      diffRow.appendChild(b);
    });

    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:11px;color:var(--muted)';
    charLabel.textContent = 'SAGE (AI)';

    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(3,90px);gap:8px';

    const cells: HTMLButtonElement[] = [];
    for (let i = 0; i < 9; i++) {
      const btn = document.createElement('button');
      btn.style.cssText =
        'width:90px;height:90px;font-size:40px;font-weight:700;border-radius:14px;' +
        'border:1px solid #2a3150;background:var(--panel);color:var(--text);cursor:pointer';
      btn.addEventListener('click', () => onHuman(i));
      cells.push(btn);
      grid.appendChild(btn);
    }

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '다시 하기';
    resetBtn.className = 'back-btn';
    resetBtn.addEventListener('click', () => resetGame());

    wrap.append(charLabel, char.canvas, status, bestLine, diffRow, grid, resetBtn);
    root.appendChild(wrap);

    let streak = 0;

    function draw() {
      for (let i = 0; i < 9; i++) cells[i].textContent = board[i];
    }
    function setStatus(t: string) {
      status.textContent = t;
    }

    function onHuman(i: number) {
      if (over || board[i]) return;
      board[i] = HUMAN;
      sound.tap();
      draw();
      if (checkEnd()) return;

      setStatus('AI 생각 중…');
      char.setState('think', 400);
      // 약간의 지연으로 자연스럽게
      setTimeout(() => {
        const m = chooseMove(board, diff);
        if (m < 0) return;
        board[m] = AI;
        draw();
        checkEnd();
      }, 250);
    }

    function checkEnd(): boolean {
      const line = winningLine(board);
      if (line) {
        over = true;
        for (const i of line)
          (cells[i].style.border = '2px solid var(--accent)');
        const winner = board[line[0]];
        if (winner === HUMAN) {
          streak++;
          best = Math.max(best, streak);
          saveBest(best);
          bestLine.textContent = `최다 연승: ${best}`;
          setStatus('🎉 이겼습니다! (연승 ' + streak + ')');
          char.setState('sad', 2000);
          sound.win();
        } else {
          streak = 0;
          setStatus('😢 졌습니다. (연승 초기화)');
          char.setState('happy', 2000);
          sound.sad();
        }
        return true;
      }
      if (board.every((c) => c)) {
        over = true;
        streak = 0;
        setStatus('🤝 무승부');
        char.setState('idle');
        return true;
      }
      setStatus('당신 차례 (X)');
      char.setState('idle');
      return false;
    }

    function resetGame() {
      board = Array(9).fill('');
      over = false;
      draw();
      for (const c of cells) c.style.border = '1px solid #2a3150';
      // 어려움/보통은 AI 선공 → 사용자에게 더 어렵게
      if (diff !== 'easy') {
        const first = chooseMove(board, diff);
        if (first >= 0) board[first] = AI;
        draw();
        setStatus('AI 선공! 당신 차례 (X)');
        char.setState('think', 600);
      } else {
        setStatus('당신 차례 (X)');
        char.setState('idle');
      }
    }

    resetGame();
  },
};

export default game;
