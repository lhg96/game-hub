import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';
import { createChar } from '../../src/char';

const SERIES_KEY = 'rps.series'; // consecutive series wins

let game: GameModule = {
  id: 'rps',
  title: '가위바위보',
  description: '컴퓨터와 3판 2선승',

  mount(root) {
    const char = createChar({ color: '#ff9f43', label: 'REF' });
    const RPS = ['✌️', '✊', '✋'];
    const NAME = ['가위', '바위', '보'];
    let win = 0;
    let lose = 0;
    let series = Number(localStorage.getItem(SERIES_KEY) ?? '0');
    let best = series;

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%';
    const status = document.createElement('div');
    status.style.cssText = 'font-size:18px;min-height:48px;text-align:center';
    const scoreLine = document.createElement('div');
    scoreLine.style.cssText = 'font-size:14px;color:var(--muted)';
    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:11px;color:var(--muted)';
    charLabel.textContent = 'REF (심판)';
    const arena = document.createElement('div');
    arena.style.cssText =
      'display:flex;gap:30px;align-items:center;font-size:40px';
    const you = document.createElement('div');
    you.textContent = '❔';
    const cpu = document.createElement('div');
    cpu.textContent = '❔';
    const vs = document.createElement('div');
    vs.style.cssText = 'font-size:16px;color:var(--muted)';
    vs.textContent = 'VS';
    arena.append(you, vs, cpu);
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:10px';
    const restart = document.createElement('button');
    restart.textContent = '다시 하기';
    restart.className = 'back-btn';
    const bestLine = document.createElement('div');
    bestLine.style.cssText = 'font-size:13px;color:var(--muted)';
    bestLine.textContent = `최다 연승: ${best}`;
    wrap.append(charLabel, char.canvas, status, scoreLine, arena, btns, restart, bestLine);
    root.appendChild(wrap);

    function setStatus(t: string) {
      status.textContent = t;
    }
    function setScore() {
      scoreLine.textContent = `나 ${win} : ${lose} 컴퓨터`;
    }
    function play(p: number) {
      if (win >= 2 || lose >= 2) return;
      const c = Math.floor(Math.random() * 3);
      you.textContent = RPS[p];
      cpu.textContent = RPS[c];
      sound.tap();
      if (p === c) {
        setStatus('비겼어요!');
        char.setState('idle');
      } else if ((p + 1) % 3 === c) {
        lose++;
        setStatus(`${NAME[c]}에 졌어요 😢`);
        char.setState('happy', 1500);
        sound.sad();
      } else {
        win++;
        setStatus(`${NAME[p]}로 이겼어요! 🎉`);
        char.setState('sad', 1500);
        sound.cheer();
      }
      setScore();
      if (win >= 2) {
        series++;
        best = Math.max(best, series);
        localStorage.setItem(SERIES_KEY, String(series));
        bestLine.textContent = `최다 연승: ${best}`;
        setStatus('🏆 승리!');
        char.setState('sad', 3000);
        sound.win();
      } else if (lose >= 2) {
        series = 0;
        localStorage.setItem(SERIES_KEY, '0');
        setStatus('💧 패배');
        char.setState('happy', 3000);
        sound.sad();
      }
    }
    function reset() {
      win = 0;
      lose = 0;
      you.textContent = '❔';
      cpu.textContent = '❔';
      setScore();
      setStatus('가위 / 바위 / 보 중 선택!');
      char.setState('idle');
    }

    ['가위', '바위', '보'].forEach((_n, i) => {
      const b = document.createElement('button');
      b.textContent = RPS[i];
      b.className = 'back-btn';
      b.style.fontSize = '24px';
      b.addEventListener('click', () => play(i));
      btns.appendChild(b);
    });
    restart.addEventListener('click', reset);
    reset();
  },
};

export default game;
