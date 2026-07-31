/**
 * 오목 AI 엔진 v2 — Player 관점 보정 + 강화된 평가
 * 누구나 AI/인간 흑백 선택 가능 (aiPlayer 파라미터)
 */
export type Player = 1 | 2;
export type Cell = 0 | Player;
export type Board = Cell[][];

const SIZE = 15;

export function createBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0) as Cell[]);
}

function ib(r: number, c: number) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function analyze(board: Board, r: number, c: number, dr: number, dc: number, p: Player) {
  let cnt = 1, open = 0;
  let nr = r + dr, nc = c + dc;
  while (ib(nr, nc) && board[nr][nc] === p) { cnt++; nr += dr; nc += dc; }
  if (ib(nr, nc) && board[nr][nc] === 0) open++;
  nr = r - dr; nc = c - dc;
  while (ib(nr, nc) && board[nr][nc] === p) { cnt++; nr -= dr; nc -= dc; }
  if (ib(nr, nc) && board[nr][nc] === 0) open++;
  return { cnt, open };
}

/** 패턴 스코어 */
function patScore(cnt: number, open: number): number {
  if (cnt >= 5) return 100000;
  if (open === 0) return 0;
  if (cnt === 4 && open === 2) return 50000;
  if (cnt === 4) return 5000;
  if (cnt === 3 && open === 2) return 3000;
  if (cnt === 3) return 500;
  if (cnt === 2 && open === 2) return 200;
  if (cnt === 2) return 50;
  if (cnt === 1 && open === 2) return 10;
  return 3;
}

/** 특정 플레이어 전체 평가 */
function evalBoard(board: Board, p: Player): number {
  let score = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== p) continue;
      for (const [dr, dc] of DIRS) {
        const { cnt, open } = analyze(board, r, c, dr, dc, p);
        score += patScore(cnt, open);
      }
    }
  return score;
}

/** AI 관점 평가 */
function evaluate(board: Board, ai: Player): number {
  const opp: Player = ai === 1 ? 2 : 1;
  return evalBoard(board, ai) * 1.0 - evalBoard(board, opp) * 1.15;
}

function getMoves(board: Board): [number, number][] {
  const mvs: [number, number][] = [];
  const near = (r: number, c: number) => {
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++)
        if (ib(r + dr, c + dc) && board[r + dr][c + dc] !== 0) return true;
    return false;
  };
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c] === 0 && near(r, c)) mvs.push([r, c]);
  if (mvs.length === 0) mvs.push([7, 7]);
  return mvs;
}

function orderMoves(board: Board, mvs: [number, number][], ai: Player): [number, number][] {
  return mvs.sort((a, b) => {
    board[a[0]][a[1]] = ai;
    const sa = evaluate(board, ai);
    board[a[0]][a[1]] = 0;
    board[b[0]][b[1]] = ai;
    const sb = evaluate(board, ai);
    board[b[0]][b[1]] = 0;
    return sb - sa;
  });
}

function mm(
  board: Board, depth: number, alpha: number, beta: number,
  isMax: boolean, ai: Player, opp: Player
): number {
  if (depth === 0) return evaluate(board, ai);
  const mvs = orderMoves(board, getMoves(board), isMax ? ai : opp);
  if (mvs.length === 0) return evaluate(board, ai);
  const p = isMax ? ai : opp;
  const limit = depth >= 3 ? 10 : 14;
  if (isMax) {
    let best = -Infinity;
    for (const [r, c] of mvs.slice(0, limit)) {
      board[r][c] = p;
      const v = mm(board, depth - 1, alpha, beta, false, ai, opp);
      board[r][c] = 0;
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const [r, c] of mvs.slice(0, limit)) {
      board[r][c] = p;
      const v = mm(board, depth - 1, alpha, beta, true, ai, opp);
      board[r][c] = 0;
      best = Math.min(best, v);
      beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return best;
  }
}

/** AI 최적 수 찾기 — aiPlayer: AI의 플레이어 번호 */
export function findBestMove(board: Board, aiPlayer: Player, depth: number = 3): [number, number] | null {
  const opp: Player = aiPlayer === 1 ? 2 : 1;
  const mvs = orderMoves(board, getMoves(board), aiPlayer);
  if (mvs.length === 0) return null;

  let bestMove = mvs[0];
  let bestScore = -Infinity;

  const limit = Math.min(mvs.length, 12);
  for (let i = 0; i < limit; i++) {
    const [r, c] = mvs[i];
    board[r][c] = aiPlayer;
    const score = mm(board, depth, -Infinity, Infinity, false, aiPlayer, opp);
    board[r][c] = 0;
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }
  return bestMove;
}

/** 승리 체크 — 당첨 라인 좌표 반환 */
export function checkWin(board: Board, p: Player): [number, number][] | null {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== p) continue;
      for (const [dr, dc] of DIRS) {
        const cells: [number, number][] = [];
        let nr = r, nc = c;
        while (ib(nr, nc) && board[nr][nc] === p) {
          cells.push([nr, nc]);
          nr += dr; nc += dc;
        }
        if (cells.length >= 5) return cells.slice(0, 5);
      }
    }
  return null;
}

export function isDraw(board: Board): boolean {
  return board.every(row => row.every(c => c !== 0));
}
