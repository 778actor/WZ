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
  weaponShop: document.querySelector("#weaponShop"),
};

const color = {
  gold: "#f2c35d",
  good: "#80e0a7",
  hit: "#d94f38",
  monster: "#7e7ac9",
  brute: "#9b6b4a",
  fast: "#62d6b1",
  ranged: "#86d8ff",
  boss: "#e0b34f",
  magic: "#86d8ff",
  robe: "#4d8f8a",
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
  facing: -Math.PI / 2,
  visualFacing: -Math.PI / 2,
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
  ultimate: 0,
  ultimateTimer: 0,
  ultimateCd: 0,
  spawning: 0,
  spawnTimer: 0,
  autoAttackTimer: 0,
  autoAttackCd: 0,
  autoSkillCd: 0,
  autoDifficulty: 0,
  combo: 0,
  comboTimer: 0,
  chestCount: 0,
  rageTimer: 0,
  equippedWeapon: "moon",
  ownedWeapons: new Set(["moon"]),
  shake: 0,
  soundOn: true,
  lastTime: 0,
};

const monsters = [];
const bullets = [];
const orbs = [];
const slashes = [];
const ultimates = [];
const particles = [];
const floorBits = [];
const popups = [];
const keys = new Set();

const weapons = [
  {
    id: "moon",
    name: "月牙刃",
    cost: 0,
    damage: 1,
    range: 1,
    fill: "#f8fbff",
    glow: color.magic,
    label: "初始",
  },
  {
    id: "flame",
    name: "赤焰刀",
    cost: 900,
    damage: 1.6,
    range: 1.08,
    fill: "#fff2c2",
    glow: "#ff6b3a",
    label: "900",
  },
  {
    id: "thunder",
    name: "雷鸣戟",
    cost: 2200,
    damage: 2.35,
    range: 1.18,
    fill: "#f7fbff",
    glow: "#b388ff",
    label: "2200",
  },
  {
    id: "star",
    name: "星陨镰",
    cost: 5200,
    damage: 3.4,
    range: 1.32,
    fill: "#fff8d8",
    glow: "#79ffc8",
    label: "5200",
  },
];

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

function tone(frequency, duration, type = "sine", gainValue = 0.032) {
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

function popup(x, y, text, fill = color.gold, size = 14) {
  popups.push({ x, y, text, fill, size, life: 1, vy: -0.55 });
}

function addScore(amount, x, y, label = "") {
  const comboBonus = state.combo >= 8 ? Math.floor(amount * Math.min(1.2, state.combo * 0.035)) : 0;
  const total = amount + comboBonus;
  state.score += total;
  popup(x, y, `${label}+${total}`, comboBonus > 0 ? color.magic : color.gold, comboBonus > 0 ? 16 : 14);
}

function gainUltimate(amount) {
  state.ultimate = Math.min(100, state.ultimate + amount);
}

function addKillCombo(x, y) {
  state.combo += 1;
  state.comboTimer = 1800;
  if ([8, 16, 32, 64].includes(state.combo)) {
    state.rageTimer = Math.max(state.rageTimer, 2600);
    showToast(`${state.combo} 连斩：剑气暴涨`, true);
    popup(x, y - 18, `${state.combo} 连斩`, color.magic, 18);
    tone(980 + state.combo * 6, 0.1, "triangle", 0.038);
  }
}

function defeatMonster(m, index, score) {
  addKillCombo(m.x, m.y);
  addScore(score, m.x, m.y);
  state.energy = Math.min(100, state.energy + (m.boss ? 42 : 18));
  gainUltimate(m.boss ? 18 : 5 + Math.min(9, state.combo * 0.18));
  burst(m.x, m.y, m.brute ? color.brute : color.monster, m.boss ? 55 : 34, m.boss ? 6.6 : 5.2);
  dropOrb(m.x, m.y, m.boss || state.combo % 12 === 0);
  if (m.boss || Math.random() < 0.05 + Math.min(0.12, state.wave * 0.006)) dropChest(m.x, m.y);
  monsters.splice(index, 1);
  tone(m.boss ? 920 : 760, 0.1, "sine", 0.034);
}

function updateUi() {
  ui.score.textContent = Math.floor(state.score);
  ui.wave.textContent = state.wave;
  ui.monsters.textContent = monsters.length + state.spawning;
  ui.energy.textContent = state.ultimate >= 100 ? "大招!" : `${Math.floor(state.energy)}%`;
  if (state.autoAttackTimer > 0) {
    ui.hint.textContent = `御剑加速 ${Math.ceil(state.autoAttackTimer / 1000)} 秒，妖潮压迫提升`;
  }
  ui.hpText.textContent = `${Math.max(0, Math.round(player.hp))}%`;
  ui.hpFill.style.width = `${Math.max(0, Math.min(100, player.hp))}%`;
  ui.pause.textContent = state.paused ? "继续" : "暂停";
  updateWeaponShop();
}

function swordScale() {
  return 1.18 + Math.min(0.82, (state.wave - 1) * 0.055);
}

function currentWeapon() {
  return weapons.find((weapon) => weapon.id === state.equippedWeapon) || weapons[0];
}

function weaponDamage(multiplier = 1) {
  return currentWeapon().damage * multiplier;
}

function weaponRange() {
  return currentWeapon().range;
}

function updateWeaponShop() {
  for (const button of ui.weaponShop.querySelectorAll("button")) {
    const weapon = weapons.find((item) => item.id === button.dataset.weapon);
    if (!weapon) continue;
    const owned = state.ownedWeapons.has(weapon.id);
    const active = state.equippedWeapon === weapon.id;
    button.classList.toggle("active", active);
    button.classList.toggle("locked", !owned);
    button.disabled = !owned && state.score < weapon.cost;
    button.querySelector("b").textContent = owned ? (active ? "已装备" : `伤害x${weapon.damage}`) : `${weapon.cost}功德`;
  }
}

function setupWeaponShop() {
  ui.weaponShop.innerHTML = "";
  for (const weapon of weapons) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.weapon = weapon.id;
    button.innerHTML = `<span>${weapon.name}</span><b>${weapon.label}</b>`;
    button.addEventListener("click", () => buyOrEquipWeapon(weapon.id));
    ui.weaponShop.append(button);
  }
}

function buyOrEquipWeapon(id) {
  const weapon = weapons.find((item) => item.id === id);
  if (!weapon) return;
  if (!state.ownedWeapons.has(id)) {
    if (state.score < weapon.cost) {
      showToast("功德不足，先去斩妖", true);
      setTimeout(() => showToast("", false), 900);
      return;
    }
    state.score -= weapon.cost;
    state.ownedWeapons.add(id);
    popup(player.x, player.y - 36, `兑换${weapon.name}`, weapon.glow, 17);
    burst(player.x, player.y, weapon.glow, 42, 5);
  }
  state.equippedWeapon = id;
  showToast(`已装备：${weapon.name}`, true);
  setTimeout(() => {
    if (state.running) showToast("", false);
  }, 900);
  updateUi();
}

function startGame() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.wave = 1;
  state.energy = 0;
  state.ultimate = 0;
  state.ultimateTimer = 0;
  state.ultimateCd = 0;
  state.autoAttackTimer = 0;
  state.autoAttackCd = 0;
  state.autoSkillCd = 0;
  state.autoDifficulty = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.chestCount = 0;
  state.rageTimer = 0;
  state.equippedWeapon = "moon";
  state.ownedWeapons = new Set(["moon"]);
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
  bullets.length = 0;
  orbs.length = 0;
  slashes.length = 0;
  ultimates.length = 0;
  particles.length = 0;
  ui.start.textContent = "修行中";
  startWave();
  updateUi();
}

function startWave() {
  const pressure = 1 + state.autoDifficulty;
  state.spawning =
    state.wave % 3 === 0
      ? Math.ceil((4 + state.wave * 0.82) * pressure)
      : Math.ceil((5 + state.wave * 1.16) * pressure);
  state.spawnTimer = 0;
  ui.hint.textContent = state.wave % 3 === 0 ? `第 ${state.wave} 劫：妖王现身` : `第 ${state.wave} 劫`;
  showToast(state.wave % 3 === 0 ? "妖王现身：先斩小妖，再破妖王" : `第 ${state.wave} 劫来了`, true);
  setTimeout(() => showToast("", false), 900);
}

function grantAutoAttackReward() {
  const bonusTime = 5200 + state.wave * 420;
  state.autoAttackTimer += bonusTime;
  state.autoDifficulty += 0.08;
  gainUltimate(16);
  showToast(`破劫奖励：御剑加速 ${Math.ceil(bonusTime / 1000)} 秒，妖潮增强`, true);
  burst(player.x, player.y, color.magic, 42, 5.6);
  tone(1040, 0.14, "sine", 0.045);
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
    if (roll < Math.min(0.22 + state.wave * 0.016, 0.42)) type = "fast";
    else if (roll < Math.min(0.4 + state.wave * 0.02, 0.58)) type = "brute";
    else if (state.wave >= 2 && roll > 0.68) type = "ranged";
  }

  const boss = type === "boss";
  const brute = type === "brute";
  const fast = type === "fast";
  const ranged = type === "ranged";
  const baseHp = boss
    ? 10 + Math.floor(state.wave * 1.05)
    : brute
      ? 5 + Math.floor(state.wave / 4)
      : ranged
        ? 4 + Math.floor(state.wave / 6)
        : 1 + Math.floor(state.wave / 7);
  const hp = Math.ceil(baseHp * (1 + state.autoDifficulty * 0.32));

  monsters.push({
    x,
    y,
    r: boss ? 32 : brute ? 22 : fast ? 13 : ranged ? 16 : 15,
    hp,
    maxHp: hp,
    speed: boss ? 0.46 : brute ? rand(0.42, 0.66) : fast ? rand(1.08, 1.38) : ranged ? rand(0.54, 0.78) : rand(0.72, 1.02),
    wobble: rand(0, Math.PI * 2),
    hitFlash: 0,
    shootCd: ranged || boss ? rand(1300, 2000) : 0,
    type,
    boss,
    brute,
    fast,
    ranged,
  });
}

function dropOrb(x, y, force = false) {
  if (!force && Math.random() > 0.42) return;
  orbs.push({
    x,
    y,
    r: 8,
    heal: Math.random() < 0.35,
    chest: false,
    pulse: 0,
  });
}

function dropChest(x, y) {
  state.chestCount += 1;
  orbs.push({
    x,
    y,
    r: 12,
    heal: false,
    chest: true,
    pulse: 0,
  });
  popup(x, y - 20, "秘匣", color.magic, 18);
}

function collectChest(chest) {
  const roll = Math.random();
  if (roll < 0.34) {
    state.autoAttackTimer += 6500;
    popup(chest.x, chest.y, "御剑加速+6秒", color.magic, 16);
    showToast("秘匣：御剑加速延长", true);
  } else if (roll < 0.68) {
    state.energy = 100;
    gainUltimate(22);
    popup(chest.x, chest.y, "灵气全满", color.magic, 16);
    showToast("秘匣：剑阵已满", true);
  } else {
    player.hp = Math.min(100, player.hp + 38);
    addScore(240, chest.x, chest.y, "秘匣");
    popup(chest.x, chest.y, "回血+功德", color.good, 16);
    showToast("秘匣：气血恢复，功德暴涨", true);
  }
  state.shake = Math.max(state.shake, 10);
  burst(chest.x, chest.y, color.magic, 48, 6);
  tone(1120, 0.18, "sine", 0.045);
  setTimeout(() => {
    if (state.running) showToast("", false);
  }, 1100);
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
  const weapon = currentWeapon();
  player.attackCd = 300;
  player.swing = 1;
  const range = 112 * swordScale() * weaponRange();
  slashes.push({ x: player.x, y: player.y, r: 16, max: range, life: 1, angle: player.facing, glow: weapon.glow });
  burst(player.x, player.y, weapon.glow, 18, 3.8);
  tone(520, 0.08, "triangle", 0.034);

  let blocked = 0;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    if (Math.hypot(b.x - player.x, b.y - player.y) <= range + 16) {
      blocked += 1;
      addScore(12, b.x, b.y, "破弹");
      state.energy = Math.min(100, state.energy + 4);
      gainUltimate(2);
      burst(b.x, b.y, color.magic, 14, 3.8);
      bullets.splice(i, 1);
    }
  }
  if (blocked > 0) state.shake = Math.max(state.shake, 5);

  for (let i = monsters.length - 1; i >= 0; i -= 1) {
    const m = monsters[i];
    if (Math.hypot(m.x - player.x, m.y - player.y) <= range + m.r) {
      const angle = Math.atan2(m.y - player.y, m.x - player.x);
      m.x += Math.cos(angle) * 18;
      m.y += Math.sin(angle) * 18;
      m.hp -= weaponDamage();
      m.hitFlash = 120;
      burst(m.x, m.y, color.magic, 16, 4.4);
      if (m.hp <= 0) {
        defeatMonster(m, i, m.boss ? 480 : m.brute ? 110 : m.ranged ? 80 : m.fast ? 65 : 45);
      }
    }
  }
  updateUi();
}

function autoAttack(dt) {
  state.autoAttackTimer = Math.max(0, state.autoAttackTimer - dt);
  state.autoAttackCd = Math.max(0, state.autoAttackCd - dt);
  if (state.autoAttackCd > 0) return;

  const weapon = currentWeapon();
  const range = 138 * swordScale() * weaponRange();
  let targetIndex = -1;
  let bestDistance = range + 70;
  for (let i = 0; i < monsters.length; i += 1) {
    const m = monsters[i];
    const distance = Math.hypot(m.x - player.x, m.y - player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      targetIndex = i;
    }
  }
  if (targetIndex === -1) return;

  const m = monsters[targetIndex];
  const angle = Math.atan2(m.y - player.y, m.x - player.x);
  player.facing = angle;
  player.swing = Math.max(player.swing, 0.7);
  slashes.push({ x: player.x, y: player.y, r: 18, max: range, life: 1, angle, auto: true, glow: weapon.glow });
  burst(player.x, player.y, weapon.glow, 10, 3.4);
  tone(700, 0.06, "triangle", 0.026);

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    if (Math.hypot(b.x - player.x, b.y - player.y) <= range + 12) {
      addScore(8, b.x, b.y, "破弹");
      state.energy = Math.min(100, state.energy + 3);
      gainUltimate(1.5);
      burst(b.x, b.y, color.magic, 10, 3.2);
      bullets.splice(i, 1);
    }
  }

  m.hp -= weaponDamage(0.9);
  m.hitFlash = 120;
  m.x += Math.cos(angle) * 14;
  m.y += Math.sin(angle) * 14;
  burst(m.x, m.y, color.magic, 14, 4);
  if (m.hp <= 0) {
    defeatMonster(m, targetIndex, m.boss ? 480 : m.brute ? 110 : m.ranged ? 80 : m.fast ? 65 : 45);
  }
  const haste = state.autoAttackTimer > 0 ? 0.58 : 1;
  state.autoAttackCd = Math.max(190, (560 - state.wave * 10) * haste);
}

function autoCastSkill(dt) {
  state.autoSkillCd = Math.max(0, state.autoSkillCd - dt);
  state.ultimateCd = Math.max(0, state.ultimateCd - dt);
  if (state.ultimate >= 100 && state.ultimateCd <= 0 && monsters.length > 0) {
    castUltimate();
    return;
  }
  if (state.energy < 100 || state.autoSkillCd > 0 || monsters.length === 0) return;
  const dangerCount = monsters.filter((m) => Math.hypot(m.x - player.x, m.y - player.y) <= 230).length;
  const bulletDanger = bullets.some((b) => Math.hypot(b.x - player.x, b.y - player.y) <= 240);
  if (dangerCount >= 3 || bulletDanger || player.hp <= 42) {
    castSkill(true);
    state.autoSkillCd = 1800;
  }
}

function castSkill(auto = false) {
  if (!state.running || state.paused || state.energy < 100) return;
  const weapon = currentWeapon();
  state.energy = 0;
  state.shake = 18;
  slashes.push({
    x: player.x,
    y: player.y,
    r: 24,
    max: 195 * weaponRange(),
    life: 1,
    angle: player.facing,
    full: true,
    glow: weapon.glow,
  });
  burst(player.x, player.y, weapon.glow, 70, 7.2);
  tone(980, 0.18, "sine", 0.05);
  if (auto) {
    showToast("灵气满溢：自动释放剑阵", true);
    setTimeout(() => {
      if (state.running) showToast("", false);
    }, 800);
  }

  for (let i = monsters.length - 1; i >= 0; i -= 1) {
    const m = monsters[i];
    if (Math.hypot(m.x - player.x, m.y - player.y) <= 195 * weaponRange() + m.r) {
      m.hp -= weaponDamage(3);
      m.hitFlash = 180;
      const angle = Math.atan2(m.y - player.y, m.x - player.x);
      m.x += Math.cos(angle) * 36;
      m.y += Math.sin(angle) * 36;
      burst(m.x, m.y, color.magic, 26, 6);
      if (m.hp <= 0) {
        defeatMonster(m, i, m.boss ? 520 : m.brute ? 120 : m.ranged ? 90 : m.fast ? 70 : 50);
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    if (Math.hypot(bullets[i].x - player.x, bullets[i].y - player.y) <= 220) {
      burst(bullets[i].x, bullets[i].y, color.ranged, 8, 3);
      bullets.splice(i, 1);
    }
  }
  updateUi();
}

function castUltimate() {
  if (!state.running || state.paused || state.ultimate < 100) return;
  const weapon = currentWeapon();
  state.ultimate = 0;
  state.ultimateCd = 4500;
  state.ultimateTimer = 1800;
  state.shake = 34;
  showToast("大招：万剑归宗", true);
  popup(player.x, player.y - 48, "万剑归宗", weapon.glow, 24);
  burst(player.x, player.y, weapon.glow, 140, 10);
  tone(1280, 0.24, "sine", 0.06);

  for (let i = 0; i < 12; i += 1) {
    ultimates.push({
      x: player.x,
      y: player.y,
      angle: (Math.PI * 2 * i) / 12,
      life: 1,
      r: 40 + i * 8,
      glow: weapon.glow,
    });
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    burst(bullets[i].x, bullets[i].y, weapon.glow, 10, 4);
    bullets.splice(i, 1);
  }

  for (let i = monsters.length - 1; i >= 0; i -= 1) {
    const m = monsters[i];
    m.hp -= weaponDamage(m.boss ? 9 : 7);
    m.hitFlash = 260;
    const angle = Math.atan2(m.y - player.y, m.x - player.x);
    m.x += Math.cos(angle) * 58;
    m.y += Math.sin(angle) * 58;
    burst(m.x, m.y, weapon.glow, 34, 7);
    if (m.hp <= 0) {
      defeatMonster(m, i, m.boss ? 900 : m.brute ? 180 : m.ranged ? 150 : m.fast ? 120 : 100);
    }
  }

  setTimeout(() => {
    if (state.running) showToast("", false);
  }, 1200);
  updateUi();
}

function updateGame(dt) {
  if (!state.running || state.paused) return;
  movePlayer(dt);
  autoAttack(dt);
  autoCastSkill(dt);
  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) state.combo = 0;
  }
  state.rageTimer = Math.max(0, state.rageTimer - dt);
  state.ultimateTimer = Math.max(0, state.ultimateTimer - dt);

  if (state.spawning > 0) {
    state.spawnTimer += dt;
    if (state.spawnTimer >= Math.max(135, 560 - state.wave * 34 - state.autoDifficulty * 110)) {
      state.spawnTimer = 0;
      state.spawning -= 1;
      spawnMonster();
    }
  } else if (monsters.length === 0) {
    state.wave += 1;
    player.hp = Math.min(100, player.hp + 22);
    state.energy = Math.min(100, state.energy + 14);
    addScore(120, player.x, player.y - 30, "破劫");
    grantAutoAttackReward();
    if (state.wave % 5 === 0) {
      dropChest(player.x + rand(-28, 28), player.y - 44);
      state.energy = 100;
      gainUltimate(22);
      showToast(`第 ${state.wave} 劫大奖：秘匣降临，剑阵已满`, true);
    }
    startWave();
  }

  for (const m of monsters) {
    m.wobble += 0.06;
    const angle = Math.atan2(player.y - m.y, player.x - m.x);
    const distance = Math.hypot(player.x - m.x, player.y - m.y);
    const keepAway = m.ranged && distance < 135 ? -0.7 : 1;
    const speed = (m.speed + state.wave * 0.038 + state.autoDifficulty * 0.16) * (m.brute ? 0.95 : 1) * keepAway;
    m.x += Math.cos(angle) * speed + Math.cos(m.wobble) * (m.fast ? 0.38 : 0.18);
    m.y += Math.sin(angle) * speed + Math.sin(m.wobble) * (m.fast ? 0.38 : 0.18);
    m.hitFlash = Math.max(0, m.hitFlash - dt);
    m.shootCd = Math.max(0, m.shootCd - dt);
    if ((m.ranged || m.boss) && m.shootCd <= 0) {
      bullets.push({
        x: m.x,
        y: m.y,
        vx: Math.cos(angle) * (m.boss ? 2.16 : 1.88),
        vy: Math.sin(angle) * (m.boss ? 2.16 : 1.88),
        r: m.boss ? 8 : 6,
        life: 2800,
        boss: m.boss,
      });
      m.shootCd = m.boss ? 1320 : 1680;
      burst(m.x, m.y, color.ranged, 8, 2.8);
    }
    if (distance < m.r + player.r && player.invincible <= 0) {
      player.hp -= (m.boss ? 16 : m.brute ? 13 : 9) * (1 + state.autoDifficulty * 0.18);
      state.combo = 0;
      state.comboTimer = 0;
      player.invincible = 650;
      player.hurt = 1;
      state.shake = 12;
      burst(player.x, player.y, color.hit, 24, 4.8);
      tone(145, 0.12, "sawtooth", 0.04);
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life -= dt;
    if (Math.hypot(b.x - player.x, b.y - player.y) < b.r + player.r) {
      if (player.invincible <= 0) {
        player.hp -= (b.boss ? 12 : 9) * (1 + state.autoDifficulty * 0.16);
        state.combo = 0;
        state.comboTimer = 0;
        player.invincible = 520;
        player.hurt = 1;
        state.shake = 10;
        burst(player.x, player.y, color.ranged, 20, 4.2);
        tone(180, 0.1, "sawtooth", 0.035);
      }
      bullets.splice(i, 1);
    } else if (b.life <= 0 || b.x < -40 || b.x > width + 40 || b.y < -40 || b.y > height + 40) {
      bullets.splice(i, 1);
    }
  }

  for (let i = orbs.length - 1; i >= 0; i -= 1) {
    const o = orbs[i];
    o.pulse += 0.08;
    if (Math.hypot(o.x - player.x, o.y - player.y) < o.r + player.r + (o.chest ? 12 : 6)) {
      if (o.chest) {
        collectChest(o);
      } else if (o.heal) {
        player.hp = Math.min(100, player.hp + 26);
        addScore(20, o.x, o.y);
        burst(o.x, o.y, color.good, 22, 4);
      } else {
        addScore(55, o.x, o.y);
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
  for (let i = ultimates.length - 1; i >= 0; i -= 1) {
    const u = ultimates[i];
    u.r += 18;
    u.life -= 0.045;
    if (u.life <= 0) ultimates.splice(i, 1);
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
  for (let i = popups.length - 1; i >= 0; i -= 1) {
    const p = popups[i];
    p.y += p.vy;
    p.life -= 0.018;
    if (p.life <= 0) popups.splice(i, 1);
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
  const bob = moving ? Math.sin(player.walk * 2) * 2.6 : Math.sin(player.walk * 0.7) * 1.2;
  const legSwing = Math.sin(player.walk * 2.2) * (moving ? 9 : 2);
  const swing = Math.sin(player.swing * Math.PI);

  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.rotate(player.visualFacing);
  ctx.shadowColor = player.hurt > 0 ? color.white : color.gold;
  ctx.shadowBlur = 22;

  ctx.save();
  ctx.rotate(-0.65 - swing * 1.45);
  const weapon = currentWeapon();
  const bladeScale = swordScale();
  const grade = Math.max(0, weapons.findIndex((item) => item.id === weapon.id));
  const bladeLength = (48 + grade * 10 + swing * 18) * bladeScale;
  const bladeWidth = (16 + grade * 4 + swing * 5) * bladeScale;
  ctx.fillStyle = weapon.fill;
  ctx.shadowColor = weapon.glow;
  ctx.shadowBlur = 18 + grade * 7 + swing * 12;
  ctx.beginPath();
  ctx.moveTo(10, -5);
  ctx.quadraticCurveTo(18 + bladeLength * 0.45, -bladeWidth * (1.5 + grade * 0.12), 10 + bladeLength, -8 - bladeWidth * 0.3);
  ctx.quadraticCurveTo(17 + bladeLength * 0.52, 6 + bladeWidth * (0.75 + grade * 0.08), 10, -5);
  ctx.fill();
  ctx.strokeStyle = weapon.glow;
  ctx.lineWidth = Math.max(2, (2.2 + grade * 0.5) * bladeScale);
  ctx.beginPath();
  ctx.moveTo(18, -7);
  ctx.quadraticCurveTo(20 + bladeLength * 0.45, -bladeWidth * 0.78, 10 + bladeLength * 0.86, -8);
  ctx.stroke();
  if (grade >= 2) {
    ctx.globalAlpha = 0.86;
    ctx.beginPath();
    ctx.moveTo(18 + bladeLength * 0.2, 4);
    ctx.quadraticCurveTo(26 + bladeLength * 0.62, bladeWidth * 0.95, 10 + bladeLength * 1.04, -2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (grade >= 3) {
    ctx.fillStyle = weapon.glow;
    ctx.beginPath();
    ctx.arc(12 + bladeLength * 0.72, -bladeWidth * 0.38, 5 * bladeScale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = color.gold;
  ctx.beginPath();
  ctx.roundRect(0, -9, 15 * bladeScale, 8 * bladeScale, 4);
  ctx.fill();
  ctx.restore();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 92, 168, 0.72)";
  ctx.beginPath();
  ctx.moveTo(-18, -9);
  ctx.quadraticCurveTo(-29, 10, -17, 34);
  ctx.lineTo(0, 24);
  ctx.lineTo(17, 34);
  ctx.quadraticCurveTo(29, 10, 18, -9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 190, 225, 0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, -4);
  ctx.quadraticCurveTo(-20, 12, -12, 28);
  ctx.moveTo(13, -4);
  ctx.quadraticCurveTo(20, 12, 12, 28);
  ctx.stroke();

  ctx.strokeStyle = "#2f4f48";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 13);
  ctx.lineTo(-9, 24 + legSwing * 0.45);
  ctx.moveTo(6, 13);
  ctx.lineTo(10, 24 - legSwing * 0.45);
  ctx.stroke();

  const gradient = ctx.createRadialGradient(-5, -8, 2, 0, 0, 25);
  gradient.addColorStop(0, player.hurt > 0 ? "#ffffff" : "#fff4c7");
  gradient.addColorStop(0.28, color.gold);
  gradient.addColorStop(0.5, color.robe);
  gradient.addColorStop(1, "#122f2c");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(-14, -13, 28, 31, 8);
  ctx.fill();

  ctx.fillStyle = "#322115";
  ctx.beginPath();
  ctx.roundRect(-18, -9, 11, 16, 5);
  ctx.roundRect(7, -9, 11, 16, 5);
  ctx.fill();

  ctx.strokeStyle = color.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.lineTo(8, 14);
  ctx.moveTo(8, -6);
  ctx.lineTo(-8, 14);
  ctx.stroke();

  ctx.fillStyle = "#ffe0bd";
  ctx.beginPath();
  ctx.arc(1 + swing * 1.5, -24, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#22140c";
  ctx.beginPath();
  ctx.arc(-2 + swing * 1.5, -28, 10, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(43,18,9,0.82)";
  ctx.beginPath();
  ctx.roundRect(-7 + swing * 1.5, -26, 15, 7, 4);
  ctx.fill();
  ctx.fillStyle = color.magic;
  ctx.shadowColor = color.magic;
  ctx.shadowBlur = 8;
  ctx.fillRect(1 + swing * 1.5, -24, 7, 2);
  ctx.restore();

  if (state.rageTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(performance.now() * 0.018) * 0.08;
    ctx.strokeStyle = color.magic;
    ctx.lineWidth = 4;
    ctx.shadowColor = color.magic;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 46 + Math.sin(performance.now() * 0.012) * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMonster(m) {
  const body = m.boss ? color.boss : m.ranged ? color.ranged : m.fast ? color.fast : m.brute ? color.brute : color.monster;
  const hop = Math.sin(m.wobble * 1.8) * (m.brute ? 1.2 : 2.1);
  ctx.save();
  ctx.translate(m.x, m.y + hop);
  ctx.shadowColor = body;
  ctx.shadowBlur = 18;
  ctx.fillStyle = m.hitFlash > 0 ? color.white : body;
  ctx.beginPath();
  if (m.fast) {
    ctx.moveTo(0, -m.r * 1.05);
    ctx.bezierCurveTo(m.r, -m.r * 0.5, m.r * 0.82, m.r * 0.72, 0, m.r);
    ctx.bezierCurveTo(-m.r * 0.82, m.r * 0.72, -m.r, -m.r * 0.5, 0, -m.r * 1.05);
  } else if (m.ranged) {
    ctx.arc(0, 0, m.r * 0.95, 0, Math.PI * 2);
  } else {
    ctx.roundRect(-m.r * 0.9, -m.r * 0.75, m.r * 1.8, m.r * 1.65, 10);
  }
  ctx.fill();
  ctx.fillStyle = m.boss ? color.hit : color.gold;
  ctx.beginPath();
  ctx.moveTo(-m.r * 0.55, -m.r * 0.7);
  ctx.lineTo(-m.r * 0.9, -m.r * 1.15);
  ctx.lineTo(-m.r * 0.25, -m.r * 0.82);
  ctx.moveTo(m.r * 0.55, -m.r * 0.7);
  ctx.lineTo(m.r * 0.9, -m.r * 1.15);
  ctx.lineTo(m.r * 0.25, -m.r * 0.82);
  ctx.fill();
  ctx.fillStyle = "#160b1f";
  ctx.beginPath();
  ctx.arc(-m.r * 0.34, -m.r * 0.12, m.r * 0.14, 0, Math.PI * 2);
  ctx.arc(m.r * 0.34, -m.r * 0.12, m.r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-m.r, m.r + 6, m.r * 2, 4);
  ctx.fillStyle = color.good;
  ctx.fillRect(-m.r, m.r + 6, m.r * 2 * (m.hp / m.maxHp), 4);
  ctx.restore();
}

function drawOrb(o) {
  const r = o.r + Math.sin(o.pulse) * 2;
  const fill = o.chest ? color.magic : o.heal ? color.good : color.gold;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.shadowColor = fill;
  ctx.shadowBlur = 20;
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (o.chest) {
    ctx.roundRect(-r, -r * 0.72, r * 2, r * 1.44, 5);
    ctx.fill();
    ctx.strokeStyle = color.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color.gold;
    ctx.fillRect(-r * 0.18, -r * 0.72, r * 0.36, r * 1.44);
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#140b08";
  ctx.font = "800 12px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(o.chest ? "秘" : o.heal ? "+" : "$", 0, 1);
  ctx.restore();
}

function drawSlash(s) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, s.life);
  const glow = s.glow || color.magic;
  ctx.strokeStyle = glow;
  ctx.lineWidth = s.full ? 10 : s.auto ? 8 : 7;
  ctx.lineCap = "round";
  ctx.shadowColor = glow;
  ctx.shadowBlur = s.full ? 34 : 22;
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  ctx.beginPath();
  ctx.arc(0, 0, s.r, s.full ? 0 : -0.85, s.full ? Math.PI * 2 : 0.85);
  ctx.stroke();
  ctx.restore();
}

function drawUltimates() {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const u of ultimates) {
    ctx.globalAlpha = Math.max(0, u.life);
    ctx.strokeStyle = u.glow;
    ctx.lineWidth = 7 + u.life * 7;
    ctx.lineCap = "round";
    ctx.shadowColor = u.glow;
    ctx.shadowBlur = 28;
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(u.angle + performance.now() * 0.004);
    ctx.beginPath();
    ctx.moveTo(-u.r * 0.15, 0);
    ctx.lineTo(u.r, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, u.r * 0.48, -0.4, 0.4);
    ctx.stroke();
    ctx.restore();
  }
  if (state.ultimateTimer > 0) {
    ctx.globalAlpha = Math.min(0.35, state.ultimateTimer / 1800);
    ctx.fillStyle = currentWeapon().glow;
    ctx.fillRect(0, 0, width, height);
  }
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

function drawPopups() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of popups) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.fill;
    ctx.shadowColor = p.fill;
    ctx.shadowBlur = 14;
    ctx.font = `900 ${p.size}px Segoe UI, Microsoft YaHei, sans-serif`;
    ctx.fillText(p.text, p.x, p.y);
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
  drawUltimates();
  for (const b of bullets) drawBullet(b);
  for (const m of monsters) drawMonster(m);
  drawPlayer();
  drawParticles();
  drawPopups();
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

function updateKeyboardMove() {
  if (input.active) return;
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const up = keys.has("ArrowUp") || keys.has("KeyW");
  const down = keys.has("ArrowDown") || keys.has("KeyS");
  let dx = Number(right) - Number(left);
  let dy = Number(down) - Number(up);
  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  }
  setStick(dx, dy);
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
  updateKeyboardMove();
}

ui.touchPad.addEventListener("pointerup", releaseStick);
ui.touchPad.addEventListener("pointercancel", releaseStick);
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
  if (state.soundOn && audioContext?.state === "suspended") await audioContext.resume();
});

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  if (!event.repeat && event.code === "Enter" && !state.running) startGame();
  if (!event.repeat && event.code === "KeyR") startGame();
  if (!event.repeat && event.code === "KeyP" && state.running) {
    state.paused = !state.paused;
    showToast(state.paused ? "已暂停" : "", state.paused);
    updateUi();
  }
  keys.add(event.code);
  updateKeyboardMove();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  updateKeyboardMove();
});

window.addEventListener("resize", resize);
resize();
setupWeaponShop();
updateUi();
showToast("一只手移动即可；普通攻击和剑阵都会自动触发", true);
requestAnimationFrame(frame);
