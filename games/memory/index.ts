import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';
import { createChar } from '../../src/char';

const BEST_KEY = 'memory.best'; // fewest moves to clear

let game: GameModule = {
  id: 'memory',
  title: '짝맞추기',
  description: '같은 그림을 찾아라',

  mount(root) {
    const char = createChar({ color: '#f7d038', label: 'MEMO' });
    const PAIRS = 8; // 4x4
    const EMOJIS = [
      '🍎', '🍌', '🍇', '🍓',
      '🍑', '🍒', '🥝', '🍉',
      '🍍', '🥥', '🍋', '🍊',
    ];

    let deck: string[];
    let first: number | null = null;
    let lock = false;
    let moves = 0;
    let matched = 0;
    let best = Number(localStorage.getItem(BEST_KEY) ?? '0');
    const flipped = new Set<number>();
    let flipTimers: number[] = [];

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%';
    const status = document.createElement('div');
    status.style.cssText = 'font-size:18px;min-height:24px';
    const bestLine = document.createElement('div');
    bestLine.style.cssText = 'font-size:13px;color:var(--muted)';
    bestLine.textContent = best ? `최소 이동: ${best}` : '최소 이동: -';
    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:12px;color:var(--muted);font-weight:600';
    charLabel.textContent = 'MEMO';
    const charRow = document.createElement('div');
    charRow.style.cssText = 'display:flex;align-items:center;gap:8px';
    charRow.append(char.canvas, charLabel);
    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(4,70px);gap:8px';
    const cards: HTMLButtonElement[] = [];
    const restart = document.createElement('button');
    restart.textContent = '다시 하기';
    restart.className = 'back-btn';
    wrap.append(charRow, status, bestLine, grid, restart);
    root.appendChild(wrap);

    function shuffle(arr: string[]): string[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function setStatus(t: string) {
      status.textContent = t;
    }

    function draw() {
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        if (deck[i] === '__matched__') {
          c.textContent = '✅';
          c.disabled = true;
          c.style.background = '#1a3a2a';
          continue;
        }
        c.textContent = flipped.has(i) ? deck[i] : '❓';
        c.style.background = flipped.has(i) ? '#0b0e1a' : '#2a3150';
      }
    }

    function reset() {
      flipTimers.forEach((t) => clearTimeout(t));
      flipTimers = [];
      flipped.clear();
      first = null;
      lock = false;
      moves = 0;
      matched = 0;
      const picks = EMOJIS.slice(0, PAIRS);
      deck = shuffle([...picks, ...picks]);
      cards.forEach((c) => (c.disabled = false));
      setStatus('카드를 뒤집어 보세요');
      draw();
    }

    function onCard(i: number) {
      if (lock || flipped.has(i) || deck[i] === '__matched__') return;
      flipped.add(i);
      sound.tap();
      draw();
      if (first === null) {
        first = i;
        return;
      }
      moves++;
      const a = first;
      const b = i;
      if (deck[a] === deck[b]) {
        deck[a] = '__matched__';
        deck[b] = '__matched__';
        matched++;
        flipped.delete(a);
        flipped.delete(b);
        draw();
        first = null;
        sound.cheer();
        char.setState('happy', 600);
        if (matched === PAIRS) {
          setStatus(`클리어! 이동 ${moves}회`);
          char.setState('excited', 3000);
          sound.win();
          if (!best || moves < best) {
            best = moves;
            localStorage.setItem(BEST_KEY, String(best));
            bestLine.textContent = `최소 이동: ${best}`;
          }
        } else {
          setStatus(`이동 ${moves}회`);
        }
      } else {
        lock = true;
        const t = window.setTimeout(() => {
          flipped.delete(a);
          flipped.delete(b);
          first = null;
          lock = false;
          draw();
        }, 800);
        flipTimers.push(t);
        setStatus(`이동 ${moves}회`);
        sound.sad();
        char.setState('sad', 600);
      }
    }

    for (let i = 0; i < PAIRS * 2; i++) {
      const c = document.createElement('button');
      c.style.cssText =
        'width:70px;height:70px;font-size:30px;border-radius:10px;border:1px solid #2a3150;cursor:pointer';
      c.addEventListener('click', () => onCard(i));
      cards.push(c);
      grid.appendChild(c);
    }

    restart.addEventListener('click', reset);
    reset();

    game.unmount = () => {
      flipTimers.forEach((t) => clearTimeout(t));
      char.destroy();
    };
  },
};

export default game;
