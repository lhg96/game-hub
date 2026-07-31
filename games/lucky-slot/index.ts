import type { GameModule } from '../../src/types';
import { sound } from '../../src/sound';

interface SymbolDef {
  icon: string;
  weight: number;
  multiplier: number;
}

const symbols: SymbolDef[] = [
  { icon: '💎', weight: 1, multiplier: 10 },
  { icon: '7️⃣', weight: 2, multiplier: 5 },
  { icon: '⭐', weight: 3, multiplier: 4 },
  { icon: '🔔', weight: 3, multiplier: 3 },
  { icon: '🍒', weight: 4, multiplier: 2 },
  { icon: '🍋', weight: 5, multiplier: 1.5 },
  { icon: '🍇', weight: 4, multiplier: 1.2 },
  { icon: '🍊', weight: 4, multiplier: 1.8 },
];

const WIN_LINES: { idx: number; cells: number[]; label: string; diag: boolean }[] = [
  { idx: 0, cells: [0, 1, 2], label: 'TOP', diag: false },
  { idx: 1, cells: [3, 4, 5], label: 'CENTER', diag: false },
  { idx: 2, cells: [6, 7, 8], label: 'BOTTOM', diag: false },
  { idx: 3, cells: [0, 4, 8], label: 'DIAG ↘', diag: true },
  { idx: 4, cells: [2, 4, 6], label: 'DIAG ↙', diag: true },
];

let game: GameModule = {
  id: 'lucky-slot',
  title: 'LUCKY SLOT',
  description: '럭키 슬롯! 3×3 라인 매치',

  mount(root) {
    let balance = 1000;
    let currentBet = 10;
    let isSpinning = false;

    const container = document.createElement('div');
    container.style.cssText = 'width:100%;max-width:480px;margin:0 auto;text-align:center;position:relative;';

    // ====== CSS ======
    const css = document.createElement('style');
    css.textContent = `
      @keyframes slotBlur {
        0% { transform: translateY(-30px); filter: blur(4px); opacity: 0.4; }
        100% { transform: translateY(30px); filter: blur(4px); opacity: 0.4; }
      }
      .reel.spinning .slot-symbol { animation: slotBlur 0.08s infinite linear !important; }

      @keyframes winGlow {
        0%, 100% { box-shadow: inset 0 0 8px rgba(255,50,50,0.4), 0 0 12px rgba(255,50,50,0.3); border-color: #ff3333; }
        50% { box-shadow: inset 0 0 16px rgba(255,50,50,0.7), 0 0 24px rgba(255,50,50,0.6); border-color: #ff6666; }
      }
      .win-highlight {
        animation: winGlow 0.5s ease-in-out infinite alternate !important;
        border: 2px solid #ff3333 !important;
        background: rgba(255,50,50,0.12) !important;
      }

      @keyframes lineFlash {
        0%, 100% { opacity: 1; } 50% { opacity: 0.2; }
      }
      .line-label {
        position:absolute;left:50%;transform:translateX(-50%);
        font-size:0.6rem;font-weight:800;letter-spacing:1px;
        color:#ff4444;text-shadow:0 0 8px rgba(255,50,50,0.8);
        animation:lineFlash 0.3s ease-in-out infinite alternate;
        pointer-events:none;z-index:5;
        background:rgba(0,0,0,0.6);padding:1px 6px;border-radius:3px;
        white-space:nowrap;
      }

      @keyframes particleFade {
        0% { transform:translate(0,0) scale(1); opacity:1; }
        100% { transform:translate(var(--px),var(--py)) scale(0); opacity:0; }
      }
      .particle {
        position:absolute;width:7px;height:7px;border-radius:50%;
        pointer-events:none;z-index:20;
        animation:particleFade 0.8s ease-out forwards;
      }

      @keyframes countPop {
        0% { transform:scale(1.5);color:#ffd700; }
        100% { transform:scale(1);color:#00ffcc; }
      }
      .count-pop { animation:countPop 0.35s ease-out; }

      @keyframes cellBounce {
        0% { transform:scaleY(1.12); }
        40% { transform:scaleY(0.92); }
        70% { transform:scaleY(1.05); }
        100% { transform:scaleY(1); }
      }
      .bounce { animation:cellBounce 0.3s ease-out; }

      /* ====== 레버: 붉은 공 스프링 ====== */
      @keyframes leverPull {
        0% { transform: translateY(0); }
        20% { transform: translateY(42px); }
        45% { transform: translateY(42px); }
        60% { transform: translateY(-10px); }
        72% { transform: translateY(5px); }
        82% { transform: translateY(-4px); }
        92% { transform: translateY(2px); }
        100% { transform: translateY(0); }
      }
      .lever-pull .lever-ball {
        animation: leverPull 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      .lever-container {
        position:relative;width:50px;cursor:pointer;
        display:flex;flex-direction:column;align-items:center;
        justify-content:flex-start;padding-top:8px;
        transition:opacity 0.2s;flex-shrink:0;
      }
      .lever-container.disabled { opacity:0.4; cursor:not-allowed; }
      .lever-ball {
        width:32px;height:32px;border-radius:50%;
        background:radial-gradient(circle at 35% 28%, #ff6677, #cc0033 60%, #880022);
        box-shadow:0 3px 12px rgba(255,0,50,0.6), inset 0 -3px 6px rgba(0,0,0,0.3);
        position:relative;z-index:2;
        border:1px solid rgba(255,100,100,0.3);
      }
      .lever-ball::after {
        content:'';position:absolute;top:6px;left:8px;
        width:10px;height:6px;border-radius:50%;
        background:rgba(255,255,255,0.3);
        transform:rotate(-20deg);
      }
      .lever-rod {
        width:4px;height:55px;
        background:linear-gradient(180deg, #555, #333);
        border-radius:2px;margin-top:-4px;z-index:1;
      }
      .lever-base {
        width:36px;height:10px;
        background:linear-gradient(180deg, #555, #333);
        border-radius:3px 3px 5px 5px;margin-top:-2px;
        box-shadow:0 2px 4px rgba(0,0,0,0.5);
        border:1px solid #444;
      }

      /* machine + lever wrapper */
      .slot-wrapper {
        display:flex;align-items:stretch;gap:6px;
        margin-bottom:18px;
      }
    `;

    // ====== 타이틀 ======
    const title = document.createElement('h2');
    title.textContent = '🎰 LUCKY SLOT';
    title.style.cssText = 'font-size:1.8rem;font-weight:900;letter-spacing:2px;margin-bottom:16px;background:linear-gradient(135deg,#ffd700,#ffaa00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:0 0 20px rgba(255,215,0,0.3);';

    // ====== 대시보드 ======
    const dash = document.createElement('div');
    dash.style.cssText = 'display:flex;justify-content:space-between;background:rgba(0,0,0,0.4);padding:12px 18px;border-radius:12px;margin-bottom:18px;border:1px solid rgba(255,255,255,0.05);';
    dash.innerHTML = `
      <div style="text-align:center">
        <div style="font-size:0.7rem;color:#8a8d9b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">보유 코인</div>
        <div style="font-size:1.2rem;font-weight:700;color:#ffd700" class="sb">1,000</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:0.7rem;color:#8a8d9b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">획득</div>
        <div style="font-size:1.2rem;font-weight:700;color:#00ffcc" class="slw">0</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:0.7rem;color:#8a8d9b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">당첨라인</div>
        <div style="font-size:0.85rem;font-weight:700;color:#ff6666" class="sll">0</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:0.7rem;color:#8a8d9b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">배율</div>
        <div style="font-size:0.85rem;font-weight:700;color:#ffaa00" class="sbm">1x</div>
      </div>
    `;

    // ====== 슬롯 머신 3×3 + 레버 ======
    const slotWrapper = document.createElement('div');
    slotWrapper.className = 'slot-wrapper';

    const machine = document.createElement('div');
    machine.style.cssText = 'flex:1;background:#050608;border-radius:12px;padding:10px;border:2px solid rgba(255,215,0,0.2);box-shadow:inset 0 0 16px rgba(0,0,0,0.8),0 0 12px rgba(255,215,0,0.1);position:relative;overflow:hidden;';

    // 파티클 레이어
    const pl = document.createElement('div');
    pl.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;';
    machine.appendChild(pl);

    // 릴 그리드
    const reelGrid = document.createElement('div');
    reelGrid.style.cssText = 'display:flex;gap:5px;';

    const reelDivs: HTMLDivElement[] = [];
    const cellEls: HTMLDivElement[] = [];

    for (let col = 0; col < 3; col++) {
      const reel = document.createElement('div');
      reel.className = 'reel';
      reel.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:5px;';
      reelGrid.appendChild(reel);
      reelDivs.push(reel);

      for (let row = 0; row < 3; row++) {
        const cell = document.createElement('div');
        cell.className = 'slot-cell';
        cell.style.cssText = 'aspect-ratio:1;background:linear-gradient(180deg,#11121a,#1a1c29);border-radius:8px;display:flex;justify-content:center;align-items:center;font-size:2.2rem;border:1px solid rgba(255,255,255,0.06);position:relative;transition:border 0.1s,background 0.1s;';
        const sym = document.createElement('div');
        sym.className = 'slot-symbol';
        sym.textContent = '🎰';
        cell.appendChild(sym);
        reel.appendChild(cell);
        cellEls.push(cell);
      }
    }

    machine.appendChild(reelGrid);

    // ====== 레버: 붉은 공 ======
    const leverContainer = document.createElement('div');
    leverContainer.className = 'lever-container';
    leverContainer.innerHTML = `
      <div class="lever-ball"></div>
      <div class="lever-rod"></div>
      <div class="lever-base"></div>
    `;
    leverContainer.title = '레버를 당겨서 스핀!';

    slotWrapper.append(machine, leverContainer);

    // ====== 컨트롤 ======
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    const betRow = document.createElement('div');
    betRow.style.cssText = 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap;';

    const betDefs = [
      { label: '10', val: 10 }, { label: '50', val: 50 },
      { label: '100', val: 100 }, { label: 'MAX', val: -1 },
    ];
    const betBtns: HTMLButtonElement[] = [];

    betDefs.forEach((bd, idx) => {
      const btn = document.createElement('button');
      btn.textContent = bd.label;
      btn.style.cssText =
        `background:${idx === 0 ? 'rgba(0,255,204,0.1)' : 'rgba(255,255,255,0.05)'};border:1px solid ${idx === 0 ? '#00ffcc' : 'rgba(255,255,255,0.1)'};color:${idx === 0 ? '#00ffcc' : '#fff'};padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s;font-size:0.85rem;`;
      btn.addEventListener('click', () => {
        if (isSpinning) return;
        betBtns.forEach(b => { b.style.background = 'rgba(255,255,255,0.05)'; b.style.borderColor = 'rgba(255,255,255,0.1)'; b.style.color = '#fff'; });
        btn.style.background = 'rgba(0,255,204,0.1)'; btn.style.borderColor = '#00ffcc'; btn.style.color = '#00ffcc';
        currentBet = bd.val === -1 ? balance : bd.val;
      });
      betBtns.push(btn);
      betRow.appendChild(btn);
    });

    // SPIN 버튼 (레버 보조)
    const spinBtn = document.createElement('button');
    spinBtn.textContent = '🎰 SPIN 🎰';
    spinBtn.style.cssText = 'background:linear-gradient(135deg,#ff007f,#d6006b);border:none;color:white;padding:14px;border-radius:10px;font-size:1.1rem;font-weight:800;letter-spacing:1px;cursor:pointer;transition:all 0.2s;';

    const msg = document.createElement('div');
    msg.style.cssText = 'margin-top:10px;font-size:0.9rem;height:22px;font-weight:600;color:#00ffcc;';
    msg.textContent = '레버를 당겨라! 🎰';

    controls.append(betRow, spinBtn);
    container.append(css, title, dash, slotWrapper, controls, msg);
    root.appendChild(container);

    // 대시보드 ref
    const balEl = container.querySelector('.sb')!;
    const lwEl = container.querySelector('.slw')!;
    const lnEl = container.querySelector('.sll')!;
    const bmEl = container.querySelector('.sbm')!;

    // ====== 유틸 ======
    function rndSym(): SymbolDef {
      const tw = symbols.reduce((a, s) => a + s.weight, 0);
      let r = Math.random() * tw;
      for (const s of symbols) { if (r < s.weight) return s; r -= s.weight; }
      return symbols[symbols.length - 1];
    }

    function updUI() {
      balEl.textContent = balance.toLocaleString();
      bmEl.textContent = `${currentBet.toLocaleString()}₩`;
    }

    function spawnParticles(n: number) {
      const cols = ['#ff007f', '#ffd700', '#00ffcc', '#ff3333', '#ffaa00', '#ff66ff', '#00ff88'];
      for (let i = 0; i < n; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText += `background:${cols[i % cols.length]};`;
        p.style.setProperty('--px', `${(Math.random() - 0.5) * 300}px`);
        p.style.setProperty('--py', `${(Math.random() - 0.5) * 300}px`);
        p.style.left = `${35 + Math.random() * 30}%`;
        p.style.top = `${35 + Math.random() * 30}%`;
        pl.appendChild(p);
        setTimeout(() => p.remove(), 800);
      }
    }

    function highlightLines(wl: number[]) {
      cellEls.forEach(c => c.classList.remove('win-highlight'));
      machine.querySelectorAll('.line-label').forEach(el => el.remove());
      if (wl.length === 0) return;
      for (const li of wl) {
        const line = WIN_LINES[li];
        if (!line) continue;
        for (const ci of line.cells) cellEls[ci]?.classList.add('win-highlight');
        const midCi = line.cells[1];
        const cellEl = cellEls[midCi];
        if (cellEl) {
          const lb = document.createElement('div');
          lb.className = 'line-label';
          lb.textContent = line.label;
          const mr = machine.getBoundingClientRect();
          const cr = cellEl.getBoundingClientRect();
          lb.style.top = `${cr.top - mr.top + cr.height / 2 - 8}px`;
          machine.appendChild(lb);
        }
      }
    }

    function animateLever() {
      const ball = leverContainer.querySelector('.lever-ball')!;
      ball.classList.remove('lever-pull');
      void (ball as HTMLElement).offsetWidth;
      ball.classList.add('lever-pull');
    }

    function setSpinUI(disabled: boolean) {
      spinBtn.disabled = disabled;
      if (disabled) {
        spinBtn.style.cssText = 'background:#333444;border:none;color:#666;padding:14px;border-radius:10px;font-size:1.1rem;font-weight:800;cursor:not-allowed;';
        leverContainer.classList.add('disabled');
      } else {
        spinBtn.style.cssText = 'background:linear-gradient(135deg,#ff007f,#d6006b);border:none;color:white;padding:14px;border-radius:10px;font-size:1.1rem;font-weight:800;letter-spacing:1px;cursor:pointer;transition:all 0.2s;';
        leverContainer.classList.remove('disabled');
      }
    }

    function checkWin(results: SymbolDef[][]) {
      isSpinning = false;
      setSpinUI(false);

      // 5개 라인별 3매치 검사
      const matchedLines: number[] = [];
      let totalWin = 0;
      for (const line of WIN_LINES) {
        const icons = line.cells.map(ci => {
          const r = Math.floor(ci / 3), c = ci % 3;
          return results[c][r].icon;
        });
        if (icons[0] === icons[1] && icons[1] === icons[2]) {
          const sym = symbols.find(s => s.icon === icons[0]);
          if (sym) {
            // 일반라인 3x, 대각선 4x 배율
            const lineMult = line.diag ? 4 : 3;
            totalWin += Math.floor(currentBet * sym.multiplier * lineMult);
            matchedLines.push(line.idx);
          }
        }
      }

      // 2매치 consolation (전체에서 하나만)
      if (matchedLines.length === 0) {
        for (const line of WIN_LINES) {
          const icons = line.cells.map(ci => {
            const r = Math.floor(ci / 3), c = ci % 3;
            return results[c][r].icon;
          });
          if (icons[0] === icons[1] || icons[1] === icons[2] || icons[0] === icons[2]) {
            totalWin += Math.floor(currentBet * 0.5);
            break; // 한 번만
          }
        }
      }

      if (totalWin > 0) {
        balance += totalWin;
        lwEl.textContent = `+${totalWin.toLocaleString()}`;
        lnEl.textContent = String(matchedLines.length);
        if (matchedLines.length > 0) {
          msg.textContent = `🎉 ${matchedLines.length}개 라인 매치! +${totalWin.toLocaleString()}`;
        } else {
          msg.textContent = `👍 2매치! +${totalWin.toLocaleString()}`;
        }
        highlightLines(matchedLines);
        spawnParticles(matchedLines.length > 0 ? 25 + matchedLines.length * 10 : 10);
        sound.cheer();
        (lwEl as HTMLElement).classList.remove('count-pop');
        void (lwEl as HTMLElement).offsetWidth;
        (lwEl as HTMLElement).classList.add('count-pop');
      } else {
        msg.textContent = '아쉽네요. 다시 시도해보세요!';
        highlightLines([]);
        lnEl.textContent = '0';
        sound.sad();
      }

      updUI();
    }

    function spin() {
      if (isSpinning) return;
      if (balance < currentBet || balance === 0) {
        msg.textContent = '코인이 부족합니다! (무료 코인 지급됨)';
        balance += 500; updUI(); return;
      }

      balance -= currentBet;
      isSpinning = true;
      setSpinUI(true);
      msg.textContent = '레버를 당겼다! 🎰';
      highlightLines([]);
      lwEl.textContent = '0';
      lnEl.textContent = '0';
      updUI();

      // 레버 애니메이션
      animateLever();

      pl.innerHTML = '';
      cellEls.forEach(c => { c.querySelector('.slot-symbol')!.textContent = '🎰'; });

      // 릴 스핀
      reelDivs.forEach(r => r.classList.add('spinning'));

      // 결과 생성
      const cols: SymbolDef[][] = [
        [rndSym(), rndSym(), rndSym()],
        [rndSym(), rndSym(), rndSym()],
        [rndSym(), rndSym(), rndSym()],
      ];

      // 릴 차례 정지 (600ms → 1000ms → 1400ms)
      const COL_STOPS = [600, 1000, 1400];
      for (let col = 0; col < 3; col++) {
        const delay = COL_STOPS[col];
        setTimeout(() => {
          reelDivs[col].classList.remove('spinning');
          for (let row = 0; row < 3; row++) {
            const idx = row * 3 + col;
            cellEls[idx].querySelector('.slot-symbol')!.textContent = cols[col][row].icon;
            cellEls[idx].classList.add('bounce');
            setTimeout(() => cellEls[idx].classList.remove('bounce'), 300);
          }
          sound.tap();
          if (col === 2) {
            msg.textContent = '결과 확인 중...';
            setTimeout(() => checkWin(cols), 300);
          }
        }, delay);
      }
    }

    spinBtn.addEventListener('click', spin);
    leverContainer.addEventListener('click', spin);

    updUI();
  },
};

export default game;
