/**
 * 바둑 AI 엔진 — 9×9, liberty capture, territory scoring
 */
export type Player = 1 | 2; // 1=black, 2=white
export type Cell = 0 | Player;
export type Board = Cell[][];

const SIZE = 9;

export function createBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0) as Cell[]);
}

function ib(r: number, c: number) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];

interface Group { stones: [number,number][]; liberties: Set<string> }

/** 그룹(동일색 돌 연결)과 liberties 계산 */
export function getGroup(board: Board, r: number, c: number): Group {
  const p = board[r][c];
  if (p === 0) return { stones: [], liberties: new Set() };
  const stones: [number, number][] = [];
  const liberties = new Set<string>();
  const visited = new Set<string>();
  const stack = [[r, c]];
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    const key = `${cr},${cc}`;
    if (visited.has(key)) continue;
    visited.add(key);
    stones.push([cr, cc]);
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (!ib(nr, nc)) continue;
      if (board[nr][nc] === p && !visited.has(`${nr},${nc}`)) stack.push([nr, nc]);
      if (board[nr][nc] === 0) liberties.add(`${nr},${nc}`);
    }
  }
  return { stones, liberties };
}

function removeGroup(board: Board, group: Group) {
  for (const [r, c] of group.stones) board[r][c] = 0;
}

/** 착수 + 포위 제거. ko 방어를 위해 이전 보드 반환 */
export function place(board: Board, r: number, c: number, p: Player, prevBoard?: Board): boolean {
  if (board[r][c] !== 0) return false;
  // ko 검사
  if (prevBoard && prevBoard[r][c] === p) return false;

  board[r][c] = p;
  const opp: Player = p === 1 ? 2 : 1;
  let captured = false;

  // 상대 돌 포위 확인
  for (const [dr, dc] of DIRS) {
    const nr = r + dr, nc = c + dc;
    if (!ib(nr, nc) || board[nr][nc] !== opp) continue;
    const g = getGroup(board, nr, nc);
    if (g.liberties.size === 0) { removeGroup(board, g); captured = true; }
  }
  // 내 돌 포위 확인 (자살)
  const myGroup = getGroup(board, r, c);
  if (myGroup.liberties.size === 0) { board[r][c] = 0; return false; }

  return true;
}

/** 가능한 수 */
function getMoves(board: Board, p: Player, prevBoard?: Board): [number, number][] {
  const mvs: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== 0) continue;
      // 시뮬레이션
      const test = board.map(row => [...row]);
      if (place(test, r, c, p, prevBoard)) mvs.push([r, c]);
    }
  return mvs;
}

/** 영역 평가 (단순: 모서리 + 영향력) */
function evaluate(board: Board, p: Player): number {
  let score = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === p) score += 1;
      else if (board[r][c] === 0) {
        // 영향력 근사: 주변 돌 비율
        let black = 0, white = 0, total = 0;
        for (let dr = -3; dr <= 3; dr++)
          for (let dc = -3; dc <= 3; dc++) {
            const nr = r + dr, nc = c + dc;
            if (ib(nr, nc) && board[nr][nc] !== 0) {
              if (board[nr][nc] === 1) black++; else white++;
              total++;
            }
          }
        if (total > 0) {
          if (p === 1 && black > white) score += 0.5;
          if (p === 2 && white > black) score += 0.5;
        }
      }
    }
  return score;
}

function minimax(board: Board, depth: number, alpha: number, beta: number, isMax: boolean, ai: Player, prevBoard?: Board): number {
  if (depth === 0) return evaluate(board, ai);
  const opp: Player = ai === 1 ? 2 : 1;
  const p = isMax ? ai : opp;
  const mvs = getMoves(board, p, prevBoard);
  if (mvs.length === 0) return evaluate(board, ai);

  if (isMax) {
    let best = -Infinity;
    for (const [r, c] of mvs.slice(0, 15)) {
      const test = board.map(row => [...row]);
      place(test, r, c, p);
      const v = minimax(test, depth - 1, alpha, beta, false, ai, board);
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const [r, c] of mvs.slice(0, 15)) {
      const test = board.map(row => [...row]);
      place(test, r, c, p);
      const v = minimax(test, depth - 1, alpha, beta, true, ai, board);
      best = Math.min(best, v);
      beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function findBestMoveB(board: Board, ai: Player): [number, number] | null {
  const mvs = getMoves(board, ai);
  if (mvs.length === 0) return null;
  const opp: Player = ai === 1 ? 2 : 1;
  let bestMove = mvs[0];
  let bestScore = -Infinity;
  for (const [r, c] of mvs) {
    const test = board.map(row => [...row]);
    place(test, r, c, ai);
    const score = minimax(test, 1, -Infinity, Infinity, false, ai, board);
    if (score > bestScore) { bestScore = score; bestMove = [r, c]; }
  }
  return bestMove;
}
