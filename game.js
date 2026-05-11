const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.querySelector("#score"),
  wave: document.querySelector("#wave"),
  monsters: document.querySelector("#monsters"),
  energy: document.querySelector("#energy"),
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
  skill: document.querySelector("#skillButton"),
};

const color = {
  player: "#f2c35d",
  robe: "#4d8f8a",
  gold: "#f2c35d",
  good: "#80e0a7",
  hit: "#d94f38",
  monster: "#7e7ac9",
  monster2: "#9b6b4a",
  fast: "#62d6b1",
  ranged: "#86d8ff",
  boss: "#e0b34f",
  magic: "#86d8ff",
  ink: "#2b1b10",
  white: "#fff9e8",
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
  energy: 0,
  spawning: 0,
  spawnTimer: 0,
  shake: 0,
  soundOn: true,
  lastTime: 0,
};

const monsters = [];
const orbs = [];
const slashes = [];
const bullets = [];
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
  ui.energy.textContent = `${Math.floor(state.energy)}%`;
  ui.skill.disabled = state.energy < 100 || !state.running || state.paused;
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

  let type = "grunt";
  if (state.wave % 3 === 0 && state.spawning === 0) {
    type = "boss";
  } else {
    const roll = Math.random();
    if (roll < Math.min(0.18 + state.wave * 0.012, 0.34)) type = "fast";
    else if (roll < Math.min(0.32 + state.wave * 0.016, 0.48)) type = "brute";
    else if (state.wave >= 2 && roll > 0.78) type = "ranged";
  }

  const brute = type === "brute";
  const boss = type === "boss";
  const fast = type === "fast";
  const ranged = type === "ranged";
  const baseHp = boss ? 8 + Math.floor(state.wave * 0.8) : brute ? 4 + Math.floor(state.wave / 5) : ranged ? 3 + Math.floor(state.wave / 7) : 1 + Math.floor(state.wave / 8);
  monsters.push({
    x,
    y,
    r: boss ? 32 : brute ? 22 : fast ? 13 : ranged ? 16 : 15,
    hp: baseHp,
    maxHp: baseHp,
    speed: boss ? 0.38 : brute ? rand(0.34, 0.56) : fast ? rand(0.9, 1.16) : ranged ? rand(0.45, 0.66) : rand(0.58, 0.86),
    wobble: rand(0, Math.PI * 2),
    hitFlash: 0,
    shootCd: ranged || boss ? rand(1300, 2000) : 0,
    type,
    brute,
    boss,
    fast,
    ranged,
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
  state.spawning = state.wave % 3 === 0 ? 3 + Math.floor(state.wave * 0.62) : 4 + Math.floor(state.wave * 0.92);
  state.spawnTimer = 0;
  ui.hint.textContent = state.wave % 3 === 0 ? `第 ${state.wave} 劫：妖王现身` : `第 ${state.wave} 劫`;
  showToast(state.wave % 3 === 0 ? `妖王现身：先斩小妖，再破妖王` : `第 ${state.wave} 劫来了`, true);
  setTimeout(() => showToast("", false), 900);
}

function startGame() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.wave = 1;
  state.energy = 0;
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
  bullets.length = 0;
  particles.length = 0;
  ui.start.textContent = "修行中";
  startWave();
  updateUi();
}

function endGame() {
  state.running = false;
  state.paused = false;
  ui.start.textContent = "再来";
  ui.hint.textContent = "气血耗尽";
  showToast(`渡劫失败：${Math.floor(state.score)} 功德，打到第 ${state.wave} 劫`, true);
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

  let blocked = 0;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    if (Math.hypot(b.x - player.x, b.y - player.y) <= range + 16) {
      blocked += 1;
      state.score += 12;
      state.energy = Math.min(100, state.energy + 4);
      burst(b.x, b.y, color.magic, 14, 3.8);
      bullets.splice(i, 1);
    }
  }
  if (blocked > 0) {
    state.shake = Math.max(state.shake, 5);
    tone(860, 0.07, "triangle", 0.032);
  }

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
        state.score += m.boss ? 480 : m.brute ? 110 : m.ranged ? 80 : m.fast ? 65 : 45;
        state.energy = Math.min(100, state.energy + (m.boss ? 42 : 18));
        burst(m.x, m.y, m.brute ? color.monster2 : color.monster, 34, 5.2);
        dropOrb(m.x, m.y);
        monsters.splice(i, 1);
        tone(760, 0.1, "sine", 0.034);
      }
    }
  }
  updateUi();
}

function castSkill() {
  if (!state.running || state.paused || state.energy < 100) return;
  state.energy = 0;
  state.shake = 18;
  slashes.push({
    x: player.x,
    y: player.y,
    r: 24,
    max: 150,
    life: 1,
    angle: player.facing,
    full: true,
  });
  burst(player.x, player.y, color.magic, 70, 7.2);
  tone(980, 0.18, "sine", 0.05);

  for (let i = monsters.length - 1; i >= 0; i -= 1) {
    const m = monsters[i];
    const distance = Math.hypot(m.x - player.x, m.y - player.y);
    if (distance <= 150 + m.r) {
      m.hp -= 3;
      m.hitFlash = 180;
      const angle = Math.atan2(m.y - player.y, m.x - player.x);
      m.x += Math.cos(angle) * 36;
      m.y += Math.sin(angle) * 36;
      burst(m.x, m.y, color.magic, 26, 6);
      if (m.hp <= 0) {
        state.score += m.boss ? 520 : m.brute ? 120 : m.ranged ? 90 : m.fast ? 70 : 50;
        dropOrb(m.x, m.y);
        monsters.splice(i, 1);
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    if (Math.hypot(bullets[i].x - player.x, bullets[i].y - player.y) <= 170) {
      burst(bullets[i].x, bullets[i].y, color.ranged, 8, 3);
      bullets.splice(i, 1);
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
    player.hp = Math.min(100, player.hp + 22);
    state.energy = Math.min(100, state.energy + 14);
    state.score += 120;
    startWave();
  }

  for (const m of monsters) {
    m.wobble += 0.06;
    const angle = Math.atan2(player.y - m.y, player.x - m.x);
    const distance = Math.hypot(player.x - m.x, player.y - m.y);
    const keepAway = m.ranged && distance < 135 ? -0.7 : 1;
    const speed = (m.speed + state.wave * 0.025) * (m.brute ? 0.92 : 1) * keepAway;
    m.x += Math.cos(angle) * speed + Math.cos(m.wobble) * (m.fast ? 0.38 : 0.18);
    m.y += Math.sin(angle) * speed + Math.sin(m.wobble) * (m.fast ? 0.38 : 0.18);
    m.hitFlash = Math.max(0, m.hitFlash - dt);
    m.shootCd = Math.max(0, m.shootCd - dt);

    if ((m.ranged || m.boss) && m.shootCd <= 0) {
      const bulletSpeed = m.boss ? 1.86 : 1.64;
      bullets.push({
        x: m.x,
        y: m.y,
        vx: Math.cos(angle) * bulletSpeed,
        vy: Math.sin(angle) * bulletSpeed,
        r: m.boss ? 8 : 6,
        life: 2800,
        boss: m.boss,
      });
      m.shootCd = m.boss ? 1600 : 1950;
      burst(m.x, m.y, color.ranged, 8, 2.8);
    }

    if (Math.hypot(m.x - player.x, m.y - player.y) < m.r + player.r) {
      if (player.invincible <= 0) {
        player.hp -= m.boss ? 12 : m.brute ? 10 : 7;
        player.invincible = 650;
        player.hurt = 1;
        state.shake = 12;
        burst(player.x, player.y, color.hit, 24, 4.8);
        tone(145, 0.12, "sawtooth", 0.04);
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life -= dt;
    if (Math.hypot(b.x - player.x, b.y - player.y) < b.r + player.r) {
      if (player.invincible <= 0) {
        player.hp -= b.boss ? 9 : 7;
        player.invincible = 520;
        player.hurt = 1;
        state.shake = 10;
        burst(player.x, player.y, color.ranged, 20, 4.2);
        tone(180, 0.1, "sawtooth", 0.035);
      }
      bullets.splice(i, 1);
      continue;
    }
    if (b.life <= 0 || b.x < -40 || b.x > width + 40 || b.y < -40 || b.y > height + 40) {
      bullets.splice(i, 1);
    }
  }

  for (let i = orbs.length - 1; i >= 0; i -= 1) {
    const o = orbs[i];
    o.pulse += 0.08;
    if (Math.hypot(o.x - player.x, o.y - player.y) < o.r + player.r + 6) {
      if (o.heal) {
        player.hp = Math.min(100, player.hp + 26);
        state.score += 20;
        burst(o.x, o.y, color.good, 22, 4);
      } else {
        state.score += 55;
        state.energy = Math.min(100, state.energy + 8);
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
  ctx.translate(width / 2, height * 0.48);
  ctx.strokeStyle = "rgba(242,195,93,0.14)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, 70 + i * 36, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(performance.now() * 0.00012);
  for (let i = 0; i < 8; i += 1) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -210);
    ctx.lineTo(0, -170);
    ctx.stroke();
    ctx.fillStyle = "rgba(242,195,93,0.12)";
    ctx.fillRect(-5, -196, 10, 18);
  }
  ctx.restore();

  ctx.save();
  for (const bit of floorBits) {
    ctx.globalAlpha = bit.a;
    ctx.fillStyle = color.gold;
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

  // Flying sword and attack pose.
  ctx.save();
  ctx.rotate(-0.65 - swing * 1.45);
  ctx.strokeStyle = "#f8fbff";
  ctx.lineWidth = 4 + swing * 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, -5);
  ctx.lineTo(39 + swing * 12, -20 - swing * 8);
  ctx.stroke();
  ctx.strokeStyle = color.magic;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, -9);
  ctx.lineTo(41 + swing * 9, -20 - swing * 7);
  ctx.stroke();
  ctx.restore();

  // Legs.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#2f4f48";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 13);
  ctx.lineTo(-9, 24 + legSwing * 0.45);
  ctx.moveTo(6, 13);
  ctx.lineTo(10, 24 - legSwing * 0.45);
  ctx.stroke();

  // Taoist robe.
  ctx.shadowBlur = 18;
  const gradient = ctx.createRadialGradient(-5, -8, 2, 0, 0, 23);
  gradient.addColorStop(0, player.hurt > 0 ? "#ffffff" : "#fff8dc");
  gradient.addColorStop(0.32, color.robe);
  gradient.addColorStop(1, "#1d554e");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(-12 - run * 1.5, -12, 24 + run * 2, 29 - run * 1.5, 8);
  ctx.fill();

  ctx.strokeStyle = color.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.lineTo(8, 14);
  ctx.moveTo(8, -6);
  ctx.lineTo(-8, 14);
  ctx.stroke();

  // Head.
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#ffe0bd";
  ctx.beginPath();
  ctx.arc(1 + swing * 1.5, -23 - breathe * 0.25, 10, 0, Math.PI * 2);
  ctx.fill();

  // Hair.
  ctx.fillStyle = "#22140c";
  ctx.beginPath();
  ctx.arc(-2 + swing * 1.5, -27 - breathe * 0.25, 9, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7 + swing * 1.5, -31 - breathe * 0.25);
  ctx.lineTo(7 + swing * 1.5, -31 - breathe * 0.25);
  ctx.stroke();

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
  const body = m.boss ? color.boss : m.ranged ? color.ranged : m.fast ? color.fast : m.brute ? color.monster2 : color.monster;
  const hop = Math.sin(m.wobble * 1.8) * (m.brute ? 1.2 : 2.1);
  const squash = 1 + Math.sin(m.wobble * 1.8) * 0.045;
  ctx.save();
  ctx.translate(m.x, m.y + hop);
  ctx.scale(hurtScale * (1 + (squash - 1) * 0.5), hurtScale * (1 - (squash - 1)));
  ctx.shadowColor = body;
  ctx.shadowBlur = 18;

  // Shadow and feet.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(-7, m.r + 9, 8, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(8, m.r + 9, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body.
  ctx.fillStyle = m.hitFlash > 0 ? color.white : body;
  ctx.beginPath();
  if (m.fast) {
    ctx.moveTo(0, -m.r * 1.05);
    ctx.bezierCurveTo(m.r, -m.r * 0.5, m.r * 0.82, m.r * 0.72, 0, m.r);
    ctx.bezierCurveTo(-m.r * 0.82, m.r * 0.72, -m.r, -m.r * 0.5, 0, -m.r * 1.05);
  } else if (m.ranged) {
    ctx.arc(0, 0, m.r * 0.95, 0, Math.PI * 2);
  } else if (m.boss) {
    ctx.roundRect(-m.r, -m.r * 0.9, m.r * 2, m.r * 1.9, 12);
  } else {
    ctx.roundRect(-m.r * 0.9, -m.r * 0.75, m.r * 1.8, m.r * 1.65, 10);
  }
  ctx.fill();

  // Horns or flame crown.
  ctx.fillStyle = m.boss ? color.hit : color.gold;
  ctx.beginPath();
  if (m.fast) {
    ctx.moveTo(0, -m.r * 1.2);
    ctx.lineTo(-m.r * 0.28, -m.r * 0.78);
    ctx.lineTo(m.r * 0.28, -m.r * 0.78);
  } else {
    ctx.moveTo(-m.r * 0.55, -m.r * 0.7);
    ctx.lineTo(-m.r * 0.9, -m.r * 1.15);
    ctx.lineTo(-m.r * 0.25, -m.r * 0.82);
    ctx.moveTo(m.r * 0.55, -m.r * 0.7);
    ctx.lineTo(m.r * 0.9, -m.r * 1.15);
    ctx.lineTo(m.r * 0.25, -m.r * 0.82);
  }
  ctx.fill();

  // Eyes.
  ctx.fillStyle = "#160b1f";
  ctx.beginPath();
  ctx.arc(-m.r * 0.34, -m.r * 0.12, m.r * 0.14, 0, Math.PI * 2);
  ctx.arc(m.r * 0.34, -m.r * 0.12, m.r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  if (m.ranged || m.boss) {
    ctx.strokeStyle = color.magic;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, m.r * 1.25, -0.45, 0.45);
    ctx.moveTo(-m.r * 0.55, m.r * 0.08);
    ctx.lineTo(-m.r * 1.15, m.r * 0.08);
    ctx.stroke();
  }

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
  ctx.lineWidth = s.full ? 10 : 7;
  ctx.lineCap = "round";
  ctx.shadowColor = color.magic;
  ctx.shadowBlur = s.full ? 34 : 22;
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  ctx.beginPath();
  ctx.arc(0, 0, s.r, s.full ? 0 : -0.85, s.full ? Math.PI * 2 : 0.85);
  ctx.stroke();
  ctx.restore();
}

function drawBullet(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.shadowColor = color.ranged;
  ctx.shadowBlur = b.boss ? 20 : 14;
  ctx.fillStyle = b.boss ? color.boss : color.ranged;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.arc(-b.r * 0.25, -b.r * 0.25, b.r * 0.28, 0, Math.PI * 2);
  ctx.fill();
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
  for (const b of bullets) drawBullet(b);
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

ui.skill.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  castSkill();
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
