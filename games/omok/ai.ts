/**
 * 오목 패턴 기반 AI (Threat-Space Search 스타일)
 * 1. 즉시승 / 2. 필수방어 / 3. 공격 패턴 우선순위
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

/** 한 방향으로 연속된 돌, 양끝 상태 */
function scan(board: Board, r: number, c: number, dr: number, dc: number, p: Player) {
  let cnt = 0, open = 0;
  let nr = r, nc = c;
  while (ib(nr, nc) && board[nr][nc] === p) { cnt++; nr += dr; nc += dc; }
  if (ib(nr, nc) && board[nr][nc] === 0) open++;
  nr = r - dr; nc = c - dc;
  while (ib(nr, nc) && board[nr][nc] === p) { cnt++; nr -= dr; nc -= dc; }
  if (ib(nr, nc) && board[nr][nc] === 0) open++;
  return { cnt, open };
}

/** 특정 위치에 돌을 뒀을 때 해당 방향 패턴 */
function scanAt(board: Board, r: number, c: number, dr: number, dc: number, p: Player) {
  let cnt = 1, open = 0;
  let nr = r + dr, nc = c + dc;
  while (ib(nr, nc) && board[nr][nc] === p) { cnt++; nr += dr; nc += dc; }
  if (ib(nr, nc) && board[nr][nc] === 0) open++;
  nr = r - dr; nc = c - dc;
  while (ib(nr, nc) && board[nr][nc] === p) { cnt++; nr -= dr; nc -= dc; }
  if (ib(nr, nc) && board[nr][nc] === 0) open++;
  return { cnt, open };
}

/** 빈 칸들 중 주변에 돌이 있는 칸 반환 */
function candidates(board: Board): [number, number][] {
  const set = new Set<string>();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== 0) continue;
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++)
        for (let dc = -2; dc <= 2 && !near; dc++)
          if (ib(r + dr, c + dc) && board[r + dr][c + dc] !== 0) near = true;
      if (near) set.add(`${r},${c}`);
    }
  return [...set].map(s => { const [a, b] = s.split(',').map(Number); return [a, b] as [number, number]; });
}

/** 특정 플레이어의 패턴 점수 (높을수록 좋음) */
function threatScore(board: Board, r: number, c: number, p: Player): number {
  let score = 0;
  for (const [dr, dc] of DIRS) {
    const { cnt, open } = scanAt(board, r, c, dr, dc, p);
    if (cnt >= 5) score += 100000;
    else if (cnt === 4 && open === 2) score += 50000;
    else if (cnt === 4 && open === 1) score += 10000;
    else if (cnt === 3 && open === 2) score += 5000;
    else if (cnt === 3 && open === 1) score += 500;
    else if (cnt === 2 && open === 2) score += 200;
    else if (cnt === 2 && open === 1) score += 50;
    else if (cnt === 1 && open === 2) score += 10;
  }
  return score;
}

/** 필수 방어 여부 확인 */
function mustBlock(board: Board, p: Player): [number, number] | null {
  const opp: Player = p === 1 ? 2 : 1;
  // 상대 즉시 승리 방어
  for (const [r, c] of candidates(board)) {
    if (threatScore(board, r, c, opp) >= 100000) return [r, c];
  }
  // 상대 open-4 방어 (block)
  for (const [r, c] of candidates(board)) {
    if (threatScore(board, r, c, opp) >= 50000) return [r, c]; // open-4
  }
  // 상대 half-open 4 방어
  for (const [r, c] of candidates(board)) {
    if (threatScore(board, r, c, opp) >= 10000) return [r, c];
  }
  return null;
}

/** 모든 수 평가 후 정렬 */
function scoreMoves(board: Board, p: Player, opp: Player): [number, number, number][] {
  const oppBlock = mustBlock(board, p);
  const mvs = candidates(board);
  const scored: [number, number, number][] = [];

  for (const [r, c] of mvs) {
    let score = 0;
    // 내 공격 점수
    score += threatScore(board, r, c, p) * 1.0;
    // 상대 공격 차단 점수
    score += threatScore(board, r, c, opp) * 0.9;
    // 중앙 선호
    const dist = Math.abs(r - 7) + Math.abs(c - 7);
    score += Math.max(0, 14 - dist);

    // 필수 방어 우선
    if (oppBlock && oppBlock[0] === r && oppBlock[1] === c) score += 200000;

    scored.push([r, c, score]);
  }

  return scored.sort((a, b) => b[2] - a[2]);
}

/** Minimax with Alpha-Beta (light) */
function minimax(
  board: Board, depth: number, alpha: number, beta: number,
  isMax: boolean, ai: Player, opp: Player
): number {
  // 내 5연승 체크 (이전 수 기준)
  for (const [dr, dc] of DIRS) {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const p = board[r][c];
        if (p === 0) continue;
        const { cnt } = scan(board, r, c, dr, dc, p);
        if (cnt >= 5) return p === ai ? 1000000 : -1000000;
      }
  }

  if (depth === 0) {
    // 정적 평가
    let score = 0;
    for (const [r, c] of candidates(board)) {
      score += threatScore(board, r, c, ai) * 0.5;
      score -= threatScore(board, r, c, opp) * 0.6;
    }
    return score;
  }

  const p = isMax ? ai : opp;
  const mvs = scoreMoves(board, p, opp).slice(0, 8);

  if (isMax) {
    let best = -Infinity;
    for (const [r, c] of mvs) {
      board[r][c] = p;
      const v = minimax(board, depth - 1, alpha, beta, false, ai, opp);
      board[r][c] = 0;
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const [r, c] of mvs) {
      board[r][c] = p;
      const v = minimax(board, depth - 1, alpha, beta, true, ai, opp);
      board[r][c] = 0;
      best = Math.min(best, v);
      beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return best;
  }
}

/** AI 최적 수 찾기 */
export function findBestMove(board: Board, aiPlayer: Player, difficulty: number = 3): [number, number] | null {
  const opp: Player = aiPlayer === 1 ? 2 : 1;
  const scored = scoreMoves(board, aiPlayer, opp);
  if (scored.length === 0) return null;

  // 상위 5개만 minimax
  const top5 = scored.slice(0, 5);
  let bestMove: [number, number] = [top5[0][0], top5[0][1]];
  let bestScore = -Infinity;

  for (const [r, c] of top5) {
    board[r][c] = aiPlayer;
    const s = minimax(board, difficulty, -Infinity, Infinity, false, aiPlayer, opp);
    board[r][c] = 0;
    if (s > bestScore) { bestScore = s; bestMove = [r, c]; }
  }
  return bestMove;
}

/** 승리 체크 */
export function checkWin(board: Board, p: Player): [number, number][] | null {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== p) continue;
      for (const [dr, dc] of DIRS) {
        const cells: [number, number][] = [];
        let nr = r, nc = c;
        while (ib(nr, nc) && board[nr][nc] === p) { cells.push([nr, nc]); nr += dr; nc += dc; }
        if (cells.length >= 5) return cells.slice(0, 5);
      }
    }
  return null;
}

export function isDraw(board: Board): boolean {
  return board.every(row => row.every(c => c !== 0));
}
