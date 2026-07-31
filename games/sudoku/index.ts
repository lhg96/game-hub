import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';

// 순수 TS 스도쿠 — 후보(연필) 첨자, 자동채움, 실수체크, 하이라이트, Undo, 캐릭터, 효과음
// 의존성 0, 모바일 최적화

type Grid = number[][]; // 0 = 빈 칸

const BEST_KEY = 'sudoku.best.time';
const DIFFS: Record<string, number> = { easy: 38, medium: 30, hard: 24 };

// ── 퍼즐 생성 ─────────────────────────────────────────────
function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function canPlace(g: Grid, r: number, c: number, v: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (g[r][i] === v || g[i][c] === v) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) if (g[br + i][bc + j] === v) return false;
  return true;
}
function solve(g: Grid): boolean {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      if (g[r][c] === 0) {
        for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (canPlace(g, r, c, v)) {
            g[r][c] = v;
            if (solve(g)) return true;
            g[r][c] = 0;
          }
        }
        return false;
      }
    }
  return true;
}
function makePuzzle(filled: number): { puzzle: Grid; solution: Grid } {
  const sol = emptyGrid();
  solve(sol);
  const puzzle = sol.map((row) => row.slice());
  const cells = shuffle(
    Array.from({ length: 81 }, (_, i) => i)
  );
  let removed = 0;
  const target = 81 - filled;
  for (const idx of cells) {
    if (removed >= target) break;
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    if (puzzle[r][c] === 0) continue;
    puzzle[r][c] = 0;
    removed++;
  }
  return { puzzle, solution: sol };
}

// ── 모듈 ─────────────────────────────────────────────────
let game: GameModule = {
  id: 'sudoku',
  title: '스도쿠',
  description: '숫자 퍼즐 (Sudoku)',

  mount(root) {
    let grid: Grid;
    let solution: Grid;
    let given: boolean[][];
    let notes: boolean[][][]; // notes[r][c][1..9]
    let sel: { r: number; c: number } | null = null;
    let mistakes = 0;
    let score = 0;
    let solved = false;
    let startTime = 0;
    let elapsed = 0;
    let best = Number(localStorage.getItem(BEST_KEY) ?? '0');
    let pencil = false; // 연필 모드
    let autoOn = false; // 후보 자동 채움 상태
    let history: { grid: Grid; notes: boolean[][][]; sel: { r: number; c: number } | null }[] = [];
    let loop: number | undefined;
    let animLoop: number | undefined;

    // 캐릭터 상태
    type CharState = 'idle' | 'write' | 'note' | 'error' | 'win';
    let charState: CharState = 'idle';
    let charTimer = 0;
    let charT = 0;

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:460px;margin:0 auto';

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center';

    const diffSel = document.createElement('select');
    diffSel.className = 'back-btn';
    diffSel.style.cssText = 'font-size:13px';
    (['easy', 'medium', 'hard'] as const).forEach((d) => {
      const o = document.createElement('option');
      o.value = d;
      o.textContent = d === 'easy' ? '쉬움' : d === 'medium' ? '보통' : '어려움';
      diffSel.appendChild(o);
    });

    const info = document.createElement('div');
    info.style.cssText = 'font-size:13px;color:var(--muted)';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'back-btn';
    muteBtn.textContent = sound.isMuted() ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      const m = sound.toggleMute();
      muteBtn.textContent = m ? '🔇' : '🔊';
    });

    const newBtn = document.createElement('button');
    newBtn.className = 'back-btn';
    newBtn.textContent = '새 게임';

    top.append(diffSel, info, muteBtn, newBtn);

    // 보드 + 사이드(캐릭터)
    const area = document.createElement('div');
    area.style.cssText = 'display:flex;gap:10px;width:100%;justify-content:center;align-items:flex-start';

    const boardEl = document.createElement('div');
    boardEl.style.cssText =
      'display:grid;grid-template-columns:repeat(9,1fr);gap:1px;background:#2a3150;padding:3px;border-radius:10px;aspect-ratio:1/1;width:70%;touch-action:none';

    const side = document.createElement('div');
    side.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:30%;max-width:130px';

    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:11px;color:var(--muted)';
    charLabel.textContent = 'DETECTIVE';
    const charCanvas = document.createElement('canvas');
    charCanvas.width = 72;
    charCanvas.height = 72;
    charCanvas.style.cssText = 'width:56px;max-width:56px;height:56px;border-radius:10px;background:linear-gradient(160deg,#16203a,#0b0e1a);border:1px solid #2a3150';

    const charRow = document.createElement('div');
    charRow.style.cssText = 'display:flex;align-items:center;gap:6px';
    charRow.append(charCanvas, charLabel);

    side.append(charRow);

    const cells: HTMLDivElement[] = [];
    for (let i = 0; i < 81; i++) {
      const c = document.createElement('div');
      const r = Math.floor(i / 9);
      const col = i % 9;
      c.style.cssText =
        'position:relative;background:#0d1226;display:flex;align-items:center;justify-content:center;font-size:clamp(14px,4.2vw,22px);font-weight:600;color:#e8ecff;cursor:pointer;aspect-ratio:1/1;overflow:hidden;' +
        (col % 3 === 2 && col !== 8 ? 'border-right:2px solid #3a4470;' : '') +
        (r % 3 === 2 && r !== 8 ? 'border-bottom:2px solid #3a4470;' : '') +
        (col === 0 ? 'border-left:2px solid #3a4470;' : '') +
        (r === 0 ? 'border-top:2px solid #3a4470;' : '');
      // fix border color typo
      c.style.borderRight = col % 3 === 2 && col !== 8 ? '2px solid #3a4470' : '';
      c.style.borderBottom = r % 3 === 2 && r !== 8 ? '2px solid #3a4470' : '';
      c.addEventListener('click', () => {
        sel = { r, c: col };
        sound.sudokuSelect();
        draw();
      });
      cells.push(c);
      boardEl.appendChild(c);
    }

    // 컨트롤 바
    const ctrl = document.createElement('div');
    ctrl.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center';

    const pencilBtn = document.createElement('button');
    pencilBtn.className = 'back-btn';
    pencilBtn.textContent = '✏️ 연필';
    pencilBtn.style.cssText = 'font-size:13px;padding:8px 10px';
    pencilBtn.addEventListener('click', () => {
      pencil = !pencil;
      pencilBtn.style.background = pencil ? '#3a4470' : '';
      pencilBtn.textContent = pencil ? '✏️ 연필 ON' : '✏️ 연필';
    });

    const autoBtn = document.createElement('button');
    autoBtn.className = 'back-btn';
    autoBtn.textContent = '후보 자동';
    autoBtn.style.cssText = 'font-size:13px;padding:8px 10px';
    autoBtn.addEventListener('click', autoFill);

    const undoBtn = document.createElement('button');
    undoBtn.className = 'back-btn';
    undoBtn.textContent = '↶ 되돌리기';
    undoBtn.style.cssText = 'font-size:13px;padding:8px 10px';
    undoBtn.addEventListener('click', undo);

    const hintBtn = document.createElement('button');
    hintBtn.className = 'back-btn';
    hintBtn.textContent = '💡 힌트';
    hintBtn.style.cssText = 'font-size:13px;padding:8px 10px';
    hintBtn.addEventListener('click', hintCell);

    ctrl.append(pencilBtn, autoBtn, undoBtn, hintBtn);

    // 숫자 패드
    const pad = document.createElement('div');
    pad.style.cssText = 'display:grid;grid-template-columns:repeat(9,1fr);gap:4px;width:100%;max-width:420px';
    for (let n = 1; n <= 9; n++) {
      const b = document.createElement('button');
      b.textContent = String(n);
      b.className = 'back-btn';
      b.style.cssText = 'font-size:18px;padding:12px 0;height:auto';
      b.addEventListener('click', (e) => {
        e.preventDefault();
        inputNumber(n);
      });
      pad.appendChild(b);
    }
    const erase = document.createElement('button');
    erase.textContent = '지우기';
    erase.className = 'back-btn';
    erase.style.cssText = 'grid-column:1/10;font-size:14px;padding:10px 0';
    erase.addEventListener('click', (e) => {
      e.preventDefault();
      inputNumber(0);
    });
    pad.appendChild(erase);

    wrap.append(top, area, ctrl, pad);
    area.append(boardEl, side);
    root.appendChild(wrap);

    // 캐릭터 그리기
    const cctx = charCanvas.getContext('2d')!;
    function setChar(s: CharState, dur = 500) {
      charState = s;
      charTimer = dur;
    }
    function drawChar() {
      const W = charCanvas.width;
      const H = charCanvas.height;
      cctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;
      const bob = Math.sin(charT / 350) * 3;
      const t = charT / 1000;
      let rot = 0;
      let col = '#6c8cff';
      let eye = 0;
      let mouth = 'smile';
      let sweat = false;
      switch (charState) {
        case 'write':
          rot = Math.sin(t * 14) * 0.08;
          col = '#6c8cff';
          break;
        case 'note':
          rot = 0;
          col = '#b06cf0';
          break;
        case 'error':
          rot = Math.sin(t * 20) * 0.1;
          col = '#ff6b6b';
          eye = 2;
          mouth = 'flat';
          sweat = true;
          break;
        case 'win':
          rot = Math.sin(t * 8) * 0.12;
          col = '#5ce16a';
          mouth = 'open';
          break;
        default:
          eye = bob * 0.2;
      }
      cctx.save();
      cctx.translate(cx, cy + bob);
      cctx.rotate(rot);
      // 탐정 모자
      cctx.fillStyle = '#2d3a66';
      cctx.beginPath();
      cctx.ellipse(0, -30, 30, 9, 0, 0, Math.PI * 2);
      cctx.fill();
      cctx.fillRect(-18, -42, 36, 16);
      // 머리
      cctx.fillStyle = col;
      roundRectCtx(cctx, -24, -28, 48, 48, 14);
      cctx.fill();
      cctx.strokeStyle = 'rgba(255,255,255,0.25)';
      cctx.lineWidth = 2;
      cctx.stroke();
      // 돋보기 (눈 앞)
      cctx.strokeStyle = '#cfd8ff';
      cctx.lineWidth = 3;
      cctx.beginPath();
      cctx.arc(16, 2, 12, 0, Math.PI * 2);
      cctx.moveTo(26, 11);
      cctx.lineTo(34, 19);
      cctx.stroke();
      cctx.fillStyle = 'rgba(180,210,255,0.25)';
      cctx.beginPath();
      cctx.arc(16, 2, 9, 0, Math.PI * 2);
      cctx.fill();
      // 눈
      cctx.fillStyle = '#fff';
      cctx.beginPath();
      cctx.arc(-10, -6 + eye, 6, 0, Math.PI * 2);
      cctx.arc(8, -6 + eye, 6, 0, Math.PI * 2);
      cctx.fill();
      cctx.fillStyle = '#16203a';
      cctx.beginPath();
      cctx.arc(-10, -4 + eye, 3, 0, Math.PI * 2);
      cctx.arc(8, -4 + eye, 3, 0, Math.PI * 2);
      cctx.fill();
      // 입
      cctx.strokeStyle = '#16203a';
      cctx.lineWidth = 2.5;
      cctx.beginPath();
      if (mouth === 'open') {
        cctx.arc(0, 12, 7, 0, Math.PI * 2);
        cctx.fillStyle = '#16203a';
        cctx.fill();
      } else if (mouth === 'flat') {
        cctx.moveTo(-8, 12);
        cctx.lineTo(8, 12);
        cctx.stroke();
      } else {
        cctx.arc(0, 7, 8, 0.15 * Math.PI, 0.85 * Math.PI);
        cctx.stroke();
      }
      cctx.restore();
      if (sweat) {
        cctx.fillStyle = '#6cc6ff';
        cctx.beginPath();
        cctx.arc(cx - 26, cy + bob + 6 + Math.sin(t * 8) * 3, 3, 0, Math.PI * 2);
        cctx.fill();
      }
      if (charState === 'win') {
        for (let i = 0; i < 5; i++) {
          const a = (t * 4 + i) % (Math.PI * 2);
          const rr = 36 + Math.sin(t * 8 + i) * 8;
          cctx.fillStyle = i % 2 ? '#f7d038' : '#5ce16a';
          cctx.font = '13px serif';
          cctx.fillText('⭐', cx + Math.cos(a) * rr - 6, cy + bob + Math.sin(a) * rr + 4);
        }
      }
    }
    function roundRectCtx(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }
    function animFrame() {
      const now = performance.now();
      if (!charT) charT = now;
      const dt = now - charT;
      charT = now;
      if (charTimer > 0) {
        charTimer -= dt;
        if (charTimer <= 0 && charState !== 'win') charState = 'idle';
      }
      drawChar();
      animLoop = window.setTimeout(animFrame, 50) as unknown as number;
    }

    // 게임 로직
    function pushHistory() {
      history.push({
        grid: grid.map((row) => row.slice()),
        notes: notes.map((row) => row.map((cell) => cell.slice())),
        sel,
      });
      if (history.length > 100) history.shift();
    }
    function undo() {
      if (solved || history.length === 0) return;
      const prev = history.pop()!;
      grid = prev.grid;
      notes = prev.notes;
      sel = prev.sel;
      sound.sudokuSelect();
      draw();
    }

    function candidatesFor(r: number, c: number): number[] {
      const used = new Set<number>();
      for (let i = 0; i < 9; i++) {
        if (grid[r][i]) used.add(grid[r][i]);
        if (grid[i][c]) used.add(grid[i][c]);
      }
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) if (grid[br + i][bc + j]) used.add(grid[br + i][bc + j]);
      const res: number[] = [];
      for (let n = 1; n <= 9; n++) if (!used.has(n)) res.push(n);
      return res;
    }

    function autoFill() {
      if (solved) return;
      autoOn = !autoOn;
      autoBtn.style.background = autoOn ? '#3a4470' : '';
      autoBtn.textContent = autoOn ? '후보 자동 ON' : '후보 자동';
      pushHistory();
      if (autoOn) {
        for (let r = 0; r < 9; r++)
          for (let c = 0; c < 9; c++) {
            if (grid[r][c] === 0 && !given[r][c]) {
              const cand = candidatesFor(r, c);
              if (cand.length > 0 && cand.length <= 4) {
                notes[r][c] = Array(10).fill(false);
                for (const n of cand) notes[r][c][n] = true;
              }
            }
          }
        sound.sudokuNote();
        setChar('note');
      } else {
        // OFF: 모든 후보 지우기
        for (let r = 0; r < 9; r++)
          for (let c = 0; c < 9; c++)
            if (grid[r][c] === 0 && !given[r][c]) notes[r][c] = Array(10).fill(false);
        sound.sudokuSelect();
      }
      draw();
    }

    function inputNumber(n: number) {
      if (!sel || solved) return;
      const { r, c } = sel;
      if (given[r][c]) return;
      pushHistory();
      if (pencil) {
        if (n === 0) {
          notes[r][c] = Array(10).fill(false);
        } else if (grid[r][c] === 0) {
          notes[r][c][n] = !notes[r][c][n];
        }
        sound.sudokuNote();
        setChar('note');
      } else {
        if (n === 0) {
          grid[r][c] = 0;
          notes[r][c] = Array(10).fill(false);
          sound.sudokuSelect();
        } else {
          grid[r][c] = n;
          notes[r][c] = Array(10).fill(false);
          // 같은 줄/칸의 해당 후보 제거
          clearNotes(r, c, n);
          if (n !== solution[r][c]) {
            mistakes++;
            sound.sudokuError();
            setChar('error');
          } else {
            sound.sudokuWrite();
            setChar('write');
            score += 10;
          }
        }
      }
      draw();
      checkWin();
    }

    function clearNotes(r: number, c: number, n: number) {
      for (let i = 0; i < 9; i++) {
        notes[r][i][n] = false;
        notes[i][c][n] = false;
      }
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) notes[br + i][bc + j][n] = false;
    }

    function hintCell() {
      if (solved) return;
      let target = sel && !given[sel.r][sel.c] && grid[sel.r][sel.c] !== solution[sel.r][sel.c] ? sel : null;
      if (!target) {
        outer: for (let r = 0; r < 9; r++)
          for (let c = 0; c < 9; c++)
            if (!given[r][c] && grid[r][c] !== solution[r][c]) {
              target = { r, c };
              break outer;
            }
      }
      if (!target) return;
      pushHistory();
      const { r, c } = target;
      grid[r][c] = solution[r][c];
      given[r][c] = true; // 힌트는 확정
      notes[r][c] = Array(10).fill(false);
      clearNotes(r, c, solution[r][c]);
      sel = { r, c };
      sound.sudokuWrite();
      setChar('write');
      draw();
      checkWin();
    }

    function checkWin() {
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
          if (grid[r][c] !== solution[r][c]) return;
      solved = true;
      elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (best === 0 || elapsed < best) {
        best = elapsed;
        localStorage.setItem(BEST_KEY, String(best));
      }
      sound.sudokuWin();
      setChar('win', 999999);
      if (loop) clearInterval(loop);
      updateInfo();
    }

    function updateInfo() {
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      info.textContent = `실수 ${mistakes} · 점수 ${score} · ⏱${mm}:${ss} · 최고 ${best ? best + 's' : '-'}${solved ? ' · 완성! 🎉' : ''}`;
    }

    function draw() {
      const selNum = sel ? grid[sel.r][sel.c] : 0;
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++) {
          const el = cells[r * 9 + c];
          const v = grid[r][c];
          el.innerHTML = '';
          el.style.background = '#0d1226';
          el.style.color = '#e8ecff';
          // 하이라이트: 선택된 칸 / 같은 숫자
          if (sel && sel.r === r && sel.c === c) el.style.background = '#1c2a52';
          else if (selNum && v === selNum) el.style.background = '#172248';
          // 후보 첨자 (절대 위치로 겹쳐 그려 셀 크기 변동 방지)
          if (v === 0 && !given[r][c]) {
            const ns = notes[r][c];
            let any = false;
            for (let n = 1; n <= 9; n++) if (ns[n]) { any = true; break; }
            if (any) {
              const frag = document.createElement('div');
              frag.style.cssText =
                'position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);width:100%;height:100%;font-size:clamp(7px,2vw,10px);font-weight:500;color:#7e8bc0;pointer-events:none';
              for (let n = 1; n <= 9; n++) {
                const d = document.createElement('div');
                d.style.cssText = 'display:flex;align-items:center;justify-content:center';
                d.textContent = ns[n] ? String(n) : '';
                frag.appendChild(d);
              }
              el.appendChild(frag);
            }
          } else if (v !== 0) {
            el.textContent = String(v);
            if (given[r][c]) el.style.color = '#ffd166';
            else if (v !== solution[r][c]) {
              el.style.color = '#ff6b6b';
              el.style.background = '#3a1a22';
            }
          }
        }
      updateInfo();
    }

    function tick() {
      if (solved) return;
      elapsed = Math.floor((Date.now() - startTime) / 1000);
      updateInfo();
    }

    function newGame() {
      const diff = diffSel.value as string;
      const filled = DIFFS[diff] ?? 30;
      const { puzzle, solution: sol } = makePuzzle(filled);
      grid = puzzle;
      solution = sol;
      given = puzzle.map((row) => row.map((v) => v !== 0));
      notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => Array(10).fill(false)));
      sel = null;
      mistakes = 0;
      score = 0;
      solved = false;
      pencil = false;
      autoOn = false;
      pencilBtn.style.background = '';
      pencilBtn.textContent = '✏️ 연필';
      autoBtn.style.background = '';
      autoBtn.textContent = '후보 자동';
      history = [];
      startTime = Date.now();
      elapsed = 0;
      setChar('idle');
      draw();
      if (loop) clearInterval(loop);
      loop = window.setInterval(tick, 1000);
      sound.start();
    }

    diffSel.addEventListener('change', newGame);
    newBtn.addEventListener('click', newGame);
    newGame();

    // 키보드
    function onKey(e: KeyboardEvent) {
      if (e.key >= '1' && e.key <= '9') inputNumber(Number(e.key));
      else if (e.key === 'Backspace' || e.key === '0' || e.key === 'Delete') inputNumber(0);
      else if (e.key === 'n' || e.key === 'N') pencilBtn.click();
      else if (e.key === 'z' || e.key === 'Z') undo();
      else if (e.key.startsWith('Arrow')) {
        if (!sel) sel = { r: 0, c: 0 };
        else {
          if (e.key === 'ArrowUp') sel = { r: Math.max(0, sel.r - 1), c: sel.c };
          if (e.key === 'ArrowDown') sel = { r: Math.min(8, sel.r + 1), c: sel.c };
          if (e.key === 'ArrowLeft') sel = { r: sel.r, c: Math.min(8, sel.c - 1) };
          if (e.key === 'ArrowRight') sel = { r: sel.r, c: Math.max(0, sel.c + 1) };
        }
        draw();
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);

    if (!animLoop) animLoop = window.setTimeout(animFrame, 50) as unknown as number;

    game.unmount = () => {
      if (loop) clearInterval(loop);
      if (animLoop) clearTimeout(animLoop);
      window.removeEventListener('keydown', onKey);
    };
  },
};

export default game;
