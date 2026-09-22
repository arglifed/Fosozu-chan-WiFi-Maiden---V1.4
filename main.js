const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('scoreVal'), livesEl = document.getElementById('livesVal'), bombsEl = document.getElementById('bombsVal');
const powerEl = document.getElementById('powerVal');
const summaryBox = document.getElementById('summary-box'), continueUI = document.getElementById('continue-ui'), dialogueBox = document.getElementById('dialogue-box'), warningBorder = document.getElementById('warning-border');
const fpsCounterEl = document.getElementById('fpsCounter'), hpFill = document.getElementById('hp-bar-fill'), bossNameEl = document.getElementById('bossName'), resetOverlay = document.getElementById('reset-overlay'), resetText = document.getElementById('reset-text'), iterText = document.getElementById('iter-text'), ngValEl = document.getElementById('ngVal');

const SUPABASE_URL = 'https://hzmkoqtciabaqcfkwmeg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OE_63zUsDgyisFTY0zQHDA_9H3-ToId';
let isDevMode = localStorage.getItem('fosozu_devMode') === 'true';
let gameCleared = localStorage.getItem('fosozu_gameCleared') === 'true';
let is2PMode = false;

let defaultKeyMap = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', shoot: 'z', bomb: 'x', focus: 'shift', start: 'enter' };
let keyMap = JSON.parse(localStorage.getItem('fosozu_keymap')) || defaultKeyMap;
let rebindingAction = null;

let inputMode = localStorage.getItem('fosozu_inputMode') || 'keyboard';
let inputModeP2 = localStorage.getItem('fosozu_inputModeP2') || 'gamepad';
let defaultGamepadMap = { up: 'B12', down: 'B13', left: 'B14', right: 'B15', shoot: 'B0', bomb: 'B1', focus: 'B2', start: 'B9' };
let gamepadMap = JSON.parse(localStorage.getItem('fosozu_gamepadmap')) || defaultGamepadMap;
// Migration step for old numeric mappings
for (let key in gamepadMap) {
    if (typeof gamepadMap[key] === 'number') gamepadMap[key] = 'B' + gamepadMap[key];
}
let rebindingGamepadAction = null;
let rebindingActionP2 = null;
let rebindingGamepadActionP2 = null;

let defaultKeyMapP2 = { up: 'w', down: 's', left: 'a', right: 'd', shoot: 'c', bomb: 'v', focus: 'f', start: 't' };
let keyMapP2 = JSON.parse(localStorage.getItem('fosozu_keymapP2')) || defaultKeyMapP2;

let defaultGamepadMapP2 = { up: 'B12', down: 'B13', left: 'B14', right: 'B15', shoot: 'B0', bomb: 'B1', focus: 'B2', start: 'B9' };
let gamepadMapP2 = JSON.parse(localStorage.getItem('fosozu_gamepadmapP2')) || defaultGamepadMapP2;
for (let key in gamepadMapP2) {
    if (typeof gamepadMapP2[key] === 'number') gamepadMapP2[key] = 'B' + gamepadMapP2[key];
}
function formatGamepadBinding(binding) {
    if (typeof binding === 'number') return 'BTN ' + binding;
    if (!binding) return 'NONE';
    if (binding.startsWith('B')) return 'BTN ' + binding.substring(1);
    if (binding.startsWith('A')) {
        let parts = binding.substring(1).split('_');
        return 'AXIS ' + parts[0] + (parts[1] === '-1' ? '-' : '+');
    }
    return binding;
}

function updateUIPrompts() {
    const isGP = inputMode === 'gamepad';
    const shootBtn = isGP ? formatGamepadBinding(gamepadMap.shoot) : keyMap.shoot.toUpperCase();
    const bombBtn = isGP ? formatGamepadBinding(gamepadMap.bomb) : keyMap.bomb.toUpperCase();
    const continueBtn = isGP ? formatGamepadBinding(gamepadMap.start) : keyMap.start.toUpperCase();

    const pCont = document.getElementById('prompt-continue');
    if (pCont) pCont.innerText = `[${continueBtn}]`;
    const pDiag = document.getElementById('prompt-dialogue');
    if (pDiag) pDiag.innerText = `-- PRESS ${shootBtn} TO CONTINUE --`;
    const pSumm = document.getElementById('prompt-summary');
    if (pSumm) pSumm.innerText = `-- PRESS ${shootBtn} TO SYNC --`;
}

async function fetchLeaderboard() {
    try {
        let res1P = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard?select=*&order=score.desc&limit=10`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });
        if (res1P.ok) {
            let data = await res1P.json();
            let listEl = document.getElementById('leaderboard-list');
            listEl.innerHTML = '';
            data.forEach(entry => {
                let li = document.createElement('li');
                li.innerText = `${entry.name} - ${entry.score.toLocaleString()} (W${entry.wave})`;
                listEl.appendChild(li);
            });
        }

        let res2P = await fetch(`${SUPABASE_URL}/rest/v1/coop_leaderboard?select=*&order=score.desc&limit=10`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });
        if (res2P.ok) {
            let data = await res2P.json();
            let listEl2p = document.getElementById('leaderboard-list-coop');
            if (listEl2p) {
                listEl2p.innerHTML = '';
                data.forEach(entry => {
                    let li = document.createElement('li');
                    li.innerText = `${entry.name} - ${entry.score.toLocaleString()} (W${entry.wave})`;
                    listEl2p.appendChild(li);
                });
            }
        }
    } catch (e) {
        console.warn("Leaderboard fetch failed", e);
        document.getElementById('leaderboard-list').innerHTML = '<li>OFFLINE</li>';
        let listEl2p = document.getElementById('leaderboard-list-coop');
        if (listEl2p) listEl2p.innerHTML = '<li>OFFLINE</li>';
    }
}

async function submitScore(name, score, wave) {
    if (isDevMode) { console.log("Dev mode active: Score blocked."); return; }
    try {
        let endpoint = is2PMode ? 'coop_leaderboard' : 'leaderboard';
        await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
            body: JSON.stringify({ name: name.toUpperCase(), score: score, wave: wave })
        });
        fetchLeaderboard();
    } catch (e) {
        console.warn("Leaderboard submit failed", e);
    }
}

// Call on startup
fetchLeaderboard();

canvas.width = 600; canvas.height = 800;

const assets = {
    player: { img: new Image(), src: 'fosozu.png', loaded: false },
    pink: { img: new Image(), src: 'pink_girl.png', loaded: false },
    blue: { img: new Image(), src: 'blue_girl.png', loaded: false },
    green: { img: new Image(), src: 'green_girl.png', loaded: false },
    purple: { img: new Image(), src: 'crow.png', loaded: false },
    amber: { img: new Image(), src: 'lief.png', loaded: false },
    crimson: { img: new Image(), src: 'satsuki.png', loaded: false },
    bowl: { img: new Image(), src: 'bowl.png', loaded: false }
};
let assetsLoaded = 0;
const totalAssets = Object.keys(assets).length;

Object.values(assets).forEach(a => {
    a.img.onload = () => { a.loaded = true; assetsLoaded++; };
    a.img.onerror = () => { a.loaded = false; assetsLoaded++; };
    a.img.src = a.src;
});

let sessionHiScore = parseInt(localStorage.getItem('fosozu_hiScore')) || 0;

let score = 0, graze = 0, lives = 3, bombs = 3, power = 0, gameOver = false, gameStarted = false, isPaused = false;
let bossMode = false, boss = null, difficultyWave = 1, scoreAtLastBoss = 0, continueUsed = false;
let waveClearTimer = 0, bombEffectTimer = 0, invulnTimer = 0, shakeTimer = 0, stallingTimer = 0, continueCountdown = 0;
let satsukiSummonTimer = 0; // 10-second tension delay before Satsuki spawns
let slowMoTimer = 0, flashTimer = 0, grazeStreak = 0, streakTimer = 0, hasShield = false, waveGraze = 0, dialogueIndex = 0, resetAnimTimer = 0, linkIteration = 1, shieldBrokenInWave = false;

// WAVE-BASED MECHANICS
let stageTimer = 0;

const waveTimelines = {
    1: [ // 3600 frames (60s) — gentle intro, formations every ~20-30s
        { time: 0,    type: 'WALL',        spawned: false },
        { time: 300,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 300,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 750,  type: 'CIRCLE',      spawned: false },
        { time: 1050, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 1350, type: 'WALL',        spawned: false },
        { time: 1650, type: 'V_SHAPE',     spawned: false },
        { time: 1950, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 2400, type: 'DIVER_SWOOP', spawned: false },
        { time: 3000, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3000, type: 'SWEEP_RIGHT', spawned: false }
    ],
    2: [ // 4500 frames (75s) — steady escalation, formations every ~18-20s
        { time: 0,    type: 'SLOW_CIRCLE', spawned: false },
        { time: 240,  type: 'V_SHAPE',     spawned: false },
        { time: 600,  type: 'WALL',        spawned: false },
        { time: 900,  type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 900,  type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 1200, type: 'SHIELD_WALL', spawned: false },
        { time: 1500, type: 'DIVER_SWOOP', spawned: false },
        { time: 1800, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1800, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2200, type: 'CIRCLE',      spawned: false },
        { time: 2600, type: 'V_SHAPE',     spawned: false },
        { time: 3000, type: 'SHIELD_WALL', spawned: false },
        { time: 3400, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3400, type: 'SWEEP_RIGHT', spawned: false },
        { time: 3900, type: 'SLOW_CIRCLE', spawned: false }
    ],
    3: [ // 4500 frames (75s) — PingKo at 30s, return action 10s after he flees
        { time: 0,    type: 'SHIELD_WALL',     spawned: false },
        { time: 200,  type: 'V_SHAPE',         spawned: false },
        { time: 500,  type: 'WALL',            spawned: false },
        { time: 800,  type: 'DIVER_SWOOP',     spawned: false },
        { time: 1100, type: 'CIRCLE',          spawned: false },
        { time: 1400, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 1400, type: 'FLANK_RIGHT',     y: 350, spawned: false },
        { time: 1800, type: 'MID_BOSS_PINGKO', spawned: false },
        // PingKo flees after ~900 frames; 600-frame gap (10s) then action resumes
        { time: 2400, type: 'DIVER_SWOOP',     spawned: false },
        { time: 2800, type: 'WALL',            spawned: false },
        { time: 3200, type: 'FLANK_LEFT',      y: 300, spawned: false },
        { time: 3200, type: 'FLANK_RIGHT',     y: 300, spawned: false },
        { time: 3700, type: 'SWEEP_LEFT',      spawned: false },
        { time: 3700, type: 'SWEEP_RIGHT',     spawned: false }
    ],
    4: [ // 5400 frames (90s) — sustained pressure, one overlapping pair every ~14s
        { time: 0,    type: 'SHIELD_WALL', spawned: false },
        { time: 200,  type: 'DIVER_SWOOP', spawned: false },
        { time: 350,  type: 'DIVER_SWOOP', spawned: false },
        { time: 600,  type: 'CIRCLE',      spawned: false },
        { time: 600,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 900,  type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 900,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 1150, type: 'WALL',        spawned: false },
        { time: 1350, type: 'V_SHAPE',     spawned: false },
        { time: 1600, type: 'DIVER_SWOOP', spawned: false },
        { time: 1850, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1850, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2100, type: 'SHIELD_WALL', spawned: false },
        { time: 2350, type: 'CIRCLE',      spawned: false },
        { time: 2600, type: 'DIVER_SWOOP', spawned: false },
        { time: 2600, type: 'DIVER_SWOOP', spawned: false },
        { time: 2900, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 2900, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 3200, type: 'WALL',        spawned: false },
        { time: 3500, type: 'V_SHAPE',     spawned: false },
        { time: 3800, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3800, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4200, type: 'SHIELD_WALL', spawned: false },
        { time: 4700, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4700, type: 'DIVER_SWOOP', spawned: false }
    ],
    5: [ // 5400 frames (90s) — highly aggressive throughout
        { time: 0,    type: 'SWEEP_LEFT',  spawned: false },
        { time: 0,    type: 'SWEEP_RIGHT', spawned: false },
        { time: 200,  type: 'DIVER_SWOOP', spawned: false },
        { time: 350,  type: 'DIVER_SWOOP', spawned: false },
        { time: 500,  type: 'DIVER_SWOOP', spawned: false },
        { time: 700,  type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 700,  type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 950,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 950,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 1150, type: 'V_SHAPE',     spawned: false },
        { time: 1350, type: 'DIVER_SWOOP', spawned: false },
        { time: 1350, type: 'DIVER_SWOOP', spawned: false },
        { time: 1600, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 1600, type: 'FLANK_RIGHT', y: 200, spawned: false },
        { time: 1900, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1900, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2150, type: 'DIVER_SWOOP', spawned: false },
        { time: 2350, type: 'DIVER_SWOOP', spawned: false },
        { time: 2550, type: 'V_SHAPE',     spawned: false },
        { time: 2800, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 2800, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 3100, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3100, type: 'SWEEP_RIGHT', spawned: false },
        { time: 3350, type: 'DIVER_SWOOP', spawned: false },
        { time: 3350, type: 'DIVER_SWOOP', spawned: false },
        { time: 3600, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 3600, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 3900, type: 'DIVER_SWOOP', spawned: false },
        { time: 4100, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4100, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4400, type: 'V_SHAPE',     spawned: false },
        { time: 4800, type: 'DIVER_SWOOP', spawned: false },
        { time: 4800, type: 'DIVER_SWOOP', spawned: false }
    ],
    6: [ // 6300 frames (105s) — Satsuki prelude, slow oppressive layered spam
        { time: 0,    type: 'SHIELD_WALL', spawned: false },
        { time: 0,    type: 'SHIELD_WALL', spawned: false },
        { time: 250,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 500,  type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 500,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 750,  type: 'SHIELD_WALL', spawned: false },
        { time: 1000, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1000, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1250, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 1250, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 1500, type: 'SHIELD_WALL', spawned: false },
        { time: 1800, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2100, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 2100, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 2400, type: 'SHIELD_WALL', spawned: false },
        { time: 2700, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2700, type: 'SLOW_CIRCLE', spawned: false },
        { time: 3000, type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 3000, type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 3300, type: 'SHIELD_WALL', spawned: false },
        { time: 3600, type: 'SLOW_CIRCLE', spawned: false },
        { time: 3900, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 3900, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 4200, type: 'SHIELD_WALL', spawned: false },
        { time: 4200, type: 'SHIELD_WALL', spawned: false },
        { time: 4500, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4500, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4800, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 4800, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 5100, type: 'SHIELD_WALL', spawned: false },
        { time: 5400, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5700, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 5700, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 6000, type: 'SHIELD_WALL', spawned: false }
    ]
};

function resetTimelines() {
    for (let wave in waveTimelines) {
        waveTimelines[wave].forEach(event => event.spawned = false);
    }
}

const WAVE_DURATIONS = { 1: 3600, 2: 4500, 3: 4500, 4: 5400, 5: 5400, 6: 6300 };
let bombsSpawnedInWave = 0;
let comboChain = 0, comboTimer = 0;
let flankerWarning = { timer: 0, side: null, y: 0 };
const COMBO_MAX_TIME = 120;

const keys = {}, bullets = [], bossBullets = [], enemyBullets = [], enemies = [], bombItems = [], powerItems = [], lifeItems = [], medals = [], effects = [], bowlSteam = [];
const activeEMPs = [];
const EMP_MAX_RADIUS = 600 * 1.5; // canvas.width * 1.5
const stars = Array.from({ length: 80 }, () => ({ x: Math.random() * 600, y: Math.random() * 800, size: Math.random() * 2, speed: Math.random() * 2 + 1 }));
const player = { x: 300, y: 700, speed: 4.5, focusSpeed: 2.5, hitboxSize: 4, grazeSize: 25, satellites: [{ x: 300, y: 700 }, { x: 300, y: 700 }, { x: 300, y: 700 }, { x: 300, y: 700 }] };
const player2 = { x: 350, y: 700, speed: 5.3, focusSpeed: 3.0, hitboxSize: 4, grazeSize: 25, satellites: [{ x: 350, y: 700 }, { x: 350, y: 700 }, { x: 350, y: 700 }, { x: 350, y: 700 }], image: new Image() };
player2.image.src = 'pink_girl.png';

let audio = new AudioManager();



let gamepadState = { up: false, down: false, left: false, right: false, shoot: false, bomb: false, focus: false, start: false, select: false };
let prevGamepadState = Object.assign({}, gamepadState);
let gamepadState2 = { up: false, down: false, left: false, right: false, shoot: false, bomb: false, focus: false, start: false, select: false };
let prevGamepadState2 = Object.assign({}, gamepadState2);

function getGamepadInput(gp, binding) {
    if (!binding) return false;
    if (typeof binding === 'number') return gp.buttons[binding] && gp.buttons[binding].pressed;
    if (binding.startsWith('B')) {
        let idx = parseInt(binding.substring(1));
        return gp.buttons[idx] && gp.buttons[idx].pressed;
    } else if (binding.startsWith('A')) {
        let parts = binding.substring(1).split('_');
        let idx = parseInt(parts[0]);
        let dir = parseInt(parts[1]);
        if (dir === -1) return gp.axes[idx] < -0.3;
        else return gp.axes[idx] > 0.3;
    }
    return false;
}

function pollGamepad() {
    prevGamepadState = Object.assign({}, gamepadState);
    prevGamepadState2 = Object.assign({}, gamepadState2);
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    
    let gp1 = null, gp2 = null;
    let gpCount = 0;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            if (gpCount === 0) { gp1 = gamepads[i]; gpCount++; }
            else if (gpCount === 1) { gp2 = gamepads[i]; break; }
        }
    }

    if (gp1) {
        gamepadState.left = getGamepadInput(gp1, gamepadMap.left) || gp1.axes[0] < -0.3;
        gamepadState.right = getGamepadInput(gp1, gamepadMap.right) || gp1.axes[0] > 0.3;
        gamepadState.up = getGamepadInput(gp1, gamepadMap.up) || gp1.axes[1] < -0.3;
        gamepadState.down = getGamepadInput(gp1, gamepadMap.down) || gp1.axes[1] > 0.3;
        gamepadState.shoot = getGamepadInput(gp1, gamepadMap.shoot);
        gamepadState.bomb = getGamepadInput(gp1, gamepadMap.bomb);
        gamepadState.focus = getGamepadInput(gp1, gamepadMap.focus);
        gamepadState.start = getGamepadInput(gp1, gamepadMap.start);
        gamepadState.select = gp1.buttons[8] && gp1.buttons[8].pressed;
    } else {
        gamepadState = { up: false, down: false, left: false, right: false, shoot: false, bomb: false, focus: false, start: false, select: false };
    }
    
    if (gp2) {
        gamepadState2.left = getGamepadInput(gp2, gamepadMapP2.left) || gp2.axes[0] < -0.3;
        gamepadState2.right = getGamepadInput(gp2, gamepadMapP2.right) || gp2.axes[0] > 0.3;
        gamepadState2.up = getGamepadInput(gp2, gamepadMapP2.up) || gp2.axes[1] < -0.3;
        gamepadState2.down = getGamepadInput(gp2, gamepadMapP2.down) || gp2.axes[1] > 0.3;
        gamepadState2.shoot = getGamepadInput(gp2, gamepadMapP2.shoot);
        gamepadState2.bomb = getGamepadInput(gp2, gamepadMapP2.bomb);
        gamepadState2.focus = getGamepadInput(gp2, gamepadMapP2.focus);
        gamepadState2.start = getGamepadInput(gp2, gamepadMapP2.start);
        gamepadState2.select = gp2.buttons[8] && gp2.buttons[8].pressed;
    } else {
        gamepadState2 = { up: false, down: false, left: false, right: false, shoot: false, bomb: false, focus: false, start: false, select: false };
    }
}

function pollGamepadRebind() {
    if (!rebindingGamepadAction && !rebindingGamepadActionP2) return;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    let pressedBinding = null;
    for (let i = 0; i < gamepads.length; i++) {
        let gp = gamepads[i];
        if (gp) {
            for (let j = 0; j < gp.buttons.length; j++) {
                if (gp.buttons[j].pressed) {
                    pressedBinding = 'B' + j;
                    break;
                }
            }
            if (!pressedBinding) {
                for (let j = 0; j < gp.axes.length; j++) {
                    if (gp.axes[j] < -0.5) { pressedBinding = 'A' + j + '_-1'; break; }
                    if (gp.axes[j] > 0.5) { pressedBinding = 'A' + j + '_1'; break; }
                }
            }
            if (pressedBinding) break;
        }
    }

    if (pressedBinding) {
        if (rebindingGamepadAction) {
            gamepadMap[rebindingGamepadAction] = pressedBinding;
            localStorage.setItem('fosozu_gamepadmap', JSON.stringify(gamepadMap));
            let btn = document.querySelector(`.rebind-gp-btn[data-action="${rebindingGamepadAction}"]`);
            btn.innerText = formatGamepadBinding(pressedBinding);
            btn.classList.remove('listening');
            rebindingGamepadAction = null;
        } else if (rebindingGamepadActionP2) {
            gamepadMapP2[rebindingGamepadActionP2] = pressedBinding;
            localStorage.setItem('fosozu_gamepadmapP2', JSON.stringify(gamepadMapP2));
            let btn = document.querySelector(`.rebind-gp-btn-p2[data-action="${rebindingGamepadActionP2}"]`);
            btn.innerText = formatGamepadBinding(pressedBinding);
            btn.classList.remove('listening');
            rebindingGamepadActionP2 = null;
        }
        updateUIPrompts();
        return;
    }
    requestAnimationFrame(pollGamepadRebind);
}

function handleGamepadButtons() {
    let p1Start = (inputMode === 'gamepad' && gamepadState.start && !prevGamepadState.start);
    let p2Start = (is2PMode && inputModeP2 === 'gamepad' && gamepadState2.start && !prevGamepadState2.start);

    if (p1Start || p2Start) {
        if (!gameStarted) {
            if (assetsLoaded === totalAssets) {
                if (document.getElementById('main-menu-ui').style.display === 'flex') {
                    document.getElementById('btn-start-game').click();
                } else {
                    if (audio) audio.resume();
                    gameStarted = true;
                    resetTimelines();
                }
            }
        } else if (continueCountdown > 0) {
            processContinue();
        } else if (!gameOver && dialogueBox.style.display !== 'block' && summaryBox.style.display !== 'block' && resetAnimTimer <= 0) {
            togglePauseMenu();
        }
    }

    if (gameStarted && !gameOver && !isPaused && ((gamepadState.bomb && !prevGamepadState.bomb) || (gamepadState2.bomb && !prevGamepadState2.bomb))) {
        const p2Bombed = is2PMode && gamepadState2.bomb && !prevGamepadState2.bomb && !(gamepadState.bomb && !prevGamepadState.bomb);
        useBomb(p2Bombed ? player2 : player, !p2Bombed);
    }

    let p1Shoot = (inputMode === 'gamepad' && gamepadState.shoot && !prevGamepadState.shoot);
    let p2Shoot = (is2PMode && inputModeP2 === 'gamepad' && gamepadState2.shoot && !prevGamepadState2.shoot);

    if (isPaused && (p1Shoot || p2Shoot)) {
        if (summaryBox.style.display === 'block') closeSummary();
        else if (dialogueBox.style.display === 'block') progressDialogue();
    }

    if (gamepadState.select && !prevGamepadState.select) {
        toggleFullscreen();
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.body.requestFullscreen().catch(err => { console.log(`Error attempting to enable fullscreen: ${err.message}`); });
    } else {
        document.exitFullscreen();
    }
}

let titleMusicStarted = false;
function startTitleMusic() {
    if (titleMusicStarted || !audio) return;
    titleMusicStarted = true;
    audio.resume();
    let titleTrack = (gameCleared || isDevMode) ? 'alt_title' : 'title';
    audio.playBGM(titleTrack);
}
document.addEventListener('click', startTitleMusic, {once: true});
document.addEventListener('keydown', startTitleMusic, {once: true});
document.addEventListener('gamepadconnected', startTitleMusic, {once: true});

// UI Menu Logic
function startGameCommon() {
    if (audio) {
        audio.resume();
        audio.fadeTransition('stage1');
    }
    const menu = document.getElementById('main-menu-ui');
    menu.classList.add('menu-dismiss');
    setTimeout(() => {
        menu.style.display = 'none';
        menu.classList.remove('menu-dismiss');
    }, 1500);
}

document.getElementById('btn-start-game').addEventListener('click', () => {
    is2PMode = false;
    startGameCommon();
});

document.getElementById('btn-start-2p').addEventListener('click', () => {
    is2PMode = true;
    player.x = 250; player.y = 700;
    player2.x = 350; player2.y = 700;
    startGameCommon();
});

document.getElementById('btn-settings').addEventListener('click', () => {
    updateSettingsUI();
    document.getElementById('settings-ui').style.display = 'block';
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
    document.getElementById('settings-ui').style.display = 'none';
});

function togglePauseMenu() {
    isPaused = !isPaused;
    document.getElementById('pause-ui').style.display = isPaused ? 'block' : 'none';
}

document.getElementById('btn-resume-game').addEventListener('click', () => {
    isPaused = false;
    document.getElementById('pause-ui').style.display = 'none';
});

// Audio Volume Sliders
const volMaster = document.getElementById('vol-master');
const volBgm = document.getElementById('vol-bgm');
const volSe = document.getElementById('vol-se');
const valMaster = document.getElementById('val-master');
const valBgm = document.getElementById('val-bgm');
const valSe = document.getElementById('val-se');

const volMasterP = document.getElementById('vol-master-p');
const volBgmP = document.getElementById('vol-bgm-p');
const volSeP = document.getElementById('vol-se-p');
const valMasterP = document.getElementById('val-master-p');
const valBgmP = document.getElementById('val-bgm-p');
const valSeP = document.getElementById('val-se-p');

function updateAudioVolumes() {
    if (!audio) return;
    let m = parseFloat(volMaster.value);
    let b = parseFloat(volBgm.value);
    let s = parseFloat(volSe.value);
    
    volMasterP.value = m; volBgmP.value = b; volSeP.value = s;
    valMaster.innerText = Math.round(m * 100) + '%'; valBgm.innerText = Math.round(b * 100) + '%'; valSe.innerText = Math.round(s * 100) + '%';
    valMasterP.innerText = Math.round(m * 100) + '%'; valBgmP.innerText = Math.round(b * 100) + '%'; valSeP.innerText = Math.round(s * 100) + '%';
    
    audio.updateVolumes(m, b, s);
}

function updateAudioVolumesP() {
    if (!audio) return;
    let m = parseFloat(volMasterP.value);
    let b = parseFloat(volBgmP.value);
    let s = parseFloat(volSeP.value);
    
    volMaster.value = m; volBgm.value = b; volSe.value = s;
    valMaster.innerText = Math.round(m * 100) + '%'; valBgm.innerText = Math.round(b * 100) + '%'; valSe.innerText = Math.round(s * 100) + '%';
    valMasterP.innerText = Math.round(m * 100) + '%'; valBgmP.innerText = Math.round(b * 100) + '%'; valSeP.innerText = Math.round(s * 100) + '%';
    
    audio.updateVolumes(m, b, s);
}

[volMaster, volBgm, volSe].forEach(el => el.addEventListener('input', updateAudioVolumes));
[volMasterP, volBgmP, volSeP].forEach(el => el.addEventListener('input', updateAudioVolumesP));

volMaster.value = audio.masterVolume;
volBgm.value = audio.bgmVolume;
volSe.value = audio.seVolume;
volMasterP.value = audio.masterVolume;
volBgmP.value = audio.bgmVolume;
volSeP.value = audio.seVolume;
updateAudioVolumes();

const devToggle = document.getElementById('dev-mode-toggle');
devToggle.checked = isDevMode;

function update2PButton() {
    document.getElementById('btn-start-2p').style.display = (gameCleared || isDevMode) ? 'block' : 'none';
}
update2PButton();

devToggle.addEventListener('change', (e) => {
    isDevMode = e.target.checked;
    localStorage.setItem('fosozu_devMode', isDevMode);
    update2PButton();
    if (audio) {
        if (isDevMode || gameCleared) {
            audio.fadeTransition('alt_title');
        } else {
            audio.fadeTransition('title');
        }
    }
});


function updateSettingsUI() {
    if (inputMode === 'keyboard') {
        document.getElementById('p1-keyboard-bindings').style.display = 'block';
        document.getElementById('p1-gamepad-bindings').style.display = 'none';
    } else {
        document.getElementById('p1-keyboard-bindings').style.display = 'none';
        document.getElementById('p1-gamepad-bindings').style.display = 'block';
    }

    const p2ModeSelect = document.getElementById('input-mode-select-p2');
    if (p2ModeSelect) {
        if (inputModeP2 === 'keyboard') {
            document.getElementById('p2-keyboard-bindings').style.display = 'block';
            document.getElementById('p2-gamepad-bindings').style.display = 'none';
        } else {
            document.getElementById('p2-keyboard-bindings').style.display = 'none';
            document.getElementById('p2-gamepad-bindings').style.display = 'block';
        }
    }
}

const inputModeSelect = document.getElementById('input-mode-select');
if (inputModeSelect) {
    inputModeSelect.value = inputMode;
    inputModeSelect.addEventListener('change', (e) => {
        inputMode = e.target.value;
        localStorage.setItem('fosozu_inputMode', inputMode);
        updateSettingsUI();
        updateUIPrompts();
    });
}
const inputModeSelectP2 = document.getElementById('input-mode-select-p2');
if (inputModeSelectP2) {
    inputModeSelectP2.value = inputModeP2;
    inputModeSelectP2.addEventListener('change', (e) => {
        inputModeP2 = e.target.value;
        localStorage.setItem('fosozu_inputModeP2', inputModeP2);
        updateSettingsUI();
    });
}

document.querySelectorAll('.rebind-btn').forEach(btn => {
    const action = btn.getAttribute('data-action');
    btn.innerText = keyMap[action].toUpperCase();
    btn.addEventListener('click', (e) => {
        if (rebindingAction || rebindingGamepadAction || rebindingActionP2 || rebindingGamepadActionP2) return;
        rebindingAction = action;
        e.target.innerText = "PRESS KEY...";
        e.target.classList.add('listening');
    });
});

document.querySelectorAll('.rebind-gp-btn').forEach(btn => {
    const action = btn.getAttribute('data-action');
    btn.innerText = formatGamepadBinding(gamepadMap[action]);
    btn.addEventListener('click', (e) => {
        if (rebindingAction || rebindingGamepadAction || rebindingActionP2 || rebindingGamepadActionP2) return;
        rebindingGamepadAction = action;
        e.target.innerText = "PRESS BTN/DIR...";
        e.target.classList.add('listening');
        requestAnimationFrame(pollGamepadRebind);
    });
});

document.querySelectorAll('.rebind-btn-p2').forEach(btn => {
    const action = btn.getAttribute('data-action');
    btn.innerText = keyMapP2[action].toUpperCase();
    btn.addEventListener('click', (e) => {
        if (rebindingAction || rebindingGamepadAction || rebindingActionP2 || rebindingGamepadActionP2) return;
        rebindingActionP2 = action;
        e.target.innerText = "PRESS KEY...";
        e.target.classList.add('listening');
    });
});

document.querySelectorAll('.rebind-gp-btn-p2').forEach(btn => {
    const action = btn.getAttribute('data-action');
    btn.innerText = formatGamepadBinding(gamepadMapP2[action]);
    btn.addEventListener('click', (e) => {
        if (rebindingAction || rebindingGamepadAction || rebindingActionP2 || rebindingGamepadActionP2) return;
        rebindingGamepadActionP2 = action;
        e.target.innerText = "PRESS BTN/DIR...";
        e.target.classList.add('listening');
        requestAnimationFrame(pollGamepadRebind);
    });
});

updateUIPrompts();

window.addEventListener('keydown', e => {
    if (rebindingAction) {
        let key = e.key.toLowerCase();
        if (key === ' ') key = 'space'; // Normalize spacebar
        keyMap[rebindingAction] = key;
        localStorage.setItem('fosozu_keymap', JSON.stringify(keyMap));
        let btn = document.querySelector(`.rebind-btn[data-action="${rebindingAction}"]`);
        btn.innerText = key.toUpperCase();
        btn.classList.remove('listening');
        rebindingAction = null;
        updateUIPrompts();
        e.preventDefault();
        return;
    }

    if (rebindingActionP2) {
        let key = e.key.toLowerCase();
        if (key === ' ') key = 'space'; // Normalize spacebar
        keyMapP2[rebindingActionP2] = key;
        localStorage.setItem('fosozu_keymapP2', JSON.stringify(keyMapP2));
        let btn = document.querySelector(`.rebind-btn-p2[data-action="${rebindingActionP2}"]`);
        btn.innerText = key.toUpperCase();
        btn.classList.remove('listening');
        rebindingActionP2 = null;
        updateUIPrompts();
        e.preventDefault();
        return;
    }

    let k = e.key.toLowerCase();
    if (k === ' ') k = 'space';
    
    if (document.getElementById('submit-score-ui').style.display === 'block') {
        let isP1Up = (k === keyMap.up || e.code === 'ArrowUp');
        let isP2Up = (is2PMode && k === keyMapP2.up);
        let isP1Down = (k === keyMap.down || e.code === 'ArrowDown');
        let isP2Down = (is2PMode && k === keyMapP2.down);
        let isP1Shoot = (k === keyMap.shoot || e.code === 'Enter');
        let isP2Shoot = (is2PMode && k === keyMapP2.shoot);
        let isP1Bomb = (k === keyMap.bomb || e.code === 'Backspace');
        let isP2Bomb = (is2PMode && k === keyMapP2.bomb);

        if (isP1Up || isP2Up) handleArcadeInput('up');
        else if (isP1Down || isP2Down) handleArcadeInput('down');
        else if (!e.repeat) {
            if (isP1Shoot || isP2Shoot) handleArcadeInput('shoot');
            else if (isP1Bomb || isP2Bomb) handleArcadeInput('bomb');
        }
        e.preventDefault();
        return;
    }

    keys[e.code] = true; keys[k] = true;

    if (e.code === 'KeyF' || k === 'f') toggleFullscreen();

    // STAFF MODE:
    if (isDevMode) {
        if (k === '1') { linkIteration++; ngValEl.innerText = linkIteration; }
        if (k === '2') { bombs = 9; bombsEl.innerText = bombs; power = 64; powerEl.innerText = power; }
        if (k === '3') {
            if (boss) { boss.hp = 0; }
            else { stageTimer = WAVE_DURATIONS[difficultyWave] || 3600; enemies.length = 0; waveClearTimer = 0; }
        }
    }

    if (!gameStarted) {
        if (assetsLoaded < totalAssets) return;

        if (document.getElementById('main-menu-ui').style.display === 'flex') {
            if (k === keyMap.start) document.getElementById('btn-start-game').click();
            return;
        }
        
        if (document.getElementById('settings-ui').style.display === 'block') return;
        
        let p1Start = (inputMode === 'keyboard' && (k === 'space' || k === keyMap.start || k === keyMap.shoot));
        let p2Start = (is2PMode && inputModeP2 === 'keyboard' && (k === keyMapP2.start || k === keyMapP2.shoot));

        if (p1Start || p2Start) {
            if (audio) audio.resume();
            gameStarted = true;
            resetTimelines();
        }
    } else {
        let p1Pause = (inputMode === 'keyboard' && k === keyMap.start) || e.code === 'Escape';
        let p2Pause = (is2PMode && inputModeP2 === 'keyboard' && k === keyMapP2.start);
        if (p1Pause || p2Pause) {
            if (!gameOver && dialogueBox.style.display !== 'block' && summaryBox.style.display !== 'block' && continueCountdown <= 0 && resetAnimTimer <= 0) {
                togglePauseMenu();
            }
        }
    }

    let p1Shoot = (inputMode === 'keyboard' && k === keyMap.shoot);
    let p2Shoot = (is2PMode && inputModeP2 === 'keyboard' && k === keyMapP2.shoot);
    let p1Continue = (inputMode === 'keyboard' && k === keyMap.start);
    let p2Continue = (is2PMode && inputModeP2 === 'keyboard' && k === keyMapP2.start);

    if (isPaused) { 
        if (summaryBox.style.display === 'block' && (p1Shoot || p2Shoot)) closeSummary(); 
        else if (dialogueBox.style.display === 'block' && (p1Shoot || p2Shoot)) progressDialogue(); 
    }
    if (continueCountdown > 0 && (p1Continue || p2Continue)) processContinue();
    if (gameStarted && !gameOver && !isPaused && (k === keyMap.bomb || (is2PMode && k === keyMapP2.bomb))) useBomb(k === keyMapP2.bomb ? player2 : player, k !== keyMapP2.bomb);
});
window.addEventListener('keyup', e => { 
    let k = e.key.toLowerCase();
    if (k === ' ') k = 'space';
    keys[e.code] = false; keys[k] = false; 
});

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_".split('');
let initialIndices = [0, 0, 0];
let currentCursor = 0;

function updateArcadeNameEntry() {
    for (let i = 0; i < 3; i++) {
        const span = document.getElementById('char' + i);
        if (span) {
            span.innerText = CHARS[initialIndices[i]];
            if (i === currentCursor) span.classList.add('active-letter');
            else span.classList.remove('active-letter');
        }
    }
}

function finalizeScoreSubmission(name) {
    submitScore(name, score, difficultyWave);
    document.getElementById('submit-score-ui').style.display = 'none';
    continueCountdown = 10;
    continueUI.style.display = 'flex';
    document.getElementById('continue-timer').innerText = 10;
    if (audio) audio.pauseForContinue();
}

function handleArcadeInput(action) {
    if (action === 'up') {
        initialIndices[currentCursor] = (initialIndices[currentCursor] + 1) % CHARS.length;
        updateArcadeNameEntry();
        if (audio) audio.playGraze();
    } else if (action === 'down') {
        initialIndices[currentCursor] = (initialIndices[currentCursor] - 1 + CHARS.length) % CHARS.length;
        updateArcadeNameEntry();
        if (audio) audio.playGraze();
    } else if (action === 'shoot' || action === 'start') {
        currentCursor++;
        if (currentCursor >= 3) {
            let name = CHARS[initialIndices[0]] + CHARS[initialIndices[1]] + CHARS[initialIndices[2]];
            finalizeScoreSubmission(name);
        } else {
            updateArcadeNameEntry();
            if (audio) audio.playShoot();
        }
    } else if (action === 'bomb') {
        if (currentCursor > 0) {
            currentCursor--;
            updateArcadeNameEntry();
            if (audio) audio.playEnemyHit();
        }
    }
}

function updateHighScore() { if (score > sessionHiScore) { sessionHiScore = score; localStorage.setItem('fosozu_hiScore', sessionHiScore); } }
function startBossDialogue() { isPaused = true; dialogueIndex = 0; document.getElementById('dialogue-text').innerText = boss.intro[0]; dialogueBox.style.display = 'block'; }
function progressDialogue() { dialogueIndex++; if (dialogueIndex < boss.intro.length) { document.getElementById('dialogue-text').innerText = boss.intro[dialogueIndex]; } else { dialogueBox.style.display = 'none'; isPaused = false; } }

function useBomb(sourcePlayer, isP1 = true) {
    sourcePlayer = sourcePlayer || player;
    if (bombs > 0 && bombEffectTimer === 0) {
        bombs--; bombsEl.innerText = bombs; bombEffectTimer = 60; shakeTimer = 35;
        bossBullets.length = 0; enemyBullets.length = 0;

        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            if (e.isMidBoss) {
                e.hp -= 300;
            } else {
                score += 100;
                medals.push({ x: e.x, y: e.y });
                if (bombsSpawnedInWave < 1 && Math.random() < 0.05) {
                    bombItems.push({ x: e.x, y: e.y });
                    bombsSpawnedInWave++;
                }
                if (Math.random() < 0.45) powerItems.push({ x: e.x, y: e.y });
                enemies.splice(i, 1);
            }
        }
        scoreEl.innerText = score;

        // Bosses resist bomb damage (40% of normal) — takes 5-6 bombs to kill early bosses
        if (boss) boss.hp -= 300 * 0.4;
        if (audio) audio.playExplosion();

        // Spawn EMP shockwave originating from the bombing player
        const rgbBase = isP1 ? '170, 0, 255' : '255, 105, 180';
        const glowColor = isP1 ? '#aa00ff' : '#ff69b4';
        activeEMPs.push({
            x: sourcePlayer.x,
            y: sourcePlayer.y,
            radius: 0,
            opacity: 1.0,
            rgbBase,
            glowColor,
            isP1,
            arcaneAngle: 0  // for P2 spinning arcane rings
        });
    }
}

function closeSummary() { 
    summaryBox.style.display = 'none'; 
    isPaused = false; 
    waveGraze = 0; 
    scoreAtLastBoss = score; 
    shieldBrokenInWave = false; 
    updateHighScore(); 
    if (audio && difficultyWave <= 6) {
        audio.hardCut('stage' + difficultyWave);
    }
}
function processContinue() {
    updateHighScore();
    continueCountdown = 0;
    continueUsed = true;
    document.getElementById('submit-score-ui').style.display = 'none';
    continueUI.style.display = 'none';
    lives = 3; livesEl.innerText = lives;
    bombs = 3; bombsEl.innerText = bombs;
    power = 0; powerEl.innerText = power;
    score = 0; scoreEl.innerText = score;
    scoreAtLastBoss = 0;
    if (audio) {
        audio.resumeFromContinue();
    }
    invulnTimer = 180;
    
    // Always clear bullets so player doesn't spawn into danger
    bossBullets.length = 0;
    enemyBullets.length = 0;
    
    hasShield = false;
    grazeStreak = 0;
    shieldBrokenInWave = false;
    document.getElementById('shieldStat').style.display = 'none';
    document.getElementById('shieldStreak').innerText = 0;
    linkIteration = 1; ngValEl.innerText = 1;
    accumulator = 0;
    comboChain = 0; comboTimer = 0;

    // Wave 6 1CC Punishment
    if (difficultyWave >= 6) {
        stageTimer = 0;
        resetTimelines();
        enemies.length = 0;
        bombItems.length = 0;
        powerItems.length = 0;
        lifeItems.length = 0;
        bombsSpawnedInWave = 0;
        flankerWarning = { timer: 0, side: null, y: 0 };
        bossMode = false;
        boss = null;
        document.getElementById('boss-ui').style.display = 'none';
    }
}

function shoot(pObj) {
    if (audio) audio.playShoot();

    if (pObj === player2) {
        // --- PingKo's Trident Lasers ---
        // Color escalates from pink -> magenta based on power
        let tridentColor = power >= 32 ? '#cc00ff' : (power >= 16 ? '#e91e8c' : '#ff69b4');
        let tridentDmg = power >= 48 ? 1.8 : (power >= 32 ? 1.5 : (power >= 16 ? 1.2 : 1.0));

        if (hasShield) {
            // Shield: 5-beam spread trident
            bullets.push({ x: pObj.x,      y: pObj.y - 30, vx: 0,    vy: -22, w: 5, h: 28, damage: tridentDmg * 1.2, color: tridentColor, isP2Bullet: true });
            bullets.push({ x: pObj.x - 16, y: pObj.y - 20, vx: -0.8, vy: -22, w: 5, h: 28, damage: tridentDmg * 1.2, color: tridentColor, isP2Bullet: true });
            bullets.push({ x: pObj.x + 16, y: pObj.y - 20, vx:  0.8, vy: -22, w: 5, h: 28, damage: tridentDmg * 1.2, color: tridentColor, isP2Bullet: true });
            bullets.push({ x: pObj.x - 30, y: pObj.y - 10, vx: -1.6, vy: -21, w: 4, h: 20, damage: tridentDmg * 0.9, color: tridentColor, isP2Bullet: true });
            bullets.push({ x: pObj.x + 30, y: pObj.y - 10, vx:  1.6, vy: -21, w: 4, h: 20, damage: tridentDmg * 0.9, color: tridentColor, isP2Bullet: true });
        } else if (grazeStreak >= 5) {
            // Graze streak: powered trident
            bullets.push({ x: pObj.x,      y: pObj.y - 30, vx: 0,    vy: -22, w: 6, h: 24, damage: tridentDmg * 1.3, color: '#cc00ff', isP2Bullet: true });
            bullets.push({ x: pObj.x - 14, y: pObj.y - 20, vx: -0.7, vy: -21, w: 5, h: 22, damage: tridentDmg * 1.1, color: '#cc00ff', isP2Bullet: true });
            bullets.push({ x: pObj.x + 14, y: pObj.y - 20, vx:  0.7, vy: -21, w: 5, h: 22, damage: tridentDmg * 1.1, color: '#cc00ff', isP2Bullet: true });
        } else {
            // Base trident: tight 3-beam formation
            bullets.push({ x: pObj.x,      y: pObj.y - 30, vx: 0,    vy: -18, w: 5, h: 22, damage: tridentDmg, color: tridentColor, isP2Bullet: true });
            bullets.push({ x: pObj.x - 12, y: pObj.y - 20, vx: -0.6, vy: -17, w: 4, h: 18, damage: tridentDmg * 0.9, color: tridentColor, isP2Bullet: true });
            bullets.push({ x: pObj.x + 12, y: pObj.y - 20, vx:  0.6, vy: -17, w: 4, h: 18, damage: tridentDmg * 0.9, color: tridentColor, isP2Bullet: true });
        }

        // Homing Missiles (single-target, lock-on-spawn)
        let homingCount = Math.floor(power / 16);
        if (homingCount > 0) {
            // Find the best target once at spawn time
            let lockTarget = null;
            let minDist = Infinity;
            if (boss && boss.hp > 0) { lockTarget = boss; minDist = Math.hypot(boss.x - pObj.x, boss.y - pObj.y); }
            enemies.forEach(e => {
                // Only lock onto enemies fully inside the visible play area
                if (e.y < 30 || e.y > 800 || e.x < 0 || e.x > 600) return;
                let d = Math.hypot(e.x - pObj.x, e.y - pObj.y);
                if (d < minDist) { minDist = d; lockTarget = e; }
            });
            for (let i = 0; i < homingCount; i++) {
                let offset = (i - (homingCount - 1) / 2) * 10;
                bullets.push({ x: pObj.x + offset, y: pObj.y - 10, vx: (Math.random() - 0.5) * 3, vy: -10, w: 5, h: 5, damage: 0.5, isHoming: true, isP2Homing: true, lockedTarget: lockTarget, color: '#ff69b4' });
            }
        }

        // Satellite shots (pink)
        let activeCount = power >= 48 ? 4 : (power >= 32 ? 3 : (power >= 16 ? 2 : (power >= 8 ? 1 : 0)));
        for (let i = 0; i < activeCount; i++) {
            bullets.push({ x: pObj.satellites[i].x, y: pObj.satellites[i].y, vx: 0, vy: -20, w: 4, h: 18, damage: 0.8, color: tridentColor, isP2Bullet: true });
        }
        return;
    }

    // --- Fosozu (P1) shots ---
    if (hasShield) { bullets.push({ x: pObj.x, y: pObj.y - 30, vx: 0, vy: -18, w: 10, h: 40, damage: 2 }); bullets.push({ x: pObj.x - 15, y: pObj.y - 20, vx: -1.5, vy: -18, w: 10, h: 40, damage: 2 }); bullets.push({ x: pObj.x + 15, y: pObj.y - 20, vx: 1.5, vy: -18, w: 10, h: 40, damage: 2 }); }
    else if (grazeStreak >= 5) { bullets.push({ x: pObj.x, y: pObj.y - 30, vx: 0, vy: -20, w: 4, h: 15, damage: 1.2 }); bullets.push({ x: pObj.x - 12, y: pObj.y - 20, vx: -3, vy: -18, w: 6, h: 15, damage: 1.2 }); bullets.push({ x: pObj.x + 12, y: pObj.y - 20, vx: 3, vy: -18, w: 6, h: 15, damage: 1.2 }); }
    else { bullets.push({ x: pObj.x, y: pObj.y - 30, vx: 0, vy: -15, w: 4, h: 10, damage: 1 }); bullets.push({ x: pObj.x - 10, y: pObj.y - 20, vx: -2.5, vy: -14, w: 4, h: 10, damage: 1 }); bullets.push({ x: pObj.x + 10, y: pObj.y - 20, vx: 2.5, vy: -14, w: 4, h: 10, damage: 1 }); }

    // Homing Tracking Packets (aggressive re-acquire)
    let homingCount = Math.floor(power / 16);
    if (homingCount > 0) {
        for (let i = 0; i < homingCount; i++) {
            let offset = (i - (homingCount - 1) / 2) * 10;
            bullets.push({ x: pObj.x + offset, y: pObj.y - 10, vx: (Math.random() - 0.5) * 4, vy: -10, w: 6, h: 6, damage: 0.5, isHoming: true, color: '#ffca3a' });
        }
    }

    // Satellite Shots
    let activeCount = power >= 48 ? 4 : (power >= 32 ? 3 : (power >= 16 ? 2 : (power >= 8 ? 1 : 0)));
    for (let i = 0; i < activeCount; i++) {
        bullets.push({ x: pObj.satellites[i].x, y: pObj.satellites[i].y, vx: 0, vy: -20, w: 4, h: 15, damage: 0.8, color: '#00f2ff' });
    }
}

function updatePlayer(ts, pObj, gpState, kMap) {
    const isFocused = (kMap && keys[kMap.focus]) || (gpState && gpState.focus);
    let s_cur = isFocused ? pObj.focusSpeed : pObj.speed;
    if ((kMap && keys[kMap.up]) || (gpState && gpState.up)) pObj.y -= s_cur;
    if ((kMap && keys[kMap.down]) || (gpState && gpState.down)) pObj.y += s_cur;
    if ((kMap && keys[kMap.left]) || (gpState && gpState.left)) pObj.x -= s_cur;
    if ((kMap && keys[kMap.right]) || (gpState && gpState.right)) pObj.x += s_cur;

    // Satellites lerping
    let activeCount = power >= 48 ? 4 : (power >= 32 ? 3 : (power >= 16 ? 2 : (power >= 8 ? 1 : 0)));
    for (let i = 0; i < 4; i++) {
        let targetX = pObj.x, targetY = pObj.y;
        if (i < activeCount) {
            if (isFocused) {
                let offsets = activeCount === 1 ? [0] :
                    activeCount === 2 ? [-45, 45] :
                        activeCount === 3 ? [-60, 0, 60] :
                            [-60, -30, 30, 60];
                targetX = pObj.x + offsets[i];
                targetY = pObj.y + 10;
            } else {
                let angle = (Date.now() / 400) + (i * Math.PI * 2 / activeCount);
                targetX = pObj.x + Math.cos(angle) * 55;
                targetY = pObj.y + Math.sin(angle) * 15;
            }
        }
        pObj.satellites[i].x += (targetX - pObj.satellites[i].x) * 0.3 * ts;
        pObj.satellites[i].y += (targetY - pObj.satellites[i].y) * 0.3 * ts;
    }

    if ((kMap && keys[kMap.shoot]) || (gpState && gpState.shoot)) { if (Date.now() % 60 < 10) shoot(pObj); }

    const isOff = (pObj.x < 0 || pObj.x > 600 || pObj.y < 0 || pObj.y > 800);
    if (isOff) { stallingTimer++; warningBorder.style.display = 'block'; if (stallingTimer > 90) { shakeTimer = 40; pObj.x = 300; pObj.y = 600; stallingTimer = 0; score = Math.max(0, score - 500); scoreEl.innerText = score; } } else { stallingTimer = 0; document.getElementById('warning-border').style.display = 'none'; }
}

function updateProjectiles(ts) {
    bullets.forEach((b, i) => {
        if (b.isHoming) {
            if (b.isP2Homing) {
                // PingKo: single-target lock — only track if the locked target is still alive
                let target = b.lockedTarget;
                let targetAlive = target && (
                    (target === boss && boss && boss.hp > 0) ||
                    enemies.includes(target)
                );
                if (targetAlive) {
                    let targetAngle = Math.atan2(target.y - b.y, target.x - b.x);
                    let currentAngle = Math.atan2(b.vy, b.vx);
                    let diff = targetAngle - currentAngle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    let turnRate = 0.08 * ts;
                    let newAngle = currentAngle + Math.max(-turnRate, Math.min(turnRate, diff));
                    let speed = Math.hypot(b.vx, b.vy);
                    b.vx = Math.cos(newAngle) * speed;
                    b.vy = Math.sin(newAngle) * speed;
                }
                // If target is gone, bullet flies straight — no re-acquire
            } else {
                // Fosozu: aggressive re-acquire on nearest target
                let closest = null;
                let minDist = Infinity;
                if (boss && boss.hp > 0) {
                    let d = Math.hypot(boss.x - b.x, boss.y - b.y);
                    if (d < minDist) { minDist = d; closest = boss; }
                }
                enemies.forEach(e => {
                    // Only re-acquire enemies fully inside the visible play area
                    if (e.y < 30 || e.y > 800 || e.x < 0 || e.x > 600) return;
                    let d = Math.hypot(e.x - b.x, e.y - b.y);
                    if (d < minDist) { minDist = d; closest = e; }
                });
                if (closest) {
                    let targetAngle = Math.atan2(closest.y - b.y, closest.x - b.x);
                    let currentAngle = Math.atan2(b.vy, b.vx);
                    let diff = targetAngle - currentAngle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    let turnRate = 0.1 * ts;
                    let newAngle = currentAngle + Math.max(-turnRate, Math.min(turnRate, diff));
                    let speed = Math.hypot(b.vx, b.vy);
                    b.vx = Math.cos(newAngle) * speed;
                    b.vy = Math.sin(newAngle) * speed;
                }
            }
        }

        b.y += b.vy * ts;
        b.x += b.vx * ts;
        if (b.y < -50 || b.x < -50 || b.x > 650) bullets.splice(i, 1);
    });
    effects.forEach((eff, i) => { eff.r += 6; eff.opacity -= 0.05; if (eff.opacity <= 0) effects.splice(i, 1); });

    // Update EMP shockwaves
    for (let i = activeEMPs.length - 1; i >= 0; i--) {
        const emp = activeEMPs[i];
        emp.radius += 30;
        emp.arcaneAngle += 0.04; // spin the arcane rings (only used for P2)
        emp.opacity = Math.max(0, 1.0 - (emp.radius / EMP_MAX_RADIUS));
        if (emp.opacity <= 0) activeEMPs.splice(i, 1);
    }
    
    for (let i = bowlSteam.length - 1; i >= 0; i--) {
        let p = bowlSteam[i];
        p.y -= 2 * ts;
        p.life -= 0.03 * ts;
        if (p.life <= 0) bowlSteam.splice(i, 1);
    }
}

function playerTakeDamage() {
    if (invulnTimer > 0 || bombEffectTimer > 0) return;

    let powerLost = Math.min(power, 16);
    power = Math.max(0, power - 16); powerEl.innerText = power;

    for (let i = 0; i < powerLost; i++) {
        let angle = Math.random() * Math.PI * 2;
        let spd = Math.random() * 6 + 3;
        powerItems.push({ x: player.x, y: player.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 5, spawnTime: Date.now() });
    }

    if (hasShield) {
        hasShield = false; shieldBrokenInWave = true; invulnTimer = 60; shakeTimer = 20;
        document.getElementById('shieldStat').style.display = 'none'; grazeStreak = 0; document.getElementById('shieldStreak').innerText = 0;
        effects.push({ x: player.x, y: player.y, r: 40, opacity: 1 }); if (audio) audio.playShieldBreak();
    } else {
        let bombsLost = Math.max(0, bombs - 3);
        bombs = 3; bombsEl.innerText = bombs;
        for (let i = 0; i < bombsLost; i++) {
            let angle = Math.random() * Math.PI * 2;
            let spd = Math.random() * 5 + 4;
            bombItems.push({ x: player.x, y: player.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 6, spawnTime: Date.now() });
        }

        lives--; livesEl.innerText = lives;
        if (lives <= 0) {
            updateHighScore();
            if (audio) audio.pauseForContinue();
            if (isDevMode) {
                // Skip the prompt entirely in dev mode
                continueCountdown = 10;
                continueUI.style.display = 'flex';
                document.getElementById('continue-timer').innerText = 10;
            } else {
                // Pause the game state and show submit modal
                document.getElementById('submit-score-ui').style.display = 'block';
                initialIndices = [0, 0, 0];
                currentCursor = 0;
                updateArcadeNameEntry();
            }
        }
        else { invulnTimer = 120; shakeTimer = 25; if (audio) audio.playExplosion(); }
    }
}

function handleCollisions(ts) {
    const isFocused = (inputMode === 'keyboard' && keys[keyMap.focus]) || (inputMode === 'gamepad' && gamepadState.focus);
    [bossBullets, enemyBullets].forEach(arr => {
        for (let i = arr.length - 1; i >= 0; i--) {
            let b = arr[i]; b.x += b.vx * ts; b.y += b.vy * ts;
            let hit = false;
            let checkP = (pObj, pIsFoc) => {
                let d = Math.hypot(pObj.x - b.x, pObj.y - b.y);
                if (pIsFoc && !b.grazed && d < pObj.grazeSize && d > pObj.hitboxSize + 4 && invulnTimer === 0 && bombEffectTimer === 0) {
                    b.grazed = true; graze++; waveGraze++; score += 50; scoreEl.innerText = score; document.getElementById('grazeVal').innerText = graze; slowMoTimer = 15;
                    if (audio) audio.playGraze();
                    if (!hasShield) { grazeStreak++; streakTimer = 90; document.getElementById('shieldStreak').innerText = grazeStreak; if (grazeStreak >= 10) { hasShield = true; document.getElementById('shieldStat').style.display = 'inline'; } }
                }
                if (d < pObj.hitboxSize + 4 && invulnTimer === 0 && bombEffectTimer === 0) {
                    playerTakeDamage();
                    hit = true;
                }
            };
            checkP(player, isFocused);
            if (is2PMode) {
                let p2Foc = (inputModeP2 === 'keyboard' && keys[keyMapP2.focus]) || (inputModeP2 === 'gamepad' && gamepadState2.focus);
                checkP(player2, p2Foc);
            }

            if (b.y > 850 || b.y < -50 || b.x < -50 || b.x > 650 || hit) arr.splice(i, 1);
        }
    });

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        let hit = false;
        let d1 = Math.hypot(player.x - e.x, player.y - e.y);
        if (d1 < player.hitboxSize + 15 && invulnTimer === 0 && bombEffectTimer === 0) {
            playerTakeDamage();
            hit = true;
        }
        if (is2PMode && !hit) {
            let d2 = Math.hypot(player2.x - e.x, player2.y - e.y);
            if (d2 < player2.hitboxSize + 15 && invulnTimer === 0 && bombEffectTimer === 0) {
                playerTakeDamage();
                hit = true;
            }
        }
        if (hit) enemies.splice(i, 1);
    }

    if (boss && !boss.intangible) {
        if (Math.hypot(player.x - boss.x, player.y - boss.y) < player.hitboxSize + 50 && invulnTimer === 0 && bombEffectTimer === 0) {
            playerTakeDamage();
        }
        if (is2PMode && Math.hypot(player2.x - boss.x, player2.y - boss.y) < player2.hitboxSize + 50 && invulnTimer === 0 && bombEffectTimer === 0) {
            playerTakeDamage();
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            if (Math.hypot(bullets[i].x - boss.x, bullets[i].y - boss.y) < 65) {
                boss.hp -= (bullets[i].damage || 1);
                bullets.splice(i, 1);
                if (audio && Math.random() < 0.3) audio.playEnemyHit();
            }
        }

        if (!boss.phase2 && boss.hp <= boss.maxHP / 2 && boss.hp > 0) {
            boss.enterPhase2();
            if (audio) {
                audio.playBossPhaseChange();
                if (difficultyWave === 6) audio.hardCut('boss6_phase2');
            }
        }

        if (boss.hp <= 0) {
            score += 5000; difficultyWave++; waveClearTimer = 150; bossMode = false; stageTimer = 0; resetTimelines(); bombsSpawnedInWave = 0; flankerWarning = { timer: 0, side: null, y: 0 };
            if (audio) {
                audio.playExplosion();
                if (difficultyWave <= 6) {
                    audio.fadeTransition('stage' + difficultyWave);
                }
            }
            let b_name = boss.name;
            let b_defeat = boss.defeat;
            let isLastBoss = (boss.constructor === BossRoster[BossRoster.length - 1]);

            boss = null;
            document.getElementById('boss-ui').style.display = 'none';

            if (isLastBoss) {
                linkIteration++; ngValEl.innerText = linkIteration;
                iterText.innerText = "OVERCLOCKING TO ITERATION " + linkIteration + "...";
                resetAnimTimer = 120; shakeTimer = 120; flashTimer = 50;
            } else {
                isPaused = true; summaryBox.style.display = 'block';
            }

            if (difficultyWave === 7) { // Since we incremented difficultyWave on line 835
                gameCleared = true;
                localStorage.setItem('fosozu_gameCleared', 'true');
                update2PButton();
                if (audio) audio.fadeTransition('ending');
            }

            let bonusAmt = Math.floor(waveGraze * 1.5 * difficultyWave);
            let bonusMsg = `<p style="color:#ff006e; font-style:italic;">"${b_defeat}"</p><hr>WAVE ${difficultyWave - 1} COMPLETE<br>GRAZE BONUS: +${bonusAmt}`;
            if (!shieldBrokenInWave) { bonusMsg += `<br>FLAWLESS UPLINK: +25,000!`; score += 25000; }
            if (difficultyWave > 3 && !continueUsed) { bonusMsg += `<br>FULL BUFFER BONUS: +50,000!`; score += 50000; }
            document.getElementById('summary-content').innerHTML = bonusMsg; score += bonusAmt; scoreEl.innerText = score; return;
        }
    }
}

function updateBoss(ts) {
    if (boss) {
        let lastX = boss.x;
        boss.update(ts, player, bossBullets);
        boss.vx = boss.x - lastX;

        hpFill.style.width = Math.max(0, (boss.hp / boss.maxHP * 100)) + "%";
        hpFill.style.background = (boss.hp < boss.maxHP / 2) ? "#ffca3a" : "#ff006e";

        if (is2PMode && boss.type === 'pink') {
            if (Math.random() < 0.25 * ts) {
                bowlSteam.push({ x: boss.x + (Math.random() * 16 - 8), y: boss.y - 15, size: 2 + Math.random() * 5, life: 1.0 });
            }
        }
    }
    // Spawn Boss when wave timer concludes
    if (!bossMode && waveClearTimer <= 0 && stageTimer >= (WAVE_DURATIONS[difficultyWave] || 3600) && enemies.length === 0) {
        if (difficultyWave === 6) {
            // 10-second eerie silence before Satsuki — stage6 BGM keeps playing
            if (satsukiSummonTimer === 0) {
                satsukiSummonTimer = 600; // start the countdown once
            }
            satsukiSummonTimer -= ts;
            if (satsukiSummonTimer > 0) return; // wait out the tension gap
        }

        bossMode = true;
        satsukiSummonTimer = 0;
        document.getElementById('boss-ui').style.display = 'block';

        let tIdx = (difficultyWave - 1) % BossRoster.length;
        let BossClass = BossRoster[tIdx];
        boss = new BossClass(difficultyWave, linkIteration);
        
        // boss6 music is triggered inside MadameSatsuki constructor
        if (audio && difficultyWave !== 6) {
            audio.hardCut('boss' + difficultyWave);
        }

        bossNameEl.innerText = boss.name;
        // Satsuki triggers dialogue herself after summoning; others go straight to dialogue
        if (difficultyWave !== 6) {
            startBossDialogue();
        }
    }
}


function spawnFormation(type, spawnY) {
    let baseSpeed = (3.5 + (difficultyWave * 0.4)) * Math.min(3.5, 1 + (linkIteration - 1) * 0.05);
    
    let hp = 1, shootDelay = 500, speedMult = 1.0, repeatsShot = false;
    
    if (type === 'MID_BOSS_PINGKO') {
        hp = 150;
        shootDelay = 800; // Overridden by custom logic, but set baseline
        speedMult = 0; // Moves to fixed position
        repeatsShot = true;
    } else if (type === 'WALL' || type === 'CIRCLE' || type === 'SLOW_CIRCLE') {
        // Slow Fixture Archetype
        hp = 4;
        shootDelay = 800;
        speedMult = 0.3;
        repeatsShot = true;
    } else if (type === 'SHIELD_WALL') {
        hp = 8;
        shootDelay = 9999999;
        speedMult = 0.2;
        repeatsShot = false;
    } else {
        // Rushdown Archetype (V_SHAPE, SWEEP_LEFT, SWEEP_RIGHT, DIVER_SWOOP, FLANK_LEFT, FLANK_RIGHT)
        hp = 1;
        shootDelay = 500;
        speedMult = 1.3;
        if (type === 'DIVER_SWOOP' || type.startsWith('FLANK_')) speedMult = 1.5;
        repeatsShot = false;
    }
    
    let speed = baseSpeed * speedMult;

    if (type === 'MID_BOSS_PINGKO') {
        // PingKo drops down to y=150 and stays there.
        enemies.push({ x: 300, y: -50, vx: 0, vy: 2, speed: 0, type: 'midboss', nextShot: Date.now() + 2000, hp: hp, repeatsShot: true, isMidBoss: true, fleeTimer: 900, targetY: 150 });
    } else if (type === 'V_SHAPE') {
        const xs = [300, 240, 360, 180, 420, 120, 480];
        const ys = [-50, -100, -100, -150, -150, -200, -200];
        for (let i = 0; i < 7; i++) {
            enemies.push({ x: xs[i], y: ys[i], vx: 0, vy: speed, speed: speed, type: 'blue', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: repeatsShot });
        }
    } else if (type === 'SWEEP_LEFT') {
        for (let i = 0; i < 4; i++) {
            enemies.push({ x: 50 + i * 40, y: -50 - i * 40, vx: speed * 0.7, vy: speed, speed: speed, type: 'green', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: repeatsShot });
        }
    } else if (type === 'SWEEP_RIGHT') {
        for (let i = 0; i < 4; i++) {
            enemies.push({ x: 550 - i * 40, y: -50 - i * 40, vx: -speed * 0.7, vy: speed, speed: speed, type: 'green', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: repeatsShot });
        }
    } else if (type === 'CIRCLE' || type === 'SLOW_CIRCLE') {
        for (let i = 0; i < 8; i++) {
            let a = (i * Math.PI * 2) / 8;
            enemies.push({ x: 300 + Math.cos(a)*50, y: -100 + Math.sin(a)*50, vx: Math.cos(a) * 0.5, vy: speed + Math.sin(a) * 0.5, speed: speed, type: 'blue', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: repeatsShot });
        }
    } else if (type === 'WALL') {
        for (let i = 0; i < 7; i++) {
            enemies.push({ x: 90 + i * 70, y: -50, vx: 0, vy: speed, speed: speed, type: 'green', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: repeatsShot });
        }
    } else if (type === 'DIVER_SWOOP') {
        let dir = (Math.random() > 0.5) ? 1 : -1;
        for (let i = 0; i < 3; i++) {
            enemies.push({ x: 300 - (dir * 200) + (i * 60 * -dir), y: -50 - i * 40, vx: (speed * 0.7) * dir, vy: speed * 1.2, speed: speed * 1.2, type: 'green', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: repeatsShot, diverState: 'DOWN' });
        }
    } else if (type === 'FLANK_LEFT') {
        for (let i = 0; i < 2; i++) {
            enemies.push({ x: -50 - i * 50, y: spawnY + i * 30, vx: speed, vy: 0, speed: speed, type: 'pink', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: repeatsShot });
        }
    } else if (type === 'FLANK_RIGHT') {
        for (let i = 0; i < 2; i++) {
            enemies.push({ x: 650 + i * 50, y: spawnY + i * 30, vx: -speed, vy: 0, speed: speed, type: 'pink', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: repeatsShot });
        }
    } else if (type === 'SHIELD_WALL') {
        for (let i = 0; i < 3; i++) {
            enemies.push({ x: 150 + i * 150, y: -50, vx: 0, vy: speed, speed: speed, type: 'blue', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: repeatsShot });
        }
    }
}

function updateEnemies(ts) {
    if (!bossMode && waveClearTimer <= 0 && stageTimer < (WAVE_DURATIONS[difficultyWave] || 3600)) {
        let waveIndex = ((difficultyWave - 1) % 6) + 1;
        let currentTimeline = waveTimelines[waveIndex];
        
        currentTimeline.forEach(event => {
            if (!event.spawned && stageTimer >= event.time) {
                event.spawned = true;
                if (event.type === 'FLANK_LEFT' || event.type === 'FLANK_RIGHT') {
                    spawnFormation(event.type, event.y || (100 + Math.random() * 200));
                } else {
                    spawnFormation(event.type);
                }
            }
        });
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        if (e.isMidBoss) {
            if (e.fleeTimer > 0) {
                if (e.y < e.targetY) {
                    e.y += e.vy * ts;
                } else {
                    e.y = e.targetY;
                    e.fleeTimer -= ts;
                }
            } else {
                e.y -= 10 * ts; // flee rapidly
            }
        } else {
            e.x += (e.vx || 0) * ts;
            e.y += (e.vy !== undefined ? e.vy : e.speed) * ts;
        }
        
        if (e.diverState) {
            if (e.diverState === 'DOWN' && e.y >= 500) {
                e.vy = -e.speed;
                e.diverState = 'UP';
            } else if (e.diverState === 'UP' && e.y <= -20) {
                e.vy = e.speed;
                e.diverState = 'AWAY';
            }
        }
        
        if (Date.now() >= (e.nextShot || e.lastShot + 1000) && (!e.isMidBoss || e.y >= e.targetY)) {
            let eSpd = Math.min(3.5, 1 + (linkIteration - 1) * 0.1);
            if (e.isMidBoss && e.fleeTimer > 0) {
                // Fast 8-way spiral for midboss
                let r = (Date.now() / 150); 
                for (let j = 0; j < 8; j++) { 
                    let a = r + (j * Math.PI / 4); 
                    enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 4 * eSpd, vy: Math.sin(a) * 4 * eSpd, grazed: false, color: '#ffca3a' }); 
                }
                e.nextShot = Date.now() + 250; // fast fire rate
            }
            else if (e.type === 'blue') { let r = (Date.now() / 400); for (let j = 0; j < 4; j++) { let a = r + (j * Math.PI / 2); enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 3 * eSpd, vy: Math.sin(a) * 3 * eSpd, grazed: false }); } }
            else { let a_b = Math.atan2(player.y - e.y, player.x - e.x); for (let j = -2; j <= 2; j++) { let a = a_b + (j * 0.25); enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 3.5 * eSpd, vy: Math.sin(a) * 3.5 * eSpd, grazed: false }); } }
            
            if (e.repeatsShot) {
                e.nextShot = e.isMidBoss ? Date.now() + 250 : Date.now() + 1500;
            } else {
                e.nextShot = Date.now() + 9999999;
            }
        }
        
        let died = false;
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            if (Math.hypot(bullets[bi].x - e.x, bullets[bi].y - e.y) < 40) {
                if (e.hp === undefined) e.hp = 1;
                e.hp -= (bullets[bi].damage || 1);
                bullets.splice(bi, 1);
                if (e.hp <= 0) break;
            }
        }
        
        if (e.hp !== undefined && e.hp <= 0) {
            comboChain++; comboTimer = COMBO_MAX_TIME; enemies.splice(i, 1); score += (e.isMidBoss ? 5000 : 100) * comboChain; scoreEl.innerText = score;
            if (audio) audio.playEnemyHit();
            if (e.isMidBoss) {
                for(let k=0; k<60; k++) { 
                    let angle = Math.random() * Math.PI * 2;
                    let spd = Math.random() * 5 + 2;
                    powerItems.push({ x: e.x, y: e.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 3, spawnTime: Date.now() }); 
                }
                for(let k=0; k<3; k++) { 
                    let angle = Math.random() * Math.PI * 2;
                    let spd = Math.random() * 4 + 2;
                    bombItems.push({ x: e.x, y: e.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 4, spawnTime: Date.now() }); 
                }
                lifeItems.push({ x: e.x, y: e.y, vx: 0, vy: -5, spawnTime: Date.now() });
                for(let k=0; k<10; k++) { medals.push({ x: e.x + (Math.random()-0.5)*40, y: e.y + (Math.random()-0.5)*40 }); }
            } else {
                medals.push({ x: e.x, y: e.y });
                if (bombsSpawnedInWave < 1 && Math.random() < 0.05) {
                    bombItems.push({ x: e.x, y: e.y });
                    bombsSpawnedInWave++;
                }
                if (Math.random() < 0.45) powerItems.push({ x: e.x, y: e.y });
            }
            died = true;
        }
        if (!died && (e.y > 900 || (e.isMidBoss && e.fleeTimer <= 0 && e.y < -100) || e.x < -100 || e.x > 700)) enemies.splice(i, 1);
    }

    const isPoCActive = player.y < 150 && ((inputMode === 'keyboard' && keys[keyMap.focus]) || (inputMode === 'gamepad' && gamepadState.focus));
    const isPoCActive2 = is2PMode && player2.y < 150 && ((inputModeP2 === 'keyboard' && keys[keyMapP2.focus]) || (inputModeP2 === 'gamepad' && gamepadState2.focus));
    // Determine the collecting player (P1 takes priority if both active)
    const pocCollector = isPoCActive ? player : (isPoCActive2 ? player2 : null);

    bombItems.forEach((p, i) => {
        if (pocCollector) {
            let angle = Math.atan2(pocCollector.y - p.y, pocCollector.x - p.x);
            p.x += Math.cos(angle) * 15 * ts;
            p.y += Math.sin(angle) * 15 * ts;
        } else {
            if (p.vx !== undefined) { p.x += p.vx * ts; p.vx *= 0.95; }
            if (p.vy !== undefined) { p.y += p.vy * ts; p.vy += 0.2 * ts; if (p.vy > 3) p.vy = 3; }
            else { p.y += 3 * ts; }
        }
        if ((!p.spawnTime || Date.now() - p.spawnTime > 500) && Math.hypot(player.x - p.x, player.y - p.y) < 30) { bombs++; bombsEl.innerText = bombs; bombItems.splice(i, 1); }
        else if (is2PMode && (!p.spawnTime || Date.now() - p.spawnTime > 500) && Math.hypot(player2.x - p.x, player2.y - p.y) < 30) { bombs++; bombsEl.innerText = bombs; bombItems.splice(i, 1); }
        else if (p.y > 850 || p.x < -100 || p.x > 700) bombItems.splice(i, 1);
    });

    powerItems.forEach((p, i) => {
        if (pocCollector) {
            let angle = Math.atan2(pocCollector.y - p.y, pocCollector.x - p.x);
            p.x += Math.cos(angle) * 15 * ts;
            p.y += Math.sin(angle) * 15 * ts;
        } else {
            if (p.vx !== undefined) { p.x += p.vx * ts; p.vx *= 0.95; }
            if (p.vy !== undefined) { p.y += p.vy * ts; p.vy += 0.2 * ts; if (p.vy > 3.5) p.vy = 3.5; }
            else { p.y += 3.5 * ts; }
        }
        if ((!p.spawnTime || Date.now() - p.spawnTime > 500) && Math.hypot(player.x - p.x, player.y - p.y) < 30) { power = Math.min(64, power + 1); powerEl.innerText = power; powerItems.splice(i, 1); }
        else if (is2PMode && (!p.spawnTime || Date.now() - p.spawnTime > 500) && Math.hypot(player2.x - p.x, player2.y - p.y) < 30) { power = Math.min(64, power + 1); powerEl.innerText = power; powerItems.splice(i, 1); }
        else if (p.y > 850 || p.x < -100 || p.x > 700) powerItems.splice(i, 1);
    });

    lifeItems.forEach((p, i) => {
        if (pocCollector) {
            let a = Math.atan2(pocCollector.y - p.y, pocCollector.x - p.x);
            p.x += Math.cos(a) * 8; p.y += Math.sin(a) * 8;
        } else {
            p.x += (p.vx || 0); p.y += (p.vy || 2);
        }
        if ((!p.spawnTime || Date.now() - p.spawnTime > 500) && Math.hypot(player.x - p.x, player.y - p.y) < 30) { 
            lives++; livesEl.innerText = lives; lifeItems.splice(i, 1); 
            if (audio) audio.playPowerup();
        }
        else if (is2PMode && (!p.spawnTime || Date.now() - p.spawnTime > 500) && Math.hypot(player2.x - p.x, player2.y - p.y) < 30) {
            lives++; livesEl.innerText = lives; lifeItems.splice(i, 1);
            if (audio) audio.playPowerup();
        }
        else if (p.y > 850 || p.x < -100 || p.x > 700) lifeItems.splice(i, 1);
    });

    medals.forEach((m, i) => {
        if (pocCollector) {
            let angle = Math.atan2(pocCollector.y - m.y, pocCollector.x - m.x);
            m.x += Math.cos(angle) * 15 * ts;
            m.y += Math.sin(angle) * 15 * ts;
        } else {
            m.y += 4 * ts;
        }
        if (Math.hypot(player.x - m.x, player.y - m.y) < 30) { score += 500; scoreEl.innerText = score; medals.splice(i, 1); }
        else if (is2PMode && Math.hypot(player2.x - m.x, player2.y - m.y) < 30) { score += 500; scoreEl.innerText = score; medals.splice(i, 1); }
        else if (m.y > 850) medals.splice(i, 1);
    });
}

function update() {
    if (resetAnimTimer > 0) { resetAnimTimer--; resetOverlay.style.opacity = Math.min(1, resetAnimTimer / 30); resetText.style.display = (resetAnimTimer > 10) ? "block" : "none"; iterText.style.display = (resetAnimTimer > 10) ? "block" : "none"; if (resetAnimTimer === 0) { isPaused = true; summaryBox.style.display = 'block'; } return; }
    if (!gameStarted || gameOver || isPaused) return;

    const ts = (slowMoTimer > 0) ? 0.4 : 1.0;

    if (!bossMode && waveClearTimer <= 0) {
        stageTimer += ts;
    }

    if (slowMoTimer > 0) slowMoTimer--; if (flashTimer > 0) flashTimer--; if (invulnTimer > 0) invulnTimer--;
    if (waveClearTimer > 0) waveClearTimer--; if (bombEffectTimer > 0) bombEffectTimer--; if (shakeTimer > 0) shakeTimer--;
    if (streakTimer > 0) streakTimer--; else if (grazeStreak > 0 && !hasShield) { grazeStreak = 0; document.getElementById('shieldStreak').innerText = 0; }

    stars.forEach(s => { s.y += s.speed * ts; if (s.y > 800) s.y = 0; });

    updatePlayer(ts, player, (inputMode === 'gamepad') ? gamepadState : null, (inputMode === 'keyboard') ? keyMap : null);
    if (is2PMode) updatePlayer(ts, player2, (inputModeP2 === 'gamepad') ? gamepadState2 : null, (inputModeP2 === 'keyboard') ? keyMapP2 : null);
    updateProjectiles(ts);
    handleCollisions(ts);
    updateBoss(ts);
    updateEnemies(ts);
        
        if (comboChain > 0) {
            comboTimer -= ts;
            if (comboTimer <= 0) {
                comboChain = 0;
                comboTimer = 0;
                let wb = document.getElementById('warning-border');
                wb.style.display = 'block';
                setTimeout(() => { wb.style.display = 'none'; }, 150);
            }
            
            let ocUI = document.getElementById('overclock-ui');
            document.getElementById('combo-chain').innerText = 'x' + comboChain;
            document.getElementById('combo-bar-fill').style.width = Math.max(0, (comboTimer / COMBO_MAX_TIME * 100)) + '%';
            
            if (comboChain >= 10) {
                document.getElementById('combo-chain').style.color = '#ff006e';
                document.getElementById('combo-chain').style.textShadow = '0 0 10px #ff006e';
                document.getElementById('combo-bar-fill').style.background = '#ff006e';
            } else {
                document.getElementById('combo-chain').style.color = '#00f2ff';
                document.getElementById('combo-chain').style.textShadow = 'none';
                document.getElementById('combo-bar-fill').style.background = '#00f2ff';
            }
        }
}

function draw() {
    ctx.save(); if (shakeTimer > 0) { const m = shakeTimer / 4; ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m); }
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, 600, 800);

    if (!gameStarted) {
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '20px Courier';
        if (assetsLoaded < totalAssets) {
            ctx.fillText(`LOADING ASSETS... (${assetsLoaded}/${totalAssets})`, 300, 380);
        } else {
            const startPrompt = inputMode === 'gamepad' ? `PRESS START` : `PRESS ${keyMap.shoot.toUpperCase()} OR ENTER`;
            ctx.fillText("READY - " + startPrompt, 300, 380);
            ctx.font = '14px Courier';
            ctx.fillText("LINK ITERATION: " + linkIteration, 300, 420);
        }
        ctx.restore(); return;
    }

function drawPlayer(pObj, isP1) {
    if (invulnTimer % 10 < 5) { 
        if (isP1) {
            if (assets.player.loaded) ctx.drawImage(assets.player.img, pObj.x - 50, pObj.y - 50, 100, 100); 
            else { ctx.fillStyle = 'purple'; ctx.beginPath(); ctx.arc(pObj.x, pObj.y, 25, 0, 7); ctx.fill(); }
        } else {
            if (pObj.image && pObj.image.complete && pObj.image.naturalWidth > 0) ctx.drawImage(pObj.image, pObj.x - 50, pObj.y - 50, 100, 100); 
            else { ctx.fillStyle = 'pink'; ctx.beginPath(); ctx.arc(pObj.x, pObj.y, 25, 0, 7); ctx.fill(); }
        }
    }
}

function drawSatellites(pObj) {
    let activeCount = power >= 48 ? 4 : (power >= 32 ? 3 : (power >= 16 ? 2 : (power >= 8 ? 1 : 0)));
    let isP2 = (pObj === player2);
    for (let i = 0; i < activeCount; i++) {
        let s = pObj.satellites[i];
        ctx.save();
        ctx.translate(s.x, s.y);
        
        if (isP2) {
            // Moe Moe Kyun Hearts — proper two-lobe heart shape
            ctx.scale(0.85, 0.85);
            ctx.rotate(Math.sin((Date.now() % 2000) * 0.003 + i) * 0.15);

            // Outer heart (deep pink)
            ctx.fillStyle = '#ff007f';
            ctx.beginPath();
            // Start at the bottom tip
            ctx.moveTo(0, 12);
            // Right lobe: curve up-right then back to top-center
            ctx.bezierCurveTo(12, 4,   18, -8,  9, -16);
            ctx.bezierCurveTo(4,  -22,  0, -18,  0, -12);
            // Left lobe: mirror
            ctx.bezierCurveTo(0,  -18, -4, -22, -9, -16);
            ctx.bezierCurveTo(-18, -8, -12,  4,   0,  12);
            ctx.closePath();
            ctx.fill();

            // Inner highlight (light pink)
            ctx.fillStyle = 'rgba(255, 179, 217, 0.75)';
            ctx.beginPath();
            ctx.moveTo(0, 4);
            ctx.bezierCurveTo(6, -1,  10, -8,  5, -13);
            ctx.bezierCurveTo(2, -16,  0, -12,  0, -8);
            ctx.bezierCurveTo(0, -12, -2, -16, -5, -13);
            ctx.bezierCurveTo(-10, -8, -6,  -1,   0,   4);
            ctx.closePath();
            ctx.fill();
        } else {
            // Yin-Yang Orbs
            ctx.rotate((Date.now() % 10000) * 0.02);

            ctx.fillStyle = '#00f2ff';
            ctx.beginPath();
            ctx.arc(0, 0, 15, Math.PI / 2, Math.PI * 1.5);
            ctx.fill();

            ctx.fillStyle = '#b5179e';
            ctx.beginPath();
            ctx.arc(0, 0, 15, Math.PI * 1.5, Math.PI * 2.5);
            ctx.fill();

            ctx.fillStyle = '#b5179e';
            ctx.beginPath(); ctx.arc(0, -7.5, 7.5, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#00f2ff';
            ctx.beginPath(); ctx.arc(0, 7.5, 7.5, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#00f2ff';
            ctx.beginPath(); ctx.arc(0, -7.5, 2, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#b5179e';
            ctx.beginPath(); ctx.arc(0, 7.5, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

    stars.forEach(s => { ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.size, s.size); });
    drawPlayer(player, true);
    if (is2PMode) drawPlayer(player2, false);

    if (boss) {
        // --- Satsuki Summoning Circle ---
        if (boss.introState === 'summon') {
            const SUMMON_MAX = 180;
            let progress = Math.max(0, Math.min(1, 1 - (boss.introTimer / SUMMON_MAX)));
            let alpha = progress;
            let radius = 30 + progress * 80;
            let outerRadius = 20 + progress * 110;
            let rotation = progress * Math.PI * 4; // two full rotations over the summon

            ctx.save();
            ctx.translate(boss.x, boss.y);
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = '#d90429';
            ctx.shadowBlur = 20 + progress * 30;
            ctx.shadowColor = '#d90429';
            ctx.lineWidth = 1.5;

            // Outer ring
            ctx.beginPath();
            ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Inner ring
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
            ctx.stroke();

            // Rotating hexagram
            ctx.save();
            ctx.rotate(rotation);
            for (let tri = 0; tri < 2; tri++) {
                ctx.beginPath();
                for (let i = 0; i < 3; i++) {
                    let a = i * Math.PI * 2 / 3 + (tri * Math.PI / 3);
                    let px = Math.cos(a) * radius;
                    let py = Math.sin(a) * radius;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
            }
            ctx.restore();

            // 6 rune points on outer ring
            for (let i = 0; i < 6; i++) {
                let a = (i / 6) * Math.PI * 2 + rotation * 0.5;
                let rx = Math.cos(a) * outerRadius;
                let ry = Math.sin(a) * outerRadius;
                ctx.beginPath();
                ctx.arc(rx, ry, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#ffb3c1';
                ctx.fill();
            }

            // Glow pulse in centre
            let pulse = 0.3 + Math.sin(Date.now() * 0.008) * 0.2;
            ctx.beginPath();
            ctx.arc(0, 0, 12 * progress, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(217, 4, 41, ${pulse * progress})`;
            ctx.fill();

            ctx.globalAlpha = 1.0;
            ctx.restore();
        } else
        if (boss.teleportWarnTimer > 0) {
            ctx.save();
            ctx.translate(boss.futureX, boss.futureY);
            
            ctx.strokeStyle = '#ff006e';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff006e';
            
            // Base Circle: Rotating Hexagram
            ctx.save();
            // Prevent float precision loss by using modulo on Date.now()
            ctx.rotate((Date.now() % 10000) * 0.005);
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI * 2);
            ctx.stroke();
            
            // First Triangle
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                let a = i * Math.PI * 2 / 3;
                let px = Math.cos(a) * 40;
                let py = Math.sin(a) * 40;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            
            // Second Triangle (Offset by PI/3)
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                let a = i * Math.PI * 2 / 3 + Math.PI / 3;
                let px = Math.cos(a) * 40;
                let py = Math.sin(a) * 40;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore(); // Restore rotation
            // The Collapsing Ring (using 25 frames max)
            let collapseRadius = (boss.teleportWarnTimer / 25) * 80;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0, collapseRadius), 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore(); // Restore translation, shadow, line width
        } else {
            let renderType = (is2PMode && boss.type === 'pink') ? 'bowl' : boss.type;
            if (assets[renderType] && assets[renderType].loaded) {
                if (boss.hp < boss.maxHP / 2 && Date.now() % 200 < 100) ctx.globalAlpha = 0.5;
                if (renderType === 'bowl') {
                    let rotation = boss.vx ? Math.max(-0.35, Math.min(0.35, boss.vx * 0.1)) : 0;
                    ctx.save();
                    ctx.translate(boss.x, boss.y);
                    ctx.rotate(rotation);
                    ctx.drawImage(assets.bowl.img, -75, -75, 150, 150);
                    ctx.restore();
                } else {
                    ctx.drawImage(assets[renderType].img, boss.x - 75, boss.y - 75, 150, 150);
                }
                ctx.globalAlpha = 1.0;
            } else {
                const colorMap = { pink: '#ff006e', blue: '#00f2ff', green: '#0f0', purple: '#b5179e', amber: '#f77f00', crimson: '#d90429' };
                ctx.fillStyle = colorMap[boss.type] || '#fff';
                if (boss.hp < boss.maxHP / 2 && Date.now() % 200 < 100) ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(boss.x, boss.y, 75, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }

            bowlSteam.forEach(p => {
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, p.life * 0.4)})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            if (boss.flashTimer > 0 && Math.floor(boss.flashTimer) % 6 < 3) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(boss.x, boss.y, 75, 0, Math.PI * 2); ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
            }
        }
    }

    if (flankerWarning.timer > 0) {
        ctx.fillStyle = (Math.floor(Date.now() / 100) % 2 === 0) ? '#ff006e' : '#ffca3a';
        ctx.font = 'bold 40px "Courier New"';
        ctx.fillText('!', flankerWarning.side === 'FLANK_LEFT' ? 20 : 560, flankerWarning.y);
    }
    
    enemies.forEach(e => { 
        if (e.isMidBoss) {
            let renderType = is2PMode ? 'bowl' : 'pink';
            if (assets[renderType] && assets[renderType].loaded) {
                if (e.hp < 75 && Date.now() % 200 < 100) ctx.globalAlpha = 0.5;
                ctx.drawImage(assets[renderType].img, e.x - 40, e.y - 40, 80, 80);
                ctx.globalAlpha = 1.0;
            } else {
                ctx.save();
                ctx.translate(e.x, e.y);
                ctx.fillStyle = '#ff006e';
                ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        } else {
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.lineWidth = 2;
            ctx.fillStyle = '#111'; // To obscure background objects behind them

            if (e.type === 'blue') {
                // Glitch Faerie - Cyan Crystal
                ctx.strokeStyle = '#00f2ff';
                ctx.shadowColor = '#00f2ff';
                ctx.shadowBlur = 12;
                
                ctx.beginPath();
                ctx.moveTo(0, -22);
                ctx.lineTo(14, 0);
                ctx.lineTo(0, 22);
                ctx.lineTo(-14, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                // Inner geometric detail
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(6, 0);
                ctx.lineTo(0, 12);
                ctx.lineTo(-6, 0);
                ctx.closePath();
                ctx.stroke();

            } else if (e.type === 'green') {
                // Rogue Packet - Swept origami dart
                ctx.strokeStyle = '#0f0';
                ctx.shadowColor = '#0f0';
                ctx.shadowBlur = 12;
                
                ctx.beginPath();
                ctx.moveTo(0, 22);      // Pointing down
                ctx.lineTo(18, -18);    // Right wing tip
                ctx.lineTo(0, -6);      // Inner notch
                ctx.lineTo(-18, -18);   // Left wing tip
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                // Center ridge line
                ctx.beginPath();
                ctx.moveTo(0, -6);
                ctx.lineTo(0, 22);
                ctx.stroke();

            } else if (e.type === 'pink') {
                // Firewall Golem - Interlocking rotating tank
                ctx.strokeStyle = '#ff006e';
                ctx.shadowColor = '#ff006e';
                ctx.shadowBlur = 12;
                
                // Slow rotation
                ctx.rotate(Date.now() * 0.0015);
                
                // Outer Hexagon
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    let a = i * Math.PI / 3;
                    let px = Math.cos(a) * 22;
                    let py = Math.sin(a) * 22;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                // Inner overlapping triangles (Star of David) for icosahedron illusion
                ctx.beginPath();
                ctx.moveTo(-12, -7); ctx.lineTo(12, -7); ctx.lineTo(0, 14); ctx.closePath();
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(-12, 7); ctx.lineTo(12, 7); ctx.lineTo(0, -14); ctx.closePath();
                ctx.stroke();
            } else {
                // Fallback for any other type
                ctx.fillStyle = '#444'; 
                ctx.fillRect(-15, -15, 30, 30); 
                ctx.strokeStyle = '#fff';
                ctx.strokeRect(-15, -15, 30, 30); 
            }
            ctx.restore();
        }
    });

    bombItems.forEach(p => { ctx.fillStyle = '#f0f'; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText("B", p.x - 4, p.y + 4); });
    powerItems.forEach(p => { ctx.fillStyle = '#ff006e'; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText("P", p.x - 4, p.y + 4); });
    lifeItems.forEach(p => { ctx.fillStyle = '#11ff11'; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText("1UP", p.x - 12, p.y + 4); });
    medals.forEach(m => { ctx.fillStyle = '#ffca3a'; ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillText("M", m.x - 3, m.y + 4); });

    drawSatellites(player);
    if (is2PMode) drawSatellites(player2);

    bullets.forEach(b => {
        if (b.isP2Bullet || b.isP2Homing) {
            // PingKo: draw as a glowing elongated beam
            ctx.save();
            ctx.shadowColor = b.color || '#ff69b4';
            ctx.shadowBlur = 8;
            ctx.fillStyle = b.color || '#ff69b4';
            ctx.fillRect(b.x - (b.w || 4) / 2, b.y - (b.h || 10), (b.w || 4), (b.h || 10));
            // Bright core
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillRect(b.x - 1, b.y - (b.h || 10), 2, (b.h || 10));
            ctx.restore();
        } else {
            ctx.fillStyle = b.color || (hasShield ? '#00f2ff' : (grazeStreak >= 5 ? '#ffca3a' : '#00f2ff'));
            ctx.fillRect(b.x - (b.w || 4) / 2, b.y - (b.h || 10), (b.w || 4), (b.h || 10));
        }
    });
    effects.forEach(eff => { ctx.strokeStyle = `rgba(0, 242, 255, ${eff.opacity})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(eff.x, eff.y, eff.r, 0, Math.PI * 2); ctx.stroke(); });

    // EMP Shockwave Render
    activeEMPs.forEach(emp => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = emp.glowColor;
        ctx.shadowBlur = 30;

        if (emp.isP1) {
            // ── P1 Fosozu: Purple radial shockwave ──────────────────────────
            // Outer hard ring
            ctx.beginPath();
            ctx.arc(emp.x, emp.y, emp.radius, 0, Math.PI * 2);
            ctx.lineWidth = 14;
            ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity})`;
            ctx.stroke();
            // Inner softer halo ring
            if (emp.radius > 20) {
                ctx.beginPath();
                ctx.arc(emp.x, emp.y, emp.radius - 18, 0, Math.PI * 2);
                ctx.lineWidth = 6;
                ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.4})`;
                ctx.stroke();
            }
        } else {
            // ── P2 PingKo: Pink arcane summoning circle shockwave ────────────
            ctx.translate(emp.x, emp.y);
            ctx.rotate(emp.arcaneAngle);

            // Outer expanding ring
            ctx.beginPath();
            ctx.arc(0, 0, emp.radius, 0, Math.PI * 2);
            ctx.lineWidth = 12;
            ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity})`;
            ctx.stroke();

            // Rotating hexagram (two interlocked triangles) at ring edge scale
            const triR = emp.radius * 0.55;
            if (triR > 10) {
                for (let tri = 0; tri < 2; tri++) {
                    ctx.beginPath();
                    for (let v = 0; v < 3; v++) {
                        const a = (v * Math.PI * 2 / 3) + (tri * Math.PI / 3);
                        v === 0 ? ctx.moveTo(Math.cos(a) * triR, Math.sin(a) * triR)
                                : ctx.lineTo(Math.cos(a) * triR, Math.sin(a) * triR);
                    }
                    ctx.closePath();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.7})`;
                    ctx.stroke();
                }
            }

            // 6 glowing rune dots on the outer ring
            for (let d = 0; d < 6; d++) {
                const a = (d / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * emp.radius, Math.sin(a) * emp.radius, 4 * emp.opacity, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${emp.rgbBase}, ${emp.opacity})`;
                ctx.fill();
            }

            // Inner concentric ring counter-rotating
            ctx.rotate(-emp.arcaneAngle * 2);
            if (emp.radius > 30) {
                ctx.beginPath();
                ctx.arc(0, 0, emp.radius * 0.6, 0, Math.PI * 2);
                ctx.lineWidth = 4;
                ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.5})`;
                ctx.stroke();
            }
        }

        ctx.restore();
    });
    bossBullets.forEach(b => { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 7); ctx.fill(); });

    ctx.fillStyle = '#0f0'; enemyBullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill(); });
    const isFocused1 = (inputMode === 'keyboard' && keys[keyMap.focus]) || (inputMode === 'gamepad' && gamepadState.focus);
    if (isFocused1) { ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(player.x, player.y, player.hitboxSize, 0, 7); ctx.fill(); }
    const isFocused2 = (inputModeP2 === 'keyboard' && keys[keyMapP2.focus]) || (inputModeP2 === 'gamepad' && gamepadState2.focus);
    if (is2PMode && isFocused2) { ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(player2.x, player2.y, player2.hitboxSize, 0, 7); ctx.fill(); }

    if (isPaused && dialogueBox.style.display !== 'block' && summaryBox.style.display !== 'block' && resetAnimTimer <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 600, 800);
    }

    if (gameOver) { ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, 600, 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText("SIGNAL LOST", 300, 400); }
    ctx.restore();
}

const TICK_RATE = 1000 / 60;
let accumulator = 0;
let lastTime = performance.now();
let lastContinueTime = performance.now();
let frameCount = 0;
let lastFPSCheck = performance.now();

function loop(timestamp) {
    pollGamepad();
    handleGamepadButtons();

    let dt = timestamp - lastTime;
    if (dt > 250) dt = 250;
    lastTime = timestamp;


    if (document.getElementById('submit-score-ui').style.display === 'block') {
        // Halt loop while submitting score
        let isP1GP = inputMode === 'gamepad';
        let isP2GP = is2PMode && inputModeP2 === 'gamepad';
        if (isP1GP || isP2GP) {
            let gpUp = (isP1GP && gamepadState.up && !prevGamepadState.up) || (isP2GP && gamepadState2.up && !prevGamepadState2.up);
            let gpDown = (isP1GP && gamepadState.down && !prevGamepadState.down) || (isP2GP && gamepadState2.down && !prevGamepadState2.down);
            let gpShoot = (isP1GP && gamepadState.shoot && !prevGamepadState.shoot) || (isP2GP && gamepadState2.shoot && !prevGamepadState2.shoot);
            let gpStart = (isP1GP && gamepadState.start && !prevGamepadState.start) || (isP2GP && gamepadState2.start && !prevGamepadState2.start);
            let gpBomb = (isP1GP && gamepadState.bomb && !prevGamepadState.bomb) || (isP2GP && gamepadState2.bomb && !prevGamepadState2.bomb);
            if (gpUp) handleArcadeInput('up');
            if (gpDown) handleArcadeInput('down');
            if (gpShoot) handleArcadeInput('shoot');
            if (gpStart) handleArcadeInput('start');
            if (gpBomb) handleArcadeInput('bomb');
        }
        requestAnimationFrame(loop);
        return;
    }

    if (continueCountdown > 0) {
        if (timestamp - lastContinueTime > 1000) {
            continueCountdown--;
            document.getElementById('continue-timer').innerText = continueCountdown;
            lastContinueTime = timestamp;
            if (continueCountdown <= 0) {
                gameOver = true;
                continueUI.style.display = 'none';
                setTimeout(() => location.reload(), 3000);
            }
        }
    } else {
        lastContinueTime = timestamp;
        accumulator += dt;
        while (accumulator >= TICK_RATE) {
            update();
            accumulator -= TICK_RATE;
        }
    }

    draw();

    frameCount++;
    if (timestamp > lastFPSCheck + 1000) {
        fpsCounterEl.innerText = Math.round((frameCount * 1000) / (timestamp - lastFPSCheck));
        frameCount = 0;
        lastFPSCheck = timestamp;
    }

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
