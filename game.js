const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.querySelector("#score"),
  wave: document.querySelector("#wave"),
  monsters: document.querySelector("#monsters"),
  hpText: document.querySelector("#hpText"),
  hpFill: document.querySelector("#hpFill"),
  hint: document.querySelector("#hint"),
  toast: document.querySelector("#toast"),
  start: document.querySelector("#startButton"),
  pause: document.querySelector("#pauseButton"),
  reset: document.querySelector("#resetButton"),
  sound: document.querySelector("#soundToggle"),
  touchPad: document.querySelector("#touchPad"),
  stick: document.querySelector("#stick"),
  attack: document.querySelector("#attackButton"),
};

const color = {
  player: "#ffd15c",
  gold: "#ffd15c",
  good: "#4af0a8",
  hit: "#ff6b4a",
  monster: "#b66cff",
  monster2: "#ff4f86",
  magic: "#7cc7ff",
  white: "#fffaf4",
};

let width = 0;
let height = 0;
let dpr = 1;
let audioContext = null;

const player = {
  x: 0,
  y: 0,
  r: 15,
  vx: 0,
  vy: 0,
  hp: 100,
  invincible: 0,
  attackCd: 0,
  facing: 0,
  visualFacing: 0,
  swing: 0,
  walk: 0,
  hurt: 0,
};

const input = {
  active: false,
  id: null,
  dx: 0,
  dy: 0,
};

const state = {
  running: false,
  paused: false,
  score: 0,
  wave: 1,
  spawning: 0,
  spawnTimer: 0,
  shake: 0,
  soundOn: true,
  lastTime: 0,
};

const monsters = [];
const orbs = [];
const slashes = [];
const particles = [];
const floorBits = [];

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!state.running) {
    player.x = width / 2;
    player.y = height * 0.62;
  }
  seedFloor();
}

function seedFloor() {
  floorBits.length = 0;
  const count = Math.max(42, Math.floor((width * height) / 11000));
  for (let i = 0; i < count; i += 1) {
    floorBits.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.4 + 0.5,
      a: Math.random() * 0.25 + 0.08,
    });
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function showToast(text, visible = true) {
  ui.toast.textContent = text;
  ui.toast.classList.toggle("hide", !visible);
}

function updateUi() {
  ui.score.textContent = Math.floor(state.score);
  ui.wave.textContent = state.wave;
  ui.monsters.textContent = monsters.length + state.spawning;
  ui.hpText.textContent = `${Math.max(0, Math.round(player.hp))}%`;
  ui.hpFill.style.width = `${Math.max(0, Math.min(100, player.hp))}%`;
  ui.pause.textContent = state.paused ? "继续" : "暂停";
}

function tone(frequency, duration, type = "sine", gainValue = 0.035) {
  if (!state.soundOn) return;
  audioContext ||= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(70, frequency * 0.72),
    audioContext.currentTime + duration
  );
  gain.gain.setValueAtTime(gainValue, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function burst(x, y, fill, amount, power) {
  for (let i = 0; i < amount; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(power * 0.22, power);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: rand(2, 6),
      fill,
      life: 1,
      decay: rand(0.012, 0.03),
    });
  }
}

function spawnMonster() {
  const side = Math.floor(rand(0, 4));
  let x;
  let y;
  if (side === 0) {
    x = rand(20, width - 20);
    y = -30;
  } else if (side === 1) {
    x = width + 30;
    y = rand(128, height - 145);
  } else if (side === 2) {
    x = rand(20, width - 20);
    y = height + 30;
  } else {
    x = -30;
    y = rand(128, height - 145);
  }

  const brute = Math.random() < Math.min(0.14 + state.wave * 0.018, 0.34);
  monsters.push({
    x,
    y,
    r: brute ? 20 : 15,
    hp: brute ? 3 + Math.floor(state.wave / 4) : 2 + Math.floor(state.wave / 6),
    maxHp: brute ? 3 + Math.floor(state.wave / 4) : 2 + Math.floor(state.wave / 6),
    speed: brute ? rand(0.45, 0.72) : rand(0.72, 1.08),
    wobble: rand(0, Math.PI * 2),
    hitFlash: 0,
    brute,
  });
}

function dropOrb(x, y) {
  if (Math.random() > 0.42) return;
  orbs.push({
    x,
    y,
    r: 8,
    heal: Math.random() < 0.35,
    pulse: 0,
  });
}

function startWave() {
  state.spawning = 4 + Math.floor(state.wave * 1.35);
  state.spawnTimer = 0;
  ui.hint.textContent = `第 ${state.wave} 波`;
  showToast(`第 ${state.wave} 波来了`, true);
  setTimeout(() => showToast("", false), 900);
}

function startGame() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.wave = 1;
  state.shake = 0;
  player.x = width / 2;
  player.y = height * 0.62;
  player.vx = 0;
  player.vy = 0;
  player.hp = 100;
  player.invincible = 800;
  player.attackCd = 0;
  player.swing = 0;
  player.hurt = 0;
  player.facing = -Math.PI / 2;
  player.visualFacing = player.facing;
  monsters.length = 0;
  orbs.length = 0;
  slashes.length = 0;
  particles.length = 0;
  ui.start.textContent = "进行中";
  startWave();
  updateUi();
}

function endGame() {
  state.running = false;
  state.paused = false;
  ui.start.textContent = "再来";
  ui.hint.textContent = "生命耗尽";
  showToast(`结束：${Math.floor(state.score)} 分，打到第 ${state.wave} 波`, true);
  state.shake = 22;
  burst(player.x, player.y, color.hit, 85, 6.6);
  tone(92, 0.32, "sawtooth", 0.045);
  updateUi();
}

function movePlayer(dt) {
  const speed = 0.27 * dt;
  const ax = input.dx * speed;
  const ay = input.dy * speed;
  if (Math.abs(input.dx) + Math.abs(input.dy) > 0.05) {
    player.facing = Math.atan2(input.dy, input.dx);
  }
  const turn = Math.atan2(Math.sin(player.facing - player.visualFacing), Math.cos(player.facing - player.visualFacing));
  player.visualFacing += turn * 0.22;
  player.vx += (ax - player.vx) * 0.3;
  player.vy += (ay - player.vy) * 0.3;
  player.x += player.vx;
  player.y += player.vy;
  player.x = Math.max(player.r + 8, Math.min(width - player.r - 8, player.x));
  player.y = Math.max(118, Math.min(height - 132, player.y));
  player.invincible = Math.max(0, player.invincible - dt);
  player.attackCd = Math.max(0, player.attackCd - dt);
  player.hurt = Math.max(0, player.hurt - dt / 220);
}

function attack() {
  if (!state.running || state.paused || player.attackCd > 0) return;
  player.attackCd = 300;
  player.swing = 1;
  const range = 82;
  slashes.push({
    x: player.x,
    y: player.y,
    r: 16,
    max: range,
    life: 1,
    angle: player.facing,
  });
  burst(player.x, player.y, color.gold, 18, 3.8);
  tone(520, 0.08, "triangle", 0.034);

  for (let i = monsters.length - 1; i >= 0; i -= 1) {
    const m = monsters[i];
    const distance = Math.hypot(m.x - player.x, m.y - player.y);
    if (distance <= range + m.r) {
      const angle = Math.atan2(m.y - player.y, m.x - player.x);
      m.x += Math.cos(angle) * 18;
      m.y += Math.sin(angle) * 18;
      m.hp -= 1;
      m.hitFlash = 120;
      burst(m.x, m.y, color.magic, 16, 4.4);

      if (m.hp <= 0) {
        state.score += m.brute ? 90 : 45;
        burst(m.x, m.y, m.brute ? color.monster2 : color.monster, 34, 5.2);
        dropOrb(m.x, m.y);
        monsters.splice(i, 1);
        tone(760, 0.1, "sine", 0.034);
      }
    }
  }
  updateUi();
}

function updateGame(dt) {
  if (!state.running || state.paused) return;

  movePlayer(dt);

  if (state.spawning > 0) {
    state.spawnTimer += dt;
    if (state.spawnTimer >= Math.max(240, 650 - state.wave * 26)) {
      state.spawnTimer = 0;
      state.spawning -= 1;
      spawnMonster();
    }
  } else if (monsters.length === 0) {
    state.wave += 1;
    player.hp = Math.min(100, player.hp + 14);
    state.score += 120;
    startWave();
  }

  for (const m of monsters) {
    m.wobble += 0.06;
    const angle = Math.atan2(player.y - m.y, player.x - m.x);
    const speed = (m.speed + state.wave * 0.025) * (m.brute ? 0.92 : 1);
    m.x += Math.cos(angle) * speed + Math.cos(m.wobble) * 0.18;
    m.y += Math.sin(angle) * speed + Math.sin(m.wobble) * 0.18;
    m.hitFlash = Math.max(0, m.hitFlash - dt);

    if (Math.hypot(m.x - player.x, m.y - player.y) < m.r + player.r) {
      if (player.invincible <= 0) {
        player.hp -= m.brute ? 16 : 10;
        player.invincible = 650;
        player.hurt = 1;
        state.shake = 12;
        burst(player.x, player.y, color.hit, 24, 4.8);
        tone(145, 0.12, "sawtooth", 0.04);
      }
    }
  }

  for (let i = orbs.length - 1; i >= 0; i -= 1) {
    const o = orbs[i];
    o.pulse += 0.08;
    if (Math.hypot(o.x - player.x, o.y - player.y) < o.r + player.r + 6) {
      if (o.heal) {
        player.hp = Math.min(100, player.hp + 16);
        state.score += 20;
        burst(o.x, o.y, color.good, 22, 4);
      } else {
        state.score += 55;
        burst(o.x, o.y, color.gold, 22, 4);
      }
      tone(o.heal ? 680 : 820, 0.08, "triangle", 0.03);
      orbs.splice(i, 1);
    }
  }

  for (let i = slashes.length - 1; i >= 0; i -= 1) {
    const s = slashes[i];
    s.r += (s.max - s.r) * 0.24;
    s.life -= 0.08;
    if (s.life <= 0) slashes.splice(i, 1);
  }

  player.swing = Math.max(0, player.swing - dt / 230);
  if (player.hp <= 0) endGame();
  updateUi();
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
  state.shake *= 0.86;
}

function drawFloor() {
  ctx.save();
  for (const bit of floorBits) {
    ctx.globalAlpha = bit.a;
    ctx.fillStyle = color.white;
    ctx.beginPath();
    ctx.arc(bit.x, bit.y, bit.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible / 80) % 2 === 0) return;
  const speed = Math.hypot(player.vx, player.vy);
  const moving = speed > 0.22;
  player.walk += moving ? 0.16 + Math.min(0.18, speed * 0.02) : 0.04;
  const run = Math.min(1, speed / 4.5);
  const breathe = Math.sin(player.walk * 0.7) * (moving ? 0.6 : 1.5);
  const bob = moving ? Math.sin(player.walk * 2) * 2.6 : breathe;
  const legSwing = Math.sin(player.walk * 2.2) * (moving ? 9 : 2);
  const armSwing = Math.sin(player.walk * 2.2) * (moving ? 0.55 : 0.18);
  const swing = Math.sin(player.swing * Math.PI);
  const recoil = swing * 4;
  const bodyLean = run * 0.18 + swing * 0.12;

  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.rotate(player.visualFacing);
  ctx.translate(-recoil, 0);
  ctx.rotate(bodyLean);
  ctx.shadowColor = player.hurt > 0 ? color.white : color.gold;
  ctx.shadowBlur = 22;

  // Sword and attack pose.
  ctx.save();
  ctx.rotate(-0.65 - swing * 1.45);
  ctx.strokeStyle = "#fff6ca";
  ctx.lineWidth = 5 + swing * 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(9, -5);
  ctx.lineTo(35 + swing * 10, -19 - swing * 8);
  ctx.stroke();
  ctx.strokeStyle = color.magic;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, -9);
  ctx.lineTo(36 + swing * 8, -19 - swing * 7);
  ctx.stroke();
  ctx.restore();

  // Legs.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#4c2c18";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 13);
  ctx.lineTo(-9, 24 + legSwing * 0.45);
  ctx.moveTo(6, 13);
  ctx.lineTo(10, 24 - legSwing * 0.45);
  ctx.stroke();

  // Body armor.
  ctx.shadowBlur = 18;
  const gradient = ctx.createRadialGradient(-5, -8, 2, 0, 0, 23);
  gradient.addColorStop(0, player.hurt > 0 ? "#ffffff" : "#fff8dc");
  gradient.addColorStop(0.34, color.player);
  gradient.addColorStop(1, color.hit);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(-12 - run * 1.5, -12, 24 + run * 2, 29 - run * 1.5, 8);
  ctx.fill();

  // Head.
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#ffe0bd";
  ctx.beginPath();
  ctx.arc(1 + swing * 1.5, -23 - breathe * 0.25, 10, 0, Math.PI * 2);
  ctx.fill();

  // Hair.
  ctx.fillStyle = "#2b170e";
  ctx.beginPath();
  ctx.arc(-2 + swing * 1.5, -27 - breathe * 0.25, 9, Math.PI, Math.PI * 2);
  ctx.fill();

  // Arms.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffe0bd";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.lineTo(-18, 7 + armSwing * 8 + swing * 3);
  ctx.moveTo(10, -4);
  ctx.lineTo(18 + swing * 6, -10 - swing * 14);
  ctx.stroke();

  // Face direction marker.
  ctx.fillStyle = "#2b1209";
  ctx.beginPath();
  ctx.moveTo(10 + swing * 1.5, -23);
  ctx.lineTo(5 + swing * 1.5, -26);
  ctx.lineTo(5 + swing * 1.5, -20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMonster(m) {
  const hurtScale = m.hitFlash > 0 ? 1.12 : 1;
  const body = m.brute ? color.monster2 : color.monster;
  const hop = Math.sin(m.wobble * 1.8) * (m.brute ? 1.2 : 2.1);
  const squash = 1 + Math.sin(m.wobble * 1.8) * 0.045;
  ctx.save();
  ctx.translate(m.x, m.y + hop);
  ctx.scale(hurtScale * (1 + (squash - 1) * 0.5), hurtScale * (1 - (squash - 1)));
  ctx.shadowColor = m.brute ? color.monster2 : color.monster;
  ctx.shadowBlur = 18;

  // Feet.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(-7, m.r + 9, 8, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(8, m.r + 9, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body.
  ctx.fillStyle = m.hitFlash > 0 ? color.white : body;
  ctx.beginPath();
  ctx.roundRect(-m.r * 0.9, -m.r * 0.75, m.r * 1.8, m.r * 1.65, 10);
  ctx.fill();

  // Horns.
  ctx.fillStyle = color.gold;
  ctx.beginPath();
  ctx.moveTo(-m.r * 0.55, -m.r * 0.7);
  ctx.lineTo(-m.r * 0.9, -m.r * 1.15);
  ctx.lineTo(-m.r * 0.25, -m.r * 0.82);
  ctx.moveTo(m.r * 0.55, -m.r * 0.7);
  ctx.lineTo(m.r * 0.9, -m.r * 1.15);
  ctx.lineTo(m.r * 0.25, -m.r * 0.82);
  ctx.fill();

  // Eyes.
  ctx.fillStyle = "#160b1f";
  ctx.beginPath();
  ctx.arc(-m.r * 0.34, -m.r * 0.12, m.r * 0.14, 0, Math.PI * 2);
  ctx.arc(m.r * 0.34, -m.r * 0.12, m.r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Mouth.
  ctx.strokeStyle = "#160b1f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, m.r * 0.18, m.r * 0.3, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // Health bar.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-m.r, m.r + 6, m.r * 2, 4);
  ctx.fillStyle = color.good;
  ctx.fillRect(-m.r, m.r + 6, m.r * 2 * (m.hp / m.maxHp), 4);
  ctx.restore();
}

function drawOrb(o) {
  const r = o.r + Math.sin(o.pulse) * 2;
  const fill = o.heal ? color.good : color.gold;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.shadowColor = fill;
  ctx.shadowBlur = 20;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#140b08";
  ctx.font = "800 12px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(o.heal ? "+" : "$", 0, 1);
  ctx.restore();
}

function drawSlash(s) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, s.life);
  ctx.strokeStyle = color.magic;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.shadowColor = color.magic;
  ctx.shadowBlur = 22;
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  ctx.beginPath();
  ctx.arc(0, 0, s.r, -0.85, 0.85);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.fill;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, width, height);
  const shakeX = rand(-state.shake, state.shake);
  const shakeY = rand(-state.shake, state.shake);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawFloor();
  for (const o of orbs) drawOrb(o);
  for (const s of slashes) drawSlash(s);
  for (const m of monsters) drawMonster(m);
  drawPlayer();
  drawParticles();
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(34, now - state.lastTime || 16);
  state.lastTime = now;
  updateGame(dt);
  updateParticles();
  render();
  requestAnimationFrame(frame);
}

function setStick(dx, dy) {
  input.dx = dx;
  input.dy = dy;
  ui.stick.style.transform = `translate(calc(-50% + ${dx * 27}px), calc(-50% + ${dy * 27}px))`;
}

function updateStick(event) {
  const rect = ui.touchPad.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rawX = event.clientX - cx;
  const rawY = event.clientY - cy;
  const distance = Math.hypot(rawX, rawY);
  const limit = rect.width * 0.38;
  const scale = distance > limit ? limit / distance : 1;
  setStick((rawX * scale) / limit, (rawY * scale) / limit);
}

ui.touchPad.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  ui.touchPad.setPointerCapture(event.pointerId);
  input.active = true;
  input.id = event.pointerId;
  updateStick(event);
});

ui.touchPad.addEventListener("pointermove", (event) => {
  if (!input.active || input.id !== event.pointerId) return;
  event.preventDefault();
  updateStick(event);
});

function releaseStick(event) {
  if (input.id !== event.pointerId) return;
  input.active = false;
  input.id = null;
  setStick(0, 0);
}

ui.touchPad.addEventListener("pointerup", releaseStick);
ui.touchPad.addEventListener("pointercancel", releaseStick);

ui.attack.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  attack();
});

canvas.addEventListener("pointerdown", () => {
  if (!state.running) startGame();
});

ui.start.addEventListener("click", startGame);

ui.pause.addEventListener("click", () => {
  if (!state.running) return;
  state.paused = !state.paused;
  showToast(state.paused ? "已暂停" : "", state.paused);
  updateUi();
});

ui.reset.addEventListener("click", startGame);

ui.sound.addEventListener("click", async () => {
  state.soundOn = !state.soundOn;
  ui.sound.textContent = state.soundOn ? "♪" : "×";
  if (state.soundOn && audioContext?.state === "suspended") {
    await audioContext.resume();
  }
});

window.addEventListener("resize", resize);
resize();
updateUi();
requestAnimationFrame(frame);
