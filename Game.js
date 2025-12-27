// MERGED: Clicker + Neon Maze (Flow A)
// - Clicker area accumulates points (saved to localStorage)
// - Shop: x25/x50/x100 multipliers, Auto Clicker
// - Floating +points, click animations, synthesized SFX & music
// - When points >= 1000: clicker hidden, maze starts (3 levels: 30/25/20s)
// - Maze: drag key through neon maze without touching walls; finish 3 levels -> login unlocked

(() => {
  /* ---------- Config & State ---------- */
  const NEED_POINTS = 1000;
  const levelTimes = {1:30, 2:25, 3:20};

  // Clicker state
  let points = Number(localStorage.getItem('pts')) || 0;
  let multiplier = Number(localStorage.getItem('mul')) || 1;
  let autoOn = localStorage.getItem('auto') === 'true';
  let autoIntervalId = null;

  // Maze state (set when maze starts)
  let mazeStarted = false;

  /* ---------- DOM ---------- */
  const clickerScreen = document.getElementById('clickerScreen');
  const mazeScreen = document.getElementById('mazeScreen');
  const loginScreen = document.getElementById('loginScreen');

  const clickerArea = document.getElementById('clickerArea');
  const pointsDisplay = document.getElementById('pointsDisplay');
  const multDisplay = document.getElementById('multDisplay');

  const buy25 = document.getElementById('buy25');
  const buy50 = document.getElementById('buy50');
  const buy100 = document.getElementById('buy100');
  const buyAuto = document.getElementById('buyAuto');
  const buySkin = document.getElementById('buyThemeSkin');

  const themeSel = document.getElementById('themeSel');
  const musicToggle = document.getElementById('musicToggle');
  const resetAll = document.getElementById('resetAll');

  // Maze DOM
  const mazeCanvas = document.getElementById('mazeCanvas');
  const mazeCtx = mazeCanvas.getContext('2d');
  const levelText = document.getElementById('levelText');
  const timerText = document.getElementById('timerText');
  const mazeMsg = document.getElementById('mazeMsg');
  const restartLevelBtn = document.getElementById('restartLevel');
  const muteSfxBtn = document.getElementById('muteSfx');
  const backToClickerBtn = document.getElementById('backToClicker');

  // Login
  const doLoginBtn = document.getElementById('doLogin');
  const loginMsg = document.getElementById('loginMsg');

  /* ---------- Audio (WebAudio) ---------- */
  let audioCtx = null;
  let sfxOn = true;
  let musicOn = false;
  let musicOsc = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function playSfx(freq=440,type='sine',dur=0.08,vol=0.06){
    if (!sfxOn) return;
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    setTimeout(()=> o.stop(), dur*1000 + 20);
  }
  function startMusic(){
    if (!audioCtx) ensureAudio();
    if (musicOsc) return;
    musicOsc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    musicOsc.type = 'sine';
    musicOsc.frequency.value = 110;
    gain.gain.value = 0.02;
    musicOsc.connect(gain); gain.connect(audioCtx.destination);
    musicOsc.start();
    // gentle frequency LFO
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.2;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(musicOsc.frequency);
    lfo.start();
  }
  function stopMusic(){
    if (musicOsc) { try { musicOsc.stop(); } catch(e){} musicOsc = null; }
  }

  /* ---------- Utilities ---------- */
  function saveState(){
    localStorage.setItem('pts', points);
    localStorage.setItem('mul', multiplier);
    localStorage.setItem('auto', autoOn ? 'true' : 'false');
    localStorage.setItem('theme', document.body.className || 'neon');
  }
  function spawnFloatingText(x,y,text){
    const el = document.createElement('div');
    el.className = 'floating';
    el.style.left = (x - 10) + 'px';
    el.style.top = (y - 8) + 'px';
    el.style.color = document.body.classList.contains('light') ? '#111' : '#fff';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(()=> el.remove(), 900);
  }

  /* ---------- Clicker Logic ---------- */
  function updateUI(){
    pointsDisplay.textContent = `Points: ${points}`;
    multDisplay.textContent = `Multiplier: x${multiplier}`;
    buy25.disabled = !(points >= 25 && multiplier < 25);
    buy50.disabled = !(points >= 200 && multiplier < 50);
    buy100.disabled = !(points >= 500 && multiplier < 100);
    buyAuto.disabled = !(points >= 100 && !autoOn);
    // theme selector reflect saved theme
    themeSel.value = document.body.className || 'neon';
  }

  // Only count clicks inside the clickerArea to avoid maze drag conflict
  clickerArea.addEventListener('click', (e) => {
    if (mazeStarted) return; // do not collect while maze running
    points += multiplier;
    updateUI();
    playSfx(700,'square',0.06,0.04);
    const rect = clickerArea.getBoundingClientRect();
    spawnFloatingText(rect.left + (e.clientX-rect.left), rect.top + (e.clientY-rect.top), `+${multiplier}`);
    saveState();
    // quick pulse
    clickerArea.animate([{transform:'scale(1)'},{transform:'scale(0.98)'},{transform:'scale(1)'}],{duration:160});
    // auto unlock check
    if (points >= NEED_POINTS) {
      unlockMaze();
    }
  });

  // Shop actions
  buy25.addEventListener('click', ()=> {
    if (points >= 25 && multiplier < 25) {
      points -= 25; multiplier = 25; updateUI(); playSfx(900,'sawtooth',0.1,0.06); saveState();
    }
  });
  buy50.addEventListener('click', ()=> {
    if (points >= 200 && multiplier < 50) {
      points -= 200; multiplier = 50; updateUI(); playSfx(1100,'sawtooth',0.12,0.06); saveState();
    }
  });
  buy100.addEventListener('click', ()=> {
    if (points >= 200 && multiplier < 100) {
      points -= 200; multiplier = 100; updateUI(); playSfx(1400,'sawtooth',0.14,0.06); saveState();
    }
  });
  buyAuto.addEventListener('click', ()=> {
    if (points >= 100 && !autoOn) {
      points -= 100; autoOn = true; startAuto(); updateUI(); playSfx(550,'triangle',0.12,0.06); saveState();
    }
  });

  buySkin.addEventListener('click', ()=> {
    // quick random theme flash
    const themes = ['neon','dark','light'];
    const t = themes[Math.floor(Math.random()*themes.length)];
    setTheme(t);
    playSfx(1200,'sine',0.08,0.05);
  });

  function startAuto(){
    if (autoIntervalId) clearInterval(autoIntervalId);
    autoIntervalId = setInterval(()=> {
      if (!mazeStarted) {
        points += multiplier;
        updateUI();
        saveState();
        if (points >= NEED_POINTS) unlockMaze();
      }
    }, 1000);
  }
  if (autoOn) startAuto();

  /* ---------- Theme & Music ---------- */
  function setTheme(t){
    document.body.className = t;
    localStorage.setItem('theme', t);
  }
  // init theme
  const savedTheme = localStorage.getItem('theme') || 'neon';
  setTheme(savedTheme);
  themeSel.value = savedTheme;

  themeSel.addEventListener('change', (e)=> {
    setTheme(e.target.value);
  });

  musicToggle.addEventListener('click', ()=>{
    musicOn = !musicOn;
    if (musicOn){
      ensureAudio(); startMusic(); musicToggle.textContent = '🔊 Music: On';
    } else { stopMusic(); musicToggle.textContent = '🎵 Music'; }
  });

  // SFX mute toggle (for maze)
  muteSfxBtn.addEventListener('click', () => {
    sfxOn = !sfxOn;
    muteSfxBtn.textContent = sfxOn ? '🔊 Sound: On' : '🔇 Sound: Off';
  });

  resetAll.addEventListener('click', ()=> {
    if (!confirm('Reset points, upgrades, and progress?')) return;
    localStorage.clear();
    points = 0; multiplier = 1; autoOn = false;
    if (autoIntervalId) clearInterval(autoIntervalId);
    stopMusic();
    musicOn = false;
    updateUI();
    location.reload();
  });

  /* ---------- Unlock Maze Flow ---------- */
  function unlockMaze(){
    // show a small celebration then switch
    playSfx(1600,'sine',0.18,0.12);
    clickerScreen.classList.add('hidden');
    mazeScreen.classList.remove('hidden');
    mazeStarted = true;
    // start maze with level 1
    setTimeout(()=> {
      mazeStart();
    }, 220);
  }

  /* ---------- Maze Implementation (based on your requested neon maze) ---------- */
  // Maze engine variables
  const W = mazeCanvas.width, H = mazeCanvas.height;
  let currentLevel = 1, maxLevel = 3;
  let timeLeft = levelTimes[1];
  let timerId = null;
  let player = {x:0,y:0,r:14,dragging:false};
  let goal = {x:0,y:0,r:18};
  let pointerId = null;
  let animReq = null;

  // Walls per level (rectangles)
  const levels = {
    1: {
      walls: [
        {x:0,y:0,w:W,h:8},{x:0,y:0,w:8,h:H},{x:W-8,y:0,w:8,h:H},{x:0,y:H-8,w:W,h:8},
        {x:100,y:60,w:20,h:420}, {x:220,y:60,w:20,h:380}, {x:340,y:180,w:20,h:360},
        {x:460,y:60,w:20,h:420}, {x:580,y:60,w:20,h:380}, {x:700,y:160,w:20,h:320}
      ],
      start: {x:40,y:40,r:14}, goal: {x:W-72,y:H-72,r:18}
    },
    2: {
      walls: [
        {x:0,y:0,w:W,h:8},{x:0,y:0,w:8,h:H},{x:W-8,y:0,w:8,h:H},{x:0,y:H-8,w:W,h:8},
        {x:120,y:40,w:20,h:240}, {x:260,y:120,w:20,h:480}, {x:400,y:40,w:20,h:240},
        {x:540,y:120,w:20,h:480}, {x:680,y:40,w:20,h:520},
        {x:200,y:40,w:400,h:20}, {x:200,y:H-60,w:400,h:20}
      ],
      start: {x:50,y:H-60,r:14}, goal:{x:W-80,y:60,r:20}
    },
    3: {
      walls: [
        {x:0,y:0,w:W,h:8},{x:0,y:0,w:8,h:H},{x:W-8,y:0,w:8,h:H},{x:0,y:H-8,w:W,h:8},
        {x:80,y:80,w:20,h:440},{x:160,y:80,w:20,h:360},{x:240,y:200,w:20,h:360},
        {x:320,y:80,w:20,h:360},{x:400,y:200,w:20,h:360},{x:480,y:80,w:20,h:360},
        {x:560,y:200,w:20,h:360},{x:640,y:80,w:20,h:440}
      ],
      start: {x:40,y:40,r:14}, goal:{x:W-60,y:H-60,r:22}
    }
  };

  function rectsCollide(rx,ry,rw,rh,cx,cy,cr){
    const nx = Math.max(rx, Math.min(cx, rx+rw));
    const ny = Math.max(ry, Math.min(cy, ry+rh));
    const dx = cx-nx, dy = cy-ny;
    return (dx*dx + dy*dy) <= (cr*cr);
  }
  function inGoal(){ const dx=player.x-goal.x, dy=player.y-goal.y; return dx*dx+dy*dy <= (player.r+goal.r)*(player.r+goal.r); }

  function setMazeLevel(n){
    currentLevel = n;
    if (currentLevel > maxLevel) currentLevel = maxLevel;
    levelText.textContent = `Level ${currentLevel} / ${maxLevel}`;
    const L = levels[currentLevel];
    player.x = L.start.x; player.y = L.start.y; player.r = L.start.r;
    goal.x = L.goal.x; goal.y = L.goal.y; goal.r = L.goal.r;
    timeLeft = levelTimes[currentLevel];
    timerText.textContent = `Time: ${timeLeft}`;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(()=> {
      timeLeft -= 1;
      timerText.textContent = `Time: ${timeLeft}`;
      if (timeLeft <= 0) failLevel('time');
    },1000);
    playSfx(600,'sawtooth',0.12,0.06);
    drawMaze();
  }

  function failLevel(reason='hit'){
    playSfx(120,'sine',0.14,0.12);
    mazeMsg.textContent = reason==='time' ? '⏳ Time up! Restarting...' : '💥 Hit a wall! Restarting...';
    setTimeout(()=> {
      mazeMsg.textContent = 'Drag the KEY to the LOCK';
      setMazeLevel(currentLevel);
    }, 700);
  }

  function levelComplete(){
    playSfx(1000,'triangle',0.18,0.12);
    mazeMsg.textContent = '✅ Level complete!';
    mazeCanvas.classList.add('levelComplete');
    setTimeout(()=> mazeCanvas.classList.remove('levelComplete'), 600);
    if (currentLevel < maxLevel){
      setTimeout(()=> setMazeLevel(currentLevel+1), 900);
    } else {
      // all done
      clearInterval(timerId);
      finishMazeSequence();
    }
  }

  function finishMazeSequence(){
    mazeMsg.textContent = '🔓 All levels cleared — Login unlocked!';
    playSfx(1400,'sine',0.22,0.16);
    mazeStarted = false;
    // Show login screen
    mazeScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    saveState();
  }

  // drawing
  function drawMaze(){
    const ctx = mazeCtx;
    ctx.clearRect(0,0,W,H);
    // subtle background
    const g = ctx.createRadialGradient(W/2,H/2,50,W/2,H/2,900);
    g.addColorStop(0,'rgba(0,10,15,0.06)'); g.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    // draw walls
    const walls = levels[currentLevel].walls;
    for (const w of walls){
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(w.x,w.y,w.w,w.h);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(57,255,20,0.12)'; ctx.strokeRect(w.x-1.5,w.y-1.5,w.w+3,w.h+3);
      ctx.strokeStyle = 'rgba(57,255,20,0.6)'; ctx.strokeRect(w.x,w.y,w.w,w.h);
      // red accents
      ctx.fillStyle = 'rgba(255,23,68,0.12)';
      for (let i=0;i<3;i++){
        const rx = w.x + (Math.random()*Math.max(2,w.w-6));
        const ry = w.y + (Math.random()*Math.max(2,w.h-6));
        ctx.fillRect(rx,ry,2,Math.min(12,w.h*0.12));
      }
    }
    // draw lock
    drawLock(goal.x,goal.y,goal.r);
    // draw key/player
    drawKey(player.x,player.y,player.r);
  }

  function drawKey(x,y,r){
    const ctx = mazeCtx;
    ctx.beginPath(); ctx.arc(x,y,r+8,0,Math.PI*2); ctx.fillStyle = 'rgba(0,229,255,0.04)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle = 'rgba(0,229,255,0.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,229,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(0,229,255,0.95)'; ctx.font = `${r}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⌁',x,y+1);
  }
  function drawLock(x,y,r){
    const ctx = mazeCtx;
    const t = performance.now()*0.002;
    ctx.save(); ctx.translate(x,y); ctx.rotate(t);
    ctx.beginPath(); ctx.arc(0,0,r+10,0,Math.PI*2); ctx.strokeStyle='rgba(255,23,68,0.08)'; ctx.lineWidth=6; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle='rgba(255,23,68,0.2)'; ctx.fill();
    ctx.strokeStyle='rgba(255,23,68,0.95)'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='rgba(255,23,68,0.95)'; ctx.font = `${r}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⏁',x,y+1);
  }

  // pointer controls
  mazeCanvas.addEventListener('pointerdown', (ev)=>{
    if (!mazeStarted) return;
    ev.preventDefault();
    const rect = mazeCanvas.getBoundingClientRect();
    const x = ev.clientX - rect.left; const y = ev.clientY - rect.top;
    const dx = x - player.x, dy = y - player.y;
    if (dx*dx + dy*dy <= player.r*player.r){
      player.dragging = true; pointerId = ev.pointerId; mazeCanvas.setPointerCapture(pointerId);
      playSfx(800,'square',0.06,0.06);
    }
  });
  mazeCanvas.addEventListener('pointermove', (ev)=>{
    if (!player.dragging || ev.pointerId !== pointerId) return;
    const rect = mazeCanvas.getBoundingClientRect();
    player.x = Math.max(player.r+4, Math.min(W-player.r-4, ev.clientX - rect.left));
    player.y = Math.max(player.r+4, Math.min(H-player.r-4, ev.clientY - rect.top));
    // collision check
    for (const w of levels[currentLevel].walls){
      if (rectsCollide(w.x,w.y,w.w,w.h,player.x,player.y,player.r)){
        player.dragging = false; try{ mazeCanvas.releasePointerCapture(pointerId); }catch(e){} pointerId=null;
        failLevel('hit'); return;
      }
    }
    if (inGoal()){
      player.dragging = false; try{ mazeCanvas.releasePointerCapture(pointerId); }catch(e){} pointerId=null;
      levelComplete(); return;
    }
    drawMaze();
  });
  mazeCanvas.addEventListener('pointerup',(ev)=>{
    if (ev.pointerId === pointerId){
      player.dragging=false; try{ mazeCanvas.releasePointerCapture(pointerId); }catch(e){} pointerId=null;
    }
  });

  // keyboard nudges
  window.addEventListener('keydown',(e)=>{
    if (!mazeStarted) return;
    const step = 8;
    if (e.key==='ArrowUp') player.y -= step;
    if (e.key==='ArrowDown') player.y += step;
    if (e.key==='ArrowLeft') player.x -= step;
    if (e.key==='ArrowRight') player.x += step;
    player.x = Math.max(player.r+4, Math.min(W-player.r-4, player.x));
    player.y = Math.max(player.r+4, Math.min(H-player.r-4, player.y));
    // collision & goal check
    for (const w of levels[currentLevel].walls){ if (rectsCollide(w.x,w.y,w.w,w.h,player.x,player.y,player.r)){ failLevel('hit'); return; } }
    if (inGoal()) levelComplete(); drawMaze();
  });

  restartLevelBtn.addEventListener('click', ()=> { playSfx(300,'sine',0.08,0.06); setMazeLevel(currentLevel); });

  backToClickerBtn.addEventListener('click', ()=> {
    // allow user to go back to clicker (keeps progress)
    mazeScreen.classList.add('hidden'); clickerScreen.classList.remove('hidden'); mazeStarted=false;
  });

  /* ---------- Maze lifecycle ---------- */
  function mazeStart(){
    mazeStarted = true;
    setMazeLevel(1);
    fitCanvas();
    loopAnim();
  }

  function loopAnim(){
    drawMaze();
    animReq = requestAnimationFrame(loopAnim);
  }

  /* ---------- End game / login ---------- */
  doLoginBtn.addEventListener('click', ()=> {
    loginMsg.textContent = 'Pretend login successful — nice job!';
    playSfx(1400,'sine',0.08,0.08);
  });

  /* ---------- Helpers: responsiveness ---------- */
  function fitCanvas(){
    const maxW = Math.min(window.innerWidth - 40, 1000);
    const scale = Math.min(maxW / W, (window.innerHeight - 240) / H, 1);
    mazeCanvas.style.transform = `scale(${scale})`;
    mazeCanvas.style.transformOrigin = 'top left';
  }
  window.addEventListener('resize', fitCanvas);

  /* ---------- Start / Init ---------- */
  function init() {
    updateUI();
    // restore theme
    const savedT = localStorage.getItem('theme'); if (savedT) setTheme(savedT);
    // update music button label
    musicToggle.textContent = musicOn ? '🔊 Music: On' : '🎵 Music';
    // if points already >= need, go to maze immediately
    if (points >= NEED_POINTS && !mazeStarted) {
      unlockMaze();
    }
  }
  init();

  // expose a small debugging global (optional)
  window._game = { getState: ()=> ({points,multiplier,autoOn,mazeStarted}) };

})();
