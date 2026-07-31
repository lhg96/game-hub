import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';
import { createChar } from '../../src/char';

const BEST_KEY = 'whack.best';

let game: GameModule = {
  id: 'whack',
  title: '두더지 잡기',
  description: '30초 · 콤보로 점수를 쌓아라',

  mount(root) {
    const char = createChar({ color: '#5ce16a', label: 'GARDENER' });
    const HOLES = 9;
    const TIME = 30;
    let score = 0;
    let best = Number(localStorage.getItem(BEST_KEY) ?? '0');
    let timeLeft = TIME;
    let active = new Set<number>(); // 현재 올라온 두더지들 (난이도 상 슬라이드 가능)
    let running = false;
    let spawnTimer: number | undefined;
    let tickTimer: number | undefined;
    let combo = 0;
    let lastHit = 0;

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:340px';

    // 상단 HUD
    const hud = document.createElement('div');
    hud.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;width:100%';
    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size:20px;font-weight:700';
    scoreEl.textContent = '점수 0';
    const bestEl = document.createElement('div');
    bestEl.style.cssText = 'font-size:13px;color:var(--muted)';
    bestEl.textContent = `최고 ${best}`;
    const mute = document.createElement('button');
    mute.textContent = sound.isMuted() ? '🔇' : '🔊';
    mute.className = 'back-btn';
    mute.style.padding = '4px 10px';
    mute.addEventListener('click', () => {
      const m = sound.toggleMute();
      mute.textContent = m ? '🔇' : '🔊';
    });
    hud.append(scoreEl, bestEl, mute);

    // 타이머 진행바
    const barOuter = document.createElement('div');
    barOuter.style.cssText =
      'width:100%;height:8px;background:#1a1f35;border-radius:6px;overflow:hidden';
    const bar = document.createElement('div');
    bar.style.cssText =
      'height:100%;width:100%;background:linear-gradient(90deg,#6c8cff,#5ce1a6);transition:width 1s linear';
    barOuter.appendChild(bar);

    const status = document.createElement('div');
    status.style.cssText = 'font-size:15px;min-height:22px;color:var(--muted)';

    // 구멍 그리드
    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(3,90px);gap:12px;touch-action:manipulation';
    const holes: HTMLDivElement[] = [];
    for (let i = 0; i < HOLES; i++) {
      const hole = document.createElement('div');
      hole.style.cssText =
        'position:relative;width:90px;height:90px;border-radius:50%;' +
        'background:radial-gradient(circle at 50% 30%,#2a3150,#141829);' +
        'overflow:hidden;border:2px solid #232a45;cursor:pointer';
      const mole = document.createElement('div');
      mole.textContent = '🐹';
      mole.style.cssText =
        'position:absolute;left:50%;bottom:-70px;transform:translateX(-50%);' +
        'font-size:52px;line-height:1;transition:bottom 0.14s cubic-bezier(.34,1.56,.64,1)';
      mole.dataset.up = '0';
      hole.appendChild(mole);
      hole.addEventListener('click', () => whack(i));
      holes.push(hole);
      grid.appendChild(hole);
    }

    const startBtn = document.createElement('button');
    startBtn.textContent = '시작';
    startBtn.className = 'back-btn';
    startBtn.style.fontSize = '18px';
    startBtn.style.padding = '10px 28px';

    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:12px;color:var(--muted);font-weight:600';
    charLabel.textContent = 'GARDENER';
    const charRow = document.createElement('div');
    charRow.style.cssText = 'display:flex;align-items:center;gap:8px';
    charRow.append(char.canvas, charLabel);

    wrap.append(hud, barOuter, charRow, status, grid, startBtn);
    root.appendChild(wrap);

    function setStatus(t: string) {
      status.textContent = t;
    }
    function setScore() {
      scoreEl.textContent = `점수 ${score}`;
    }
    function popText(el: HTMLDivElement, text: string, color: string) {
      const p = document.createElement('div');
      p.textContent = text;
      p.style.cssText =
        `position:absolute;left:50%;top:6px;transform:translateX(-50%);` +
        `font-weight:700;color:${color};font-size:18px;pointer-events:none;` +
        `animation:whackPop 0.6s ease-out forwards`;
      el.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }

    function raise(i: number) {
      const mole = holes[i].firstChild as HTMLDivElement;
      if (mole.dataset.up === '1') return;
      mole.dataset.up = '1';
      mole.style.bottom = '8px';
      active.add(i);
      sound.pop();
    }
    function lower(i: number) {
      const mole = holes[i].firstChild as HTMLDivElement;
      mole.dataset.up = '0';
      mole.style.bottom = '-70px';
      active.delete(i);
    }
    function lowerAll() {
      active.forEach((i) => lower(i));
      active.clear();
    }

    function spawn() {
      // 동시에 1~2마리, 점수 오를수록 빠르게
      lowerAll();
      const count = 1 + (Math.random() < Math.min(0.15 + score / 400, 0.6) ? 1 : 0);
      const pool = [...Array(HOLES).keys()].filter((i) => !active.has(i));
      for (let k = 0; k < count && pool.length; k++) {
        const idx = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        const mole = holes[idx].firstChild as HTMLDivElement;
        // 타입: 일반 70%, 금색 18%, 폭탄 12%
        const r = Math.random();
        let type = 'normal';
        let face = '🐹';
        if (r > 0.88) { type = 'bomb'; face = '💣'; }
        else if (r > 0.7) { type = 'gold'; face = '🌟'; }
        mole.dataset.type = type;
        mole.textContent = face;
        raise(idx);
      }
    }

    function whack(i: number) {
      if (!running) return;
      const mole = holes[i].firstChild as HTMLDivElement;
      if (mole.dataset.up !== '1') {
        sound.miss();
        return;
      }
      const type = mole.dataset.type || 'normal';
      const now = Date.now();
      if (now - lastHit < 250) combo++;
      else combo = 1;
      lastHit = now;

      if (type === 'bomb') {
        // 폭탄을 맞추면 감점 + 시간 감소
        score = Math.max(0, score - 20);
        timeLeft = Math.max(1, timeLeft - 2);
        combo = 0;
        setScore();
        sound.sad();
        char.setState('sad', 800);
        popText(holes[i], '-20 💥', '#ff5e5e');
        holes[i].animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
          { duration: 160 }
        );
        lower(i);
        return;
      }

      const bonus = combo > 1 ? Math.min(combo - 1, 5) : 0;
      let gain = 10 + bonus * 5;
      let color = bonus ? '#ffd166' : '#5ce1a6';
      let label = `+${gain}`;
      if (type === 'gold') {
        gain += 20;
        label = `+${gain} ⭐`;
        color = '#ffd166';
        sound.coin();
        char.setState('excited', 700);
      } else {
        if (combo > 1) sound.combo(combo);
        else sound.hit();
        if (combo >= 3) char.setState('excited', 600);
        else char.setState('happy', 400);
      }
      score += gain;
      setScore();

      popText(holes[i], label + (bonus && type !== 'gold' ? ' x' + combo : ''), color);
      holes[i].animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1)' }],
        { duration: 120 }
      );
      lower(i);
    }

    function tick() {
      timeLeft--;
      bar.style.width = `${(timeLeft / TIME) * 100}%`;
      setStatus(`남은 시간 ${timeLeft}s`);
      if (timeLeft <= 0) end();
    }

    function end() {
      running = false;
      clearInterval(spawnTimer);
      clearInterval(tickTimer);
      lowerAll();
      setStatus('종료!');
      if (score >= best * 0.6 && score > 0) {
        char.setState('happy', 999999);
      } else {
        char.setState('sad', 999999);
      }
      sound.gameOver();
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
        bestEl.textContent = `최고 ${best}`;
      }
      startBtn.textContent = '다시 시작';
    }

    function start() {
      if (running) return;
      score = 0;
      timeLeft = TIME;
      combo = 0;
      running = true;
      setScore();
      bar.style.width = '100%';
      startBtn.textContent = '게임 중…';
      setStatus('두더지를 잡으세요!');
      char.setState('think', 999999);
      sound.start();
      spawn();
      spawnTimer = window.setInterval(spawn, 750);
      tickTimer = window.setInterval(tick, 1000);
    }

    startBtn.addEventListener('click', start);
    setStatus('시작 버튼을 누르세요');

    // 팝업 애니메이션 키프레임 주입 (한 번만)
    if (!document.getElementById('whack-kf')) {
      const style = document.createElement('style');
      style.id = 'whack-kf';
      style.textContent =
        '@keyframes whackPop{0%{opacity:0;transform:translateX(-50%) translateY(8px) scale(.8)}' +
        '30%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-26px) scale(1.1)}}';
      document.head.appendChild(style);
    }

    game.unmount = () => {
      clearInterval(spawnTimer);
      clearInterval(tickTimer);
      lowerAll();
      char.destroy();
    };
  },
};

export default game;
