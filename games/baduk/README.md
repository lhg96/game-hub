# 바둑 게임 소스 출처

게임 엔진: **https://github.com/cjlarose/weiqi.js** (npm: weiqi@1.0.0)
- liberty capture, positional superko, 패스, 영역 점수 (areaScore)
- ISC 라이선스

AI: 자체 구현 간단 휴리스틱
- 상대 그룹 포위(1 liberty) 감지 → 캡처 우선
- 내 그룹 연결/확장, 상대 인접 견제
- 초반 중앙 선호

game-hub 통합 (games/baduk/index.ts):
- Weiqi.createGame(9) / Weiqi.play / Weiqi.pass / Weiqi.areaScore 사용
- board 상태는 game.get('board').get('stones')에서 읽어 Canvas 렌더링
- komi 7.5, 연속 패스 2회 시 종료
