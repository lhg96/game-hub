import type { GameModule } from './types';

// games/**\/index.ts 를 전부 찾아 모듈맵으로 만든다 (Vite glob import).
// 새로운 게임 폴더를 추가하면 이 파일 수정 없이 자동 등록됩니다.
const modules = import.meta.glob<GameModule>('../games/*/index.ts', {
  eager: true,
  import: 'default',
});

export const games: GameModule[] = Object.values(modules).sort((a, b) =>
  a.title.localeCompare(b.title, 'ko')
);

export function getGame(id: string): GameModule | undefined {
  return games.find((g) => g.id === id);
}
