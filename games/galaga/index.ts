import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';
import { createChar } from '../../src/char';

// js-galaga 기반 슈팅 — 모바일 터치 패치 + 캐릭터 + 효과음
// 이미지/효과음은 public/galaga/ 에 복사됨. WebGL ❌, canvas 2D.

const W = 420;
const H = 600;

let game: GameModule = {
  id: 'galaga',
  title: '갤러그',
  description: '우주 전투기로 몬스터를 격추하라',

  mount(root) {
    const char = createChar({ color: '#5ab0ff', label: 'PILOT' });

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:420px';

    // 상단 캐릭터 행
    const charRow = document.createElement('div');
    charRow.style.cssText = 'display:flex;align-items:center;gap:8px';
    const charLabel = document.createElement('div');
    charLabel.style.cssText = 'font-size:12px;color:var(--muted);font-weight:600';
    charLabel.textContent = 'PILOT';
    charRow.append(char.canvas, charLabel);

    // 상태/점수
    const status = document.createElement('div');
    status.style.cssText = 'font-size:14px;color:var(--muted);min-height:20px';

    // 캔버스
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText =
      'width:100%;max-width:420px;aspect-ratio:420/600;background:#000;border-radius:8px;border:1px solid #2a3150;touch-action:none';

    const ctx = canvas.getContext('2d')!;

    // 조작 버튼 (모바일)
    const pad = document.createElement('div');
    pad.style.cssText =
      'display:flex;gap:10px;width:100%;max-width:420px;justify-content:center;margin-top:4px';
    const leftBtn = document.createElement('button');
    const rightBtn = document.createElement('button');
    const fireBtn = document.createElement('button');
    [leftBtn, fireBtn, rightBtn].forEach((b) => {
      b.className = 'back-btn';
      b.style.cssText =
        'flex:1;padding:14px 0;font-size:18px;user-select:none;-webkit-user-select:none;touch-action:manipulation';
    });
    leftBtn.textContent = '◀';
    rightBtn.textContent = '▶';
    fireBtn.textContent = '🔥 발사';
    pad.append(leftBtn, fireBtn, rightBtn);

    // 시작/재시작 버튼
    const startBtn = document.createElement('button');
    startBtn.className = 'back-btn';
    startBtn.style.cssText = 'font-size:18px;padding:10px 28px';
    startBtn.textContent = '시작';

    wrap.append(charRow, status, canvas, pad, startBtn);
    root.appendChild(wrap);

    // 오디오 (로컬 에셋)
    const A = {
      bullet: new Audio('galaga/mp3/Bullet.mp3'),
      hit: new Audio('galaga/mp3/Monsterattak.mp3'),
      clear: new Audio('galaga/mp3/clear.mp3'),
      win: new Audio('galaga/mp3/win.mp3'),
      over: new Audio('galaga/mp3/gameover.mp3'),
    };

    // 이미지
    const img = {
      monster1: new Image(),
      monster2: new Image(),
      monster3: new Image(),
      roket: new Image(),
      bg: new Image(),
      heart: new Image(),
    };
    img.monster1.src = 'galaga/img/monster1.png';
    img.monster2.src = 'galaga/img/monster2.png';
    img.monster3.src = 'galaga/img/monster3.png';
    img.roket.src = 'galaga/img/roket.png';
    img.bg.src = 'galaga/img/background.png';
    img.heart.src = 'galaga/img/heart.png';

    // 상태 변수
    let timer: number | undefined;
    let timer1: number | undefined;
    let timer2: number | undefined;
    let clear = true;
    let t = 0;
    let heart = 3;
    let score = 0;
    let stage = 1;
    let running = false;
    let MonsterX: number[] = [];
    let MonsterY: number[] = [];
    let Monster_dx: number[] = [];
    let MonsterBulletX: number[] = [];
    let MonsterBulletY: number[] = [];
    let bulletX: number[] = [];
    let bulletY: number[] = [];
    const bullet_dy = -4;
    let roketX = 195;
    const roketY = 500;
    const roketW = 50;
    const roketH = 50;
    let lastShoot = 0;
    let curMonster = img.monster1;

    function setStatus(s: string) {
      status.textContent = s;
    }

    function drawBackground() {
      if (img.bg.complete) {
        ctx.drawImage(img.bg, 0, t);
        ctx.drawImage(img.bg, 0, t - H);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }
      t += 1;
      if (t > H) t = 0;
    }

    function drawRoket() {
      ctx.drawImage(img.roket, roketX, roketY);
    }

    function drawBullet() {
      for (let i = bulletX.length - 1; i >= 0; i--) {
        ctx.fillStyle = 'Yellow';
        ctx.fillRect(bulletX[i], bulletY[i], 5, 5);
        if (bulletY[i] < 10) {
          bulletX.splice(i, 1);
          bulletY.splice(i, 1);
        } else bulletY[i] += bullet_dy;
      }
    }

    function attack() {
      for (let j = MonsterX.length - 1; j >= 0; j--) {
        for (let i = bulletX.length - 1; i >= 0; i--) {
          if (
            bulletX[i] + 5 >= MonsterX[j] &&
            bulletX[i] <= MonsterX[j] + 20 &&
            bulletY[i] + 5 >= MonsterY[j] &&
            bulletY[i] <= MonsterY[j] + 20
          ) {
            MonsterX.splice(j, 1);
            MonsterY.splice(j, 1);
            Monster_dx.splice(j, 1);
            bulletX.splice(i, 1);
            bulletY.splice(i, 1);
            score += 100;
            sound.hit();
            if (MonsterX.length === 0) {
              stage++;
              clear = true;
            }
          }
        }
      }
    }

    function shoot() {
      const now = new Date().getTime();
      if (now - lastShoot > 350) {
        A.bullet.play().catch(() => {});
        score = Math.max(0, score - 1);
        bulletX.push(roketX + 20);
        bulletY.push(roketY);
        lastShoot = now;
      }
    }

    function drawMonster() {
      for (let i = 0; i < MonsterX.length; i++) {
        ctx.drawImage(curMonster, MonsterX[i], MonsterY[i]);
        MonsterX[i] += Monster_dx[i];
      }
    }

    function move() {
      for (let i = 0; i < MonsterX.length; i++) Monster_dx[i] = -Monster_dx[i];
    }

    function monsterBullet() {
      for (let i = 0; i < MonsterX.length; i++) {
        if (Math.floor(Math.random() * 4) === 0) {
          MonsterBulletX.push(MonsterX[i] + 10);
          MonsterBulletY.push(MonsterY[i]);
        }
      }
    }

    function drawMonsterBullet() {
      for (let i = MonsterBulletX.length - 1; i >= 0; i--) {
        ctx.fillStyle = 'Pink';
        ctx.fillRect(MonsterBulletX[i], MonsterBulletY[i], 5, 5);
        if (MonsterBulletY[i] > 580) {
          MonsterBulletX.splice(i, 1);
          MonsterBulletY.splice(i, 1);
        } else MonsterBulletY[i] -= bullet_dy;
      }
    }

    function damage() {
      for (let i = MonsterBulletX.length - 1; i >= 0; i--) {
        if (
          MonsterBulletX[i] + 5 >= roketX + 5 &&
          MonsterBulletX[i] <= roketX + roketW - 5 &&
          MonsterBulletY[i] + 5 >= roketY + 5 &&
          MonsterBulletY[i] <= roketY + roketH - 5
        ) {
          MonsterBulletX.splice(i, 1);
          MonsterBulletY.splice(i, 1);
          heart--;
          A.hit.play().catch(() => {});
          char.setState('sad', 500);
          if (heart < 0) gameover();
        }
      }
    }

    function drawHeart() {
      for (let i = 0; i < Math.max(0, heart); i++) {
        if (img.heart.complete) ctx.drawImage(img.heart, 5 + i * 30, 560);
      }
    }

    function drawScore() {
      ctx.font = '20px Arial';
      ctx.fillStyle = 'Red';
      ctx.fillText('Score:', 10, 20);
      ctx.font = '16px Arial';
      ctx.fillStyle = 'White';
      ctx.fillText(String(score), 70, 20);
      ctx.font = '16px Arial';
      ctx.fillStyle = 'White';
      ctx.fillText('Stage ' + stage, W - 80, 20);
    }

    function nextStage() {
      if (stage === 1 && clear) {
        bulletX = [];
        bulletY = [];
        MonsterX = [30, 130, 230, 330];
        MonsterY = [100, 70, 100, 70];
        Monster_dx = [0.5, 0.5, 0.5, 0.5];
        curMonster = img.monster1;
        clear = false;
      } else if (stage === 2 && clear) {
        A.clear.play().catch(() => {});
        heart++;
        bulletX = [];
        bulletY = [];
        MonsterX = [40, 130, 230, 300, 330];
        MonsterY = [200, 270, 100, 200, 70];
        Monster_dx = [1, 0.5, 1, 1, 0.5];
        curMonster = img.monster2;
        clear = false;
      } else if (stage === 3 && clear) {
        A.clear.play().catch(() => {});
        heart++;
        bulletX = [];
        bulletY = [];
        MonsterX = [30, 100, 130, 230, 330];
        MonsterY = [200, 100, 270, 40, 70];
        Monster_dx = [0.5, 2, 1, 2, 0.5];
        curMonster = img.monster3;
        clear = false;
      } else if (stage === 4 && clear) {
        win();
      }
    }

    function endScreen(title: string, color: string, audio: HTMLAudioElement) {
      running = false;
      if (timer) clearInterval(timer);
      if (timer1) clearInterval(timer1);
      if (timer2) clearInterval(timer2);
      audio.play().catch(() => {});
      ctx.clearRect(0, 0, W, H);
      drawBackground();
      ctx.font = '80px Arial';
      ctx.fillStyle = color;
      ctx.fillText(title, title === 'win!' ? 140 : 110, 200);
      ctx.font = '45px Arial';
      ctx.fillStyle = 'White';
      ctx.fillText('your score', 100, 250);
      const str = String(score);
      ctx.fillText(str, W / 2 - str.length * 13, H / 2);
      ctx.font = '30px Arial';
      ctx.strokeStyle = 'White';
      ctx.strokeText('다시 하기 버튼을 누르세요', 30, 350);
      ctx.drawImage(img.roket, 180, 420);
      startBtn.textContent = '다시 하기';
      char.setState(title === 'win!' ? 'happy' : 'sad', 999999);
      setStatus(title === 'win!' ? `승리! 점수 ${score}` : `게임 오버 점수 ${score}`);
    }

    function win() {
      endScreen('win!', 'Red', A.win);
    }
    function gameover() {
      endScreen('Lose!', 'Blue', A.over);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      drawBackground();
      drawMonsterBullet();
      attack();
      drawHeart();
      drawScore();
      drawBullet();
      drawRoket();
      drawMonster();
      damage();
      nextStage();

      // 좌우 이동 (터치/키보드)
      if (rightPressed && roketX < W - roketW) roketX += 4;
      if (leftPressed && roketX > 0) roketX -= 4;
      if (firePressed) shoot();
    }

    // 입력
    let leftPressed = false;
    let rightPressed = false;
    let firePressed = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') rightPressed = true;
      else if (e.key === 'ArrowLeft') leftPressed = true;
      else if (e.key === ' ' || e.key === 'ArrowUp') firePressed = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') rightPressed = false;
      else if (e.key === 'ArrowLeft') leftPressed = false;
      else if (e.key === ' ' || e.key === 'ArrowUp') firePressed = false;
    };

    const press = (btn: HTMLButtonElement, set: (v: boolean) => void) => {
      const down = (e: Event) => {
        e.preventDefault();
        set(true);
      };
      const up = (e: Event) => {
        e.preventDefault();
        set(false);
      };
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('mousedown', down);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
    };
    press(leftBtn, (v) => (leftPressed = v));
    press(rightBtn, (v) => (rightPressed = v));
    press(fireBtn, (v) => {
      firePressed = v;
      if (v && running) shoot();
    });

    // 캔버스 터치: 왼쪽 절반 탭=좌, 오른쪽 절반 탭=우, 동시 발사
    const onCanvasTouch = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < e.touches.length; i++) {
        const tx = e.touches[i].clientX - rect.left;
        if (tx < rect.width / 2) roketX = Math.max(0, roketX - 24);
        else roketX = Math.min(W - roketW, roketX + 24);
      }
      if (running) shoot();
    };
    canvas.addEventListener('touchstart', onCanvasTouch, { passive: false });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    function start() {
      if (running) return;
      // 초기화
      heart = 3;
      score = 0;
      stage = 1;
      clear = true;
      t = 0;
      roketX = 195;
      MonsterX = [];
      MonsterY = [];
      Monster_dx = [];
      MonsterBulletX = [];
      MonsterBulletY = [];
      bulletX = [];
      bulletY = [];
      leftPressed = rightPressed = firePressed = false;
      running = true;
      startBtn.textContent = '게임 중…';
      setStatus('몬스터를 격추하세요!');
      char.setState('think', 999999);
      sound.start();
      timer = window.setInterval(draw, 16);
      timer1 = window.setInterval(move, 500);
      timer2 = window.setInterval(monsterBullet, 700);
    }

    startBtn.addEventListener('click', start);
    setStatus('시작 버튼을 누르세요');

    game.unmount = () => {
      if (timer) clearInterval(timer);
      if (timer1) clearInterval(timer1);
      if (timer2) clearInterval(timer2);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      char.destroy();
    };
  },
};

export default game;
