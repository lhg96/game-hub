/**
 * 장기 AI 엔진 — 9×10, Minimax + 물질 평가
 */
export type Player = 1 | 2; // 1=bottom(red/한), 2=top(blue/초)
export type PieceType = 'K'|'A'|'B'|'H'|'E'|'C'|'S'; // King, Advisor, Bishop(guard), Horse, Elephant, Cannon, Soldier
export interface Piece { type: PieceType; player: Player }
export type Cell = Piece | null;
export type Board = Cell[][]; // [row][col], row 0=top

const ROWS = 10, COLS = 9;

export function createBoard(): Board {
  const b: Board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const setup = (row: number, pieces: PieceType[], p: Player) => {
    b[row][0] = { type: pieces[0], player: p };
    b[row][1] = { type: pieces[1], player: p };
    b[row][2] = { type: pieces[2], player: p };
    b[row][3] = { type: pieces[3], player: p };
    b[row][4] = { type: pieces[4], player: p };
    b[row][5] = { type: pieces[3], player: p };
    b[row][6] = { type: pieces[2], player: p };
    b[row][7] = { type: pieces[1], player: p };
    b[row][8] = { type: pieces[0], player: p };
  };
  setup(0, ['C','H','E','A','K','A','E','H','C'], 2);
  b[2][1] = { type: 'S', player: 2 };
  b[2][5] = { type: 'S', player: 2 };
  b[3][0] = { type: 'S', player: 2 };
  b[3][2] = { type: 'S', player: 2 };
  b[3][4] = { type: 'S', player: 2 };
  b[3][6] = { type: 'S', player: 2 };
  b[3][8] = { type: 'S', player: 2 };

  setup(9, ['C','H','E','A','K','A','E','H','C'], 1);
  b[7][1] = { type: 'S', player: 1 };
  b[7][5] = { type: 'S', player: 1 };
  b[6][0] = { type: 'S', player: 1 };
  b[6][2] = { type: 'S', player: 1 };
  b[6][4] = { type: 'S', player: 1 };
  b[6][6] = { type: 'S', player: 1 };
  b[6][8] = { type: 'S', player: 1 };
  return b;
}

export const PIECE_NAMES: Record<PieceType, [string, string]> = {
  K: ['한', '초'], A: ['사', '사'], B: ['상', '상'],
  H: ['마', '마'], E: ['상', '상'], C: ['포', '포'], S: ['병', '졸'],
};
export const PIECE_SYMBOLS: Record<PieceType, string> = {
  K: '👑', A: '🔶', B: '🔷', H: '🐴', E: '🐘', C: '💣', S: '⚔️',
};
export const PIECE_VALUES: Record<PieceType, number> = {
  K: 10000, A: 300, B: 300, H: 500, E: 500, C: 700, S: 200,
};

function ib(r: number, c: number) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
function inP(r: number, c: number, p: Player) {
  const pr = p === 1 ? 7 : 0;
  return r >= pr && r <= pr + 2 && c >= 3 && c <= 5;
}

/** 기물 이동 가능 위치 */
export function getMovesFor(board: Board, r: number, c: number): [number, number][] {
  const p = board[r][c];
  if (!p) return [];
  const moves: [number, number][] = [];
  const canGo = (nr: number, nc: number) => {
    if (!ib(nr, nc)) return false;
    const t = board[nr][nc];
    return !t || t.player !== p.player;
  };
  const addIf = (nr: number, nc: number) => { if (canGo(nr, nc)) moves.push([nr, nc]); };
  const opp: Player = p.player === 1 ? 2 : 1;

  switch (p.type) {
    case 'K': {
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]])
        if (inP(r+dr, c+dc, p.player)) addIf(r+dr, c+dc);
      break;
    }
    case 'A': {
      for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]])
        if (inP(r+dr, c+dc, p.player)) addIf(r+dr, c+dc);
      break;
    }
    case 'B': {
      for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]])
        if (inP(r+dr, c+dc, p.player)) addIf(r+dr, c+dc);
      break;
    }
    case 'H': {
      const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      const legs = [[-1,0],[-1,0],[0,-1],[0,1],[0,-1],[0,1],[1,0],[1,0]];
      for (let i = 0; i < 8; i++) {
        const nr = r + jumps[i][0], nc = c + jumps[i][1];
        const lr = r + legs[i][0], lc = c + legs[i][1];
        if (ib(nr, nc) && !board[lr][lc] && canGo(nr, nc)) moves.push([nr, nc]);
      }
      break;
    }
    case 'E': {
      const jumps = [[-3,-2],[-3,2],[-2,-3],[-2,3],[2,-3],[2,3],[3,-2],[3,2]];
      const legs = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (let i = 0; i < 8; i++) {
        const nr = r + jumps[i][0], nc = c + jumps[i][1];
        const lr1 = r + legs[i][0]/2, lc1 = c + legs[i][1]/2;
        const lr2 = r + legs[i][0], lc2 = c + legs[i][1];
        if (ib(nr, nc) && !board[lr1][lc1] && !board[lr2][lc2] && canGo(nr, nc)) moves.push([nr, nc]);
      }
      break;
    }
    case 'C': {
      const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
      for (const [dr, dc] of dirs) {
        let jumped = false;
        let nr = r + dr, nc = c + dc;
        while (ib(nr, nc)) {
          if (!jumped) {
            if (board[nr][nc]) jumped = true;
            else { nr += dr; nc += dc; continue; }
          } else {
            const t = board[nr][nc];
            if (!t) moves.push([nr, nc]);
            else if (t.player === opp && t.type !== 'C') { moves.push([nr, nc]); break; }
            else break;
          }
          nr += dr; nc += dc;
        }
      }
      break;
    }
    case 'S': {
      const fwd = p.player === 1 ? -1 : 1;
      addIf(r + fwd, c);
      if (c > 0) addIf(r, c - 1);
      if (c < 8) addIf(r, c + 1);
      break;
    }
  }
  return moves;
}

/** 모든 가능한 수 */
function allMoves(board: Board, p: Player): [number, number, number, number][] {
  const res: [number, number, number, number][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c] || board[r][c]!.player !== p) continue;
      for (const [nr, nc] of getMovesFor(board, r, c))
        res.push([r, c, nr, nc]);
    }
  return res;
}

function evalBoard(board: Board, p: Player): number {
  let score = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const pc = board[r][c];
      if (!pc) continue;
      const val = PIECE_VALUES[pc.type];
      score += pc.player === p ? val : -val;
    }
  return score;
}

function negamax(board: Board, depth: number, alpha: number, beta: number, p: Player): number {
  if (depth === 0) return evalBoard(board, p);
  const moves = allMoves(board, p);
  if (moves.length === 0) return -100000;
  const opp: Player = p === 1 ? 2 : 1;
  let best = -Infinity;
  for (const [r, c, nr, nc] of moves.slice(0, 30)) {
    const captured = board[nr][nc];
    board[nr][nc] = board[r][c]; board[r][c] = null;
    const v = -negamax(board, depth - 1, -beta, -alpha, opp);
    board[r][c] = board[nr][nc]; board[nr][nc] = captured;
    best = Math.max(best, v);
    alpha = Math.max(alpha, v);
    if (beta <= alpha) break;
  }
  return best;
}

export function findBestMoveJ(board: Board, p: Player): [number, number, number, number] | null {
  const moves = allMoves(board, p);
  if (moves.length === 0) return null;
  const opp: Player = p === 1 ? 2 : 1;
  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const [r, c, nr, nc] of moves) {
    const captured = board[nr][nc];
    board[nr][nc] = board[r][c]; board[r][c] = null;
    const score = -negamax(board, 2, -Infinity, Infinity, opp);
    board[r][c] = board[nr][nc]; board[nr][nc] = captured;
    if (score > bestScore) { bestScore = score; bestMove = [r, c, nr, nc]; }
  }
  return bestMove;
}

export function isCheckmate(board: Board, p: Player): boolean {
  // 궁이 잡혔는지
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]?.type === 'K' && board[r][c]!.player === p) return false;
  return true;
}
