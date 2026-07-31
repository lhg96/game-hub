# 오목 게임 소스 출처

게임 로직(Gomoku class) 원본: **https://github.com/leekeunhwan/omok**
- 보드 15×15, 흑(●)/백(○) 표기, 승리 판정 로직
- MIT 라이선스 (repo readme 기준)

AI 엔진: **@algorithm.ts/gomoku** (npm)
- Minimax + Alpha-Beta + 패턴 평가
- https://www.npmjs.com/package/@algorithm.ts/gomoku

game-hub 통합 (games/omok/index.ts):
- Gomoku class를 그대로 가져와 Canvas 렌더링
- AI는 @algorithm.ts/gomoku의 GomokuSolution 사용
- 플레이어 매핑: 흑(●)=lib 1, 백(○)=lib 0
