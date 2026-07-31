// 게임 모듈 표준 인터페이스.
// 새로운 게임을 추가하려면 games/<id>/index.ts 에서 이 인터페이스를 구현하고
// default export 로 내보내기만 하면 레지스트리가 자동으로 찾습니다.

export interface GameModule {
  /** URL-safe 고유 ID (예: "tic-tac-toe") */
  id: string;
  /** 홈 화면에 표시될 이름 */
  title: string;
  /** 한 줄 설명 (선택) */
  description?: string;
  /** 게임 화면을 root 엘리먼트에 렌더링 */
  mount(root: HTMLElement): void;
  /** 게임 종료/뒤로가기 시 정리 (타이머 해제 등). 선택 */
  unmount?(): void;
}
