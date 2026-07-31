/**
 * 오목 AI 엔진 — Minimax + Alpha-Beta + 패턴 평가
 * 15×15 보드, 흑돌(선공) / 백돌(후공)
 */
export type Player = 1 | 2; // 1=black, 2=white
export type Cell = 0 | Player;
export type Board = Cell[][];

const SIZE = 15;

export function createBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0) as Cell[]);
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

const DIRS = [
  [0, 1], [1, 0], [1, 1], [1, -1],
];

/** 연속된 돌 개수와 양쪽 끝 상태 반환 */
function analyzeLine(
  board: Board, r: number, c: number, dr: number, dc: number, player: Player
): { count: number; openEnds: number } {
  let count = 1;
  let openEnds = 0;
  // forward
  let nr = r + dr, nc = c + dc;
  while (inBounds(nr, nc) && board[nr][nc] === player) {
    count++; nr += dr; nc += dc;
  }
  if (inBounds(nr, nc) && board[nr][nc] === 0) openEnds++;
  // backward
  nr = r - dr; nc = c - dc;
  while (inBounds(nr, nc) && board[nr][nc] === player) {
    count++; nr -= dr; nc -= dc;
  }
  if (inBounds(nr, nc) && board[nr][nc] === 0) openEnds++;
  return { count, openEnds };
}

/** 패턴 점수표 */
function patternScore(count: number, openEnds: number): number {
  if (count >= 5) return 100000;
  if (openEnds === 0) return 0;
  if (count === 4 && openEnds === 2) return 10000;
  if (count === 4) return 5000;
  if (count === 3 && openEnds === 2) return 500;
  if (count === 3) return 200;
  if (count === 2 && openEnds === 2) return 50;
  if (count === 2) return 10;
  return 1;
}

/** 특정 플레이어의 전체 보드 평가 */
function evaluateBoard(board: Board, player: Player): number {
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of DIRS) {
        const { count, openEnds } = analyzeLine(board, r, c, dr, dc, player);
        score += patternScore(count, openEnds);
      }
    }
  }
  return score;
}

/** 보드 평가 (AI=흑, 상대=백 기준) */
function evaluate(board: Board): number {
  return evaluateBoard(board, 1) - evaluateBoard(board, 2) * 1.1;
}

/** 가능한 수 (착수할 빈 칸) — 주변에 돌이 있는 칸만 */
function getMoves(board: Board): [number, number][] {
  const moves: [number, number][] = [];
  const hasStone = (r: number, c: number) =>
    inBounds(r, c) && board[r][c] !== 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== 0) continue;
      // 주변 2칸 이내에 돌이 있는 경우만
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++)
        for (let dc = -2; dc <= 2 && !near; dc++)
          if (hasStone(r + dr, c + dc)) near = true;
      if (near) moves.push([r, c]);
    }
  }
  if (moves.length === 0) moves.push([7, 7]); // 중앙
  return moves;
}

/** 정렬: 유망한 수 먼저 (욕심) */
function orderMoves(board: Board, moves: [number, number][]): [number, number][] {
  return moves.sort((a, b) => {
    board[a[0]][a[1]] = 1;
    const sa = evaluate(board);
    board[a[0]][a[1]] = 0;
    board[b[0]][b[1]] = 1;
    const sb = evaluate(board);
    board[b[0]][b[1]] = 0;
    return sb - sa;
  });
}

let nodesSearched = 0;

/** Minimax with Alpha-Beta */
function minimax(
  board: Board, depth: number, alpha: number, beta: number, isMax: boolean
): number {
  nodesSearched++;
  if (depth === 0) return evaluate(board);

  const moves = orderMoves(board, getMoves(board));
  if (moves.length === 0) return evaluate(board);

  if (isMax) {
    let maxEval = -Infinity;
    for (const [r, c] of moves.slice(0, 12)) { // 폭 제한
      board[r][c] = 1;
      const ev = minimax(board, depth - 1, alpha, beta, false);
      board[r][c] = 0;
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const [r, c] of moves.slice(0, 12)) {
      board[r][c] = 2;
      const ev = minimax(board, depth - 1, alpha, beta, true);
      board[r][c] = 0;
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/** AI 최적 수 찾기 */
export function findBestMove(board: Board, difficulty: number = 3): [number, number] | null {
  nodesSearched = 0;
  const moves = orderMoves(board, getMoves(board));
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const [r, c] of moves.slice(0, 15)) {
    board[r][c] = 1;
    const score = minimax(board, difficulty, -Infinity, Infinity, false);
    board[r][c] = 0;
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }
  return bestMove;
}

/** 승리 체크 */
export function checkWin(board: Board, player: Player): [number, number][] | null {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of DIRS) {
        const cells: [number, number][] = [];
        let nr = r, nc = c;
        let count = 0;
        while (inBounds(nr, nc) && board[nr][nc] === player) {
          cells.push([nr, nc]);
          count++;
          nr += dr; nc += dc;
        }
        if (count >= 5) return cells.slice(0, 5);
      }
    }
  }
  return null;
}

/** 무승부 체크 */
export function isDraw(board: Board): boolean {
  return board.every(row => row.every(c => c !== 0));
}
