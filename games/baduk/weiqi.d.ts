declare module 'weiqi' {
  export interface WeiqiGame {
    get(key: string): any;
    set(key: string, value: any): WeiqiGame;
    update(key: string, fn: (v: any) => any): WeiqiGame;
  }
  const Weiqi: {
    createGame(size: number): WeiqiGame;
    play(game: WeiqiGame, player: 'black' | 'white', position: [number, number]): WeiqiGame;
    pass(game: WeiqiGame, player: 'black' | 'white'): WeiqiGame;
    isOver(game: WeiqiGame): boolean;
    areaScore(game: WeiqiGame, komi?: number): number;
  };
  export default Weiqi;
}
