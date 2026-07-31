import './style.css';
import { games } from './registry';
import type { GameModule } from './types';

// 게임 아이콘 매핑 (이모지)
const ICONS: Record<string, string> = {
  'tic-tac-toe': '⭕',
  snake: '🐍',
  '2048': '🔢',
  memory: '🃏',
  minesweeper: '💣',
  whack: '🔨',
  rps: '✊',
  sudoku: '🔢',
  tetris: '🧱',
  galaga: '👾',
  'lucky-slot': '🎰',
};

const app = document.querySelector<HTMLDivElement>('#app')!;
let current: { module: GameModule; unmount: (() => void) | void } | null = null;

function renderHome() {
  if (current?.unmount) current.unmount();
  current = null;
  app.innerHTML = '';

  const header = document.createElement('header');
  header.className = 'hub-header';
  header.innerHTML = `<h1>🎮 Game Hub</h1><p>미니게임을 골라 플레이하세요</p>`;
  app.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'game-grid';
  for (const game of games) {
    const card = document.createElement('button');
    card.className = 'game-card';
    const icon = ICONS[game.id] ?? '🎮';
    card.innerHTML = `
      <span class="game-icon">${icon}</span>
      <span class="game-title">${game.title}</span>
      ${game.description ? `<span class="game-desc">${game.description}</span>` : ''}
      <span class="play-button">Play Now</span>`;
    card.addEventListener('click', () => openGame(game));
    grid.appendChild(card);
  }
  app.appendChild(grid);
}

function openGame(game: GameModule) {
  if (current?.unmount) current.unmount();
  app.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'topbar';
  const back = document.createElement('button');
  back.className = 'back-btn';
  back.textContent = '← 목록';
  back.addEventListener('click', renderHome);
  const title = document.createElement('h2');
  title.textContent = game.title;
  bar.append(back, title);
  app.appendChild(bar);

  const root = document.createElement('div');
  root.className = 'game-root';
  app.appendChild(root);

  game.mount(root);
  current = { module: game, unmount: game.unmount };
}

renderHome();
