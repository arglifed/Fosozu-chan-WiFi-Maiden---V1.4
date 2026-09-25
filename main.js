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

async function submitScore(name, score, wave, continues = 0) {
    if (isDevMode) { console.log("Dev mode active: Score blocked."); return; }
    try {
        let endpoint = is2PMode ? 'coop_leaderboard' : 'leaderboard';
        await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
            body: JSON.stringify({ name: name.toUpperCase(), score: score, wave: wave, continues: continues })
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
window.continuesUsed = 0;
let waveClearTimer = 0, p1BombTimer = 0, p2BombTimer = 0, invulnTimer = 0, shakeTimer = 0, stallingTimer = 0, continueCountdown = 0;
let satsukiSummonTimer = 0; // 10-second tension delay before Satsuki spawns
let slowMoTimer = 0, flashTimer = 0, grazeStreak = 0, streakTimer = 0, hasShield = false, waveGraze = 0, dialogueIndex = 0, resetAnimTimer = 0, linkIteration = 1, shieldBrokenInWave = false;

// WAVE-BASED MECHANICS
let stageTimer = 0;

const waveTimelines = {
    1: [
        { time: 0,    type: 'WALL',        spawned: false },
        { time: 90,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 90,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 180,  type: 'CIRCLE',      spawned: false },
        { time: 270, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 360, type: 'WALL',        spawned: false },
        { time: 450, type: 'V_SHAPE',     spawned: false },
        { time: 540, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 630, type: 'DIVER_SWOOP', spawned: false },
        { time: 720, type: 'SWEEP_LEFT',  spawned: false },
        { time: 720, type: 'SWEEP_RIGHT', spawned: false },
        { time: 810, type: 'WALL',        spawned: false },
        { time: 900, type: 'CIRCLE',      spawned: false },
        { time: 990, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 990, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 1080, type: 'V_SHAPE',     spawned: false },
        { time: 1170, type: 'DIVER_SWOOP', spawned: false },
        { time: 1260, type: 'WALL',        spawned: false },
        { time: 1350, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1350, type: 'SWEEP_RIGHT', spawned: false },
        { time: 1440, type: 'CIRCLE',      spawned: false },
        { time: 1530, type: 'FLANK_LEFT',  y: 350, spawned: false },
        { time: 1530, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 1620, type: 'V_SHAPE',     spawned: false },
        { time: 1710, type: 'DIVER_SWOOP', spawned: false },
        { time: 1800, type: 'WALL',        spawned: false },
        { time: 1890, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1890, type: 'SWEEP_RIGHT', spawned: false },
        { time: 1980,    type: 'WALL',        spawned: false },
        { time: 2061,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 2061,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 2142,  type: 'CIRCLE',      spawned: false },
        { time: 2223, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 2304, type: 'WALL',        spawned: false },
        { time: 2385, type: 'V_SHAPE',     spawned: false },
        { time: 2466, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 2547, type: 'DIVER_SWOOP', spawned: false },
        { time: 2628, type: 'SWEEP_LEFT',  spawned: false },
        { time: 2628, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2709, type: 'WALL',        spawned: false },
        { time: 2790, type: 'CIRCLE',      spawned: false },
        { time: 2871, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 2871, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 2952, type: 'V_SHAPE',     spawned: false },
        { time: 3033, type: 'DIVER_SWOOP', spawned: false },
        { time: 3114, type: 'WALL',        spawned: false },
        { time: 3195, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3195, type: 'SWEEP_RIGHT', spawned: false },
        { time: 3276, type: 'CIRCLE',      spawned: false },
        { time: 3357, type: 'FLANK_LEFT',  y: 350, spawned: false },
        { time: 3357, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 3438, type: 'V_SHAPE',     spawned: false },
        { time: 3519, type: 'DIVER_SWOOP', spawned: false },
        { time: 3600, type: 'WALL',        spawned: false },
        { time: 3681, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3681, type: 'SWEEP_RIGHT', spawned: false },
        { time: 3771,    type: 'WALL',        spawned: false },
        { time: 3843,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 3843,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 3915,  type: 'CIRCLE',      spawned: false },
        { time: 3987, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 4059, type: 'WALL',        spawned: false },
        { time: 4131, type: 'V_SHAPE',     spawned: false },
        { time: 4203, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 4275, type: 'DIVER_SWOOP', spawned: false },
        { time: 4347, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4347, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4419, type: 'WALL',        spawned: false },
        { time: 4491, type: 'CIRCLE',      spawned: false },
        { time: 4563, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 4563, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 4635, type: 'V_SHAPE',     spawned: false },
        { time: 4707, type: 'DIVER_SWOOP', spawned: false },
        { time: 4779, type: 'WALL',        spawned: false },
        { time: 4851, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4851, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4923, type: 'CIRCLE',      spawned: false },
        { time: 4995, type: 'FLANK_LEFT',  y: 350, spawned: false },
        { time: 4995, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 5067, type: 'V_SHAPE',     spawned: false },
        { time: 5139, type: 'DIVER_SWOOP', spawned: false },
        { time: 5211, type: 'WALL',        spawned: false },
        { time: 5283, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5283, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5373,    type: 'WALL',        spawned: false },
        { time: 5436,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 5436,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 5499,  type: 'CIRCLE',      spawned: false },
        { time: 5562, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 5625, type: 'WALL',        spawned: false },
        { time: 5688, type: 'V_SHAPE',     spawned: false },
        { time: 5751, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 5814, type: 'DIVER_SWOOP', spawned: false },
        { time: 5877, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5877, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5940, type: 'WALL',        spawned: false },
        { time: 6003, type: 'CIRCLE',      spawned: false },
        { time: 6066, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 6066, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 6129, type: 'V_SHAPE',     spawned: false },
        { time: 6192, type: 'DIVER_SWOOP', spawned: false },
        { time: 6255, type: 'WALL',        spawned: false },
        { time: 6318, type: 'SWEEP_LEFT',  spawned: false },
        { time: 6318, type: 'SWEEP_RIGHT', spawned: false },
        { time: 6381, type: 'CIRCLE',      spawned: false },
        { time: 6444, type: 'FLANK_LEFT',  y: 350, spawned: false },
        { time: 6444, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 6507, type: 'V_SHAPE',     spawned: false },
        { time: 6570, type: 'DIVER_SWOOP', spawned: false },
        { time: 6633, type: 'WALL',        spawned: false },
        { time: 6696, type: 'SWEEP_LEFT',  spawned: false },
        { time: 6696, type: 'SWEEP_RIGHT', spawned: false },
        { time: 6786,    type: 'WALL',        spawned: false },
        { time: 6844,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 6844,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 6903,  type: 'CIRCLE',      spawned: false },
        { time: 6961, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 7020, type: 'WALL',        spawned: false },
        { time: 7078, type: 'V_SHAPE',     spawned: false },
        { time: 7137, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 7195, type: 'DIVER_SWOOP', spawned: false },
        { time: 7254, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7254, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7312, type: 'WALL',        spawned: false },
        { time: 7371, type: 'CIRCLE',      spawned: false },
        { time: 7429, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 7429, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 7488, type: 'V_SHAPE',     spawned: false },
        { time: 7546, type: 'DIVER_SWOOP', spawned: false },
        { time: 7605, type: 'WALL',        spawned: false },
        { time: 7663, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7663, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7722, type: 'CIRCLE',      spawned: false },
        { time: 7780, type: 'FLANK_LEFT',  y: 350, spawned: false },
        { time: 7780, type: 'FLANK_RIGHT', y: 350, spawned: false },
],
    2: [
        { time: 0,    type: 'SLOW_CIRCLE', spawned: false },
        { time: 90,  type: 'V_SHAPE',     spawned: false },
        { time: 180,  type: 'WALL',        spawned: false },
        { time: 270,  type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 270,  type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 360, type: 'SHIELD_WALL', spawned: false },
        { time: 450, type: 'DIVER_SWOOP', spawned: false },
        { time: 540, type: 'SWEEP_LEFT',  spawned: false },
        { time: 540, type: 'SWEEP_RIGHT', spawned: false },
        { time: 630, type: 'CIRCLE',      spawned: false },
        { time: 720, type: 'V_SHAPE',     spawned: false },
        { time: 810, type: 'SHIELD_WALL', spawned: false },
        { time: 900, type: 'SWEEP_LEFT',  spawned: false },
        { time: 900, type: 'SWEEP_RIGHT', spawned: false },
        { time: 990, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1080, type: 'WALL',        spawned: false },
        { time: 1170, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 1170, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 1260, type: 'SHIELD_WALL', spawned: false },
        { time: 1350, type: 'DIVER_SWOOP', spawned: false },
        { time: 1440, type: 'CIRCLE',      spawned: false },
        { time: 1530, type: 'V_SHAPE',     spawned: false },
        { time: 1620, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1620, type: 'SWEEP_RIGHT', spawned: false },
        { time: 1710, type: 'SHIELD_WALL', spawned: false },
        { time: 1800, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1890, type: 'WALL',        spawned: false },
        { time: 1980, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 1980, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 2070, type: 'DIVER_SWOOP', spawned: false },
        { time: 2160, type: 'CIRCLE',      spawned: false },
        { time: 2250, type: 'SWEEP_LEFT',  spawned: false },
        { time: 2250, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2340,    type: 'SLOW_CIRCLE', spawned: false },
        { time: 2421,  type: 'V_SHAPE',     spawned: false },
        { time: 2502,  type: 'WALL',        spawned: false },
        { time: 2583,  type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 2583,  type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 2664, type: 'SHIELD_WALL', spawned: false },
        { time: 2745, type: 'DIVER_SWOOP', spawned: false },
        { time: 2826, type: 'SWEEP_LEFT',  spawned: false },
        { time: 2826, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2907, type: 'CIRCLE',      spawned: false },
        { time: 2988, type: 'V_SHAPE',     spawned: false },
        { time: 3069, type: 'SHIELD_WALL', spawned: false },
        { time: 3150, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3150, type: 'SWEEP_RIGHT', spawned: false },
        { time: 3231, type: 'SLOW_CIRCLE', spawned: false },
        { time: 3312, type: 'WALL',        spawned: false },
        { time: 3393, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 3393, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 3474, type: 'SHIELD_WALL', spawned: false },
        { time: 3555, type: 'DIVER_SWOOP', spawned: false },
        { time: 3636, type: 'CIRCLE',      spawned: false },
        { time: 3717, type: 'V_SHAPE',     spawned: false },
        { time: 3798, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3798, type: 'SWEEP_RIGHT', spawned: false },
        { time: 3879, type: 'SHIELD_WALL', spawned: false },
        { time: 3960, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4041, type: 'WALL',        spawned: false },
        { time: 4122, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 4122, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 4203, type: 'DIVER_SWOOP', spawned: false },
        { time: 4284, type: 'CIRCLE',      spawned: false },
        { time: 4365, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4365, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4455,    type: 'SLOW_CIRCLE', spawned: false },
        { time: 4527,  type: 'V_SHAPE',     spawned: false },
        { time: 4599,  type: 'WALL',        spawned: false },
        { time: 4671,  type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 4671,  type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 4743, type: 'SHIELD_WALL', spawned: false },
        { time: 4815, type: 'DIVER_SWOOP', spawned: false },
        { time: 4887, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4887, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4959, type: 'CIRCLE',      spawned: false },
        { time: 5031, type: 'V_SHAPE',     spawned: false },
        { time: 5103, type: 'SHIELD_WALL', spawned: false },
        { time: 5175, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5175, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5247, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5319, type: 'WALL',        spawned: false },
        { time: 5391, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 5391, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 5463, type: 'SHIELD_WALL', spawned: false },
        { time: 5535, type: 'DIVER_SWOOP', spawned: false },
        { time: 5607, type: 'CIRCLE',      spawned: false },
        { time: 5679, type: 'V_SHAPE',     spawned: false },
        { time: 5751, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5751, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5823, type: 'SHIELD_WALL', spawned: false },
        { time: 5895, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5967, type: 'WALL',        spawned: false },
        { time: 6039, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 6039, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 6111, type: 'DIVER_SWOOP', spawned: false },
        { time: 6183, type: 'CIRCLE',      spawned: false },
        { time: 6255, type: 'SWEEP_LEFT',  spawned: false },
        { time: 6255, type: 'SWEEP_RIGHT', spawned: false },
        { time: 6345,    type: 'SLOW_CIRCLE', spawned: false },
        { time: 6408,  type: 'V_SHAPE',     spawned: false },
        { time: 6471,  type: 'WALL',        spawned: false },
        { time: 6534,  type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 6534,  type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 6597, type: 'SHIELD_WALL', spawned: false },
        { time: 6660, type: 'DIVER_SWOOP', spawned: false },
        { time: 6723, type: 'SWEEP_LEFT',  spawned: false },
        { time: 6723, type: 'SWEEP_RIGHT', spawned: false },
        { time: 6786, type: 'CIRCLE',      spawned: false },
        { time: 6849, type: 'V_SHAPE',     spawned: false },
        { time: 6912, type: 'SHIELD_WALL', spawned: false },
        { time: 6975, type: 'SWEEP_LEFT',  spawned: false },
        { time: 6975, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7038, type: 'SLOW_CIRCLE', spawned: false },
        { time: 7101, type: 'WALL',        spawned: false },
        { time: 7164, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 7164, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 7227, type: 'SHIELD_WALL', spawned: false },
        { time: 7290, type: 'DIVER_SWOOP', spawned: false },
        { time: 7353, type: 'CIRCLE',      spawned: false },
        { time: 7416, type: 'V_SHAPE',     spawned: false },
        { time: 7479, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7479, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7542, type: 'SHIELD_WALL', spawned: false },
        { time: 7605, type: 'SLOW_CIRCLE', spawned: false },
        { time: 7668, type: 'WALL',        spawned: false },
        { time: 7731, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 7731, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 7794, type: 'DIVER_SWOOP', spawned: false },
        { time: 7857, type: 'CIRCLE',      spawned: false },
        { time: 7920, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7920, type: 'SWEEP_RIGHT', spawned: false },
        { time: 8010,    type: 'SLOW_CIRCLE', spawned: false },
        { time: 8068,  type: 'V_SHAPE',     spawned: false },
        { time: 8127,  type: 'WALL',        spawned: false },
        { time: 8185,  type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 8185,  type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 8244, type: 'SHIELD_WALL', spawned: false },
        { time: 8302, type: 'DIVER_SWOOP', spawned: false },
        { time: 8361, type: 'SWEEP_LEFT',  spawned: false },
        { time: 8361, type: 'SWEEP_RIGHT', spawned: false },
        { time: 8419, type: 'CIRCLE',      spawned: false },
        { time: 8478, type: 'V_SHAPE',     spawned: false },
        { time: 8536, type: 'SHIELD_WALL', spawned: false },
        { time: 8595, type: 'SWEEP_LEFT',  spawned: false },
        { time: 8595, type: 'SWEEP_RIGHT', spawned: false },
        { time: 8653, type: 'SLOW_CIRCLE', spawned: false },
        { time: 8712, type: 'WALL',        spawned: false },
        { time: 8770, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 8770, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 8829, type: 'SHIELD_WALL', spawned: false },
        { time: 8887, type: 'DIVER_SWOOP', spawned: false },
        { time: 8946, type: 'CIRCLE',      spawned: false },
        { time: 9004, type: 'V_SHAPE',     spawned: false },
        { time: 9063, type: 'SWEEP_LEFT',  spawned: false },
        { time: 9063, type: 'SWEEP_RIGHT', spawned: false },
        { time: 9121, type: 'SHIELD_WALL', spawned: false },
        { time: 9180, type: 'SLOW_CIRCLE', spawned: false },
        { time: 9238, type: 'WALL',        spawned: false },
        { time: 9297, type: 'FLANK_LEFT',  y: 300, spawned: false },
        { time: 9297, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 9355, type: 'DIVER_SWOOP', spawned: false },
        { time: 9414, type: 'CIRCLE',      spawned: false },
        { time: 9472, type: 'SWEEP_LEFT',  spawned: false },
        { time: 9472, type: 'SWEEP_RIGHT', spawned: false },
        { time: 9562,    type: 'SLOW_CIRCLE', spawned: false },
        { time: 9621,  type: 'V_SHAPE',     spawned: false },
        { time: 9679,  type: 'WALL',        spawned: false },
],
    3: [
        { time: 0,    type: 'SHIELD_WALL',     spawned: false },
        { time: 90,  type: 'V_SHAPE',         spawned: false },
        { time: 180,  type: 'WALL',            spawned: false },
        { time: 270, type: 'DIVER_SWOOP',     spawned: false },
        { time: 360, type: 'CIRCLE',          spawned: false },
        { time: 450, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 450, type: 'FLANK_RIGHT',     y: 350, spawned: false },
        { time: 540, type: 'SHIELD_WALL',     spawned: false },
        { time: 630, type: 'SWEEP_LEFT',      spawned: false },
        { time: 630, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 720, type: 'V_SHAPE',         spawned: false },
        { time: 810, type: 'DIVER_SWOOP',     spawned: false },
        { time: 810, type: 'DIVER_SWOOP',     spawned: false },
        // { time: 900, type: 'MID_BOSS_PINGKO', spawned: false },
        { time: 990, type: 'DIVER_SWOOP',     spawned: false },
        { time: 1080, type: 'WALL',            spawned: false },
        { time: 1170, type: 'FLANK_LEFT',      y: 300, spawned: false },
        { time: 1170, type: 'FLANK_RIGHT',     y: 300, spawned: false },
        { time: 1260, type: 'SWEEP_LEFT',      spawned: false },
        { time: 1260, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 1350, type: 'CIRCLE',          spawned: false },
        { time: 1440, type: 'SHIELD_WALL',     spawned: false },
        { time: 1530, type: 'V_SHAPE',         spawned: false },
        { time: 1620, type: 'DIVER_SWOOP',     spawned: false },
        { time: 1620, type: 'DIVER_SWOOP',     spawned: false },
        { time: 1710, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 1710, type: 'FLANK_RIGHT',     y: 400, spawned: false },
        { time: 1800, type: 'WALL',            spawned: false },
        { time: 1890, type: 'SLOW_CIRCLE',     spawned: false },
        { time: 1890, type: 'SWEEP_LEFT',      spawned: false },
        { time: 1940, type: 'WALL',            spawned: false },
        { time: 2030,    type: 'SHIELD_WALL',     spawned: false },
        { time: 2111,  type: 'V_SHAPE',         spawned: false },
        { time: 2192,  type: 'WALL',            spawned: false },
        { time: 2273, type: 'DIVER_SWOOP',     spawned: false },
        { time: 2354, type: 'CIRCLE',          spawned: false },
        { time: 2435, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 2435, type: 'FLANK_RIGHT',     y: 350, spawned: false },
        { time: 2516, type: 'SHIELD_WALL',     spawned: false },
        { time: 2597, type: 'SWEEP_LEFT',      spawned: false },
        { time: 2597, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 2678, type: 'V_SHAPE',         spawned: false },
        { time: 2759, type: 'DIVER_SWOOP',     spawned: false },
        { time: 2759, type: 'DIVER_SWOOP',     spawned: false },
        // { time: 2840, type: 'MID_BOSS_PINGKO', spawned: false },
        { time: 2921, type: 'DIVER_SWOOP',     spawned: false },
        { time: 3002, type: 'WALL',            spawned: false },
        { time: 3083, type: 'FLANK_LEFT',      y: 300, spawned: false },
        { time: 3083, type: 'FLANK_RIGHT',     y: 300, spawned: false },
        { time: 3164, type: 'SWEEP_LEFT',      spawned: false },
        { time: 3164, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 3245, type: 'CIRCLE',          spawned: false },
        { time: 3326, type: 'SHIELD_WALL',     spawned: false },
        { time: 3407, type: 'V_SHAPE',         spawned: false },
        { time: 3488, type: 'DIVER_SWOOP',     spawned: false },
        { time: 3488, type: 'DIVER_SWOOP',     spawned: false },
        { time: 3569, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 3569, type: 'FLANK_RIGHT',     y: 400, spawned: false },
        { time: 3650, type: 'WALL',            spawned: false },
        { time: 3731, type: 'SLOW_CIRCLE',     spawned: false },
        { time: 3731, type: 'SWEEP_LEFT',      spawned: false },
        { time: 3776, type: 'WALL',            spawned: false },
        { time: 3866,    type: 'SHIELD_WALL',     spawned: false },
        { time: 3938,  type: 'V_SHAPE',         spawned: false },
        { time: 4010,  type: 'WALL',            spawned: false },
        { time: 4082, type: 'DIVER_SWOOP',     spawned: false },
        { time: 4154, type: 'CIRCLE',          spawned: false },
        { time: 4226, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 4226, type: 'FLANK_RIGHT',     y: 350, spawned: false },
        { time: 4298, type: 'SHIELD_WALL',     spawned: false },
        { time: 4370, type: 'SWEEP_LEFT',      spawned: false },
        { time: 4370, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 4442, type: 'V_SHAPE',         spawned: false },
        { time: 4514, type: 'DIVER_SWOOP',     spawned: false },
        { time: 4514, type: 'DIVER_SWOOP',     spawned: false },
        { time: 4586, type: 'MID_BOSS_PINGKO', spawned: false },
        { time: 4658, type: 'DIVER_SWOOP',     spawned: false },
        { time: 4730, type: 'WALL',            spawned: false },
        { time: 4802, type: 'FLANK_LEFT',      y: 300, spawned: false },
        { time: 4802, type: 'FLANK_RIGHT',     y: 300, spawned: false },
        { time: 4874, type: 'SWEEP_LEFT',      spawned: false },
        { time: 4874, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 4946, type: 'CIRCLE',          spawned: false },
        { time: 5018, type: 'SHIELD_WALL',     spawned: false },
        { time: 5090, type: 'V_SHAPE',         spawned: false },
        { time: 5162, type: 'DIVER_SWOOP',     spawned: false },
        { time: 5162, type: 'DIVER_SWOOP',     spawned: false },
        { time: 5234, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 5234, type: 'FLANK_RIGHT',     y: 400, spawned: false },
        { time: 5306, type: 'WALL',            spawned: false },
        { time: 5378, type: 'SLOW_CIRCLE',     spawned: false },
        { time: 5378, type: 'SWEEP_LEFT',      spawned: false },
        { time: 5418, type: 'WALL',            spawned: false },
        { time: 5508,    type: 'SHIELD_WALL',     spawned: false },
        { time: 5571,  type: 'V_SHAPE',         spawned: false },
        { time: 5634,  type: 'WALL',            spawned: false },
        { time: 5697, type: 'DIVER_SWOOP',     spawned: false },
        { time: 5760, type: 'CIRCLE',          spawned: false },
        { time: 5823, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 5823, type: 'FLANK_RIGHT',     y: 350, spawned: false },
        { time: 5886, type: 'SHIELD_WALL',     spawned: false },
        { time: 5949, type: 'SWEEP_LEFT',      spawned: false },
        { time: 5949, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 6012, type: 'V_SHAPE',         spawned: false },
        { time: 6075, type: 'DIVER_SWOOP',     spawned: false },
        { time: 6075, type: 'DIVER_SWOOP',     spawned: false },
        // { time: 6138, type: 'MID_BOSS_PINGKO', spawned: false },
        { time: 6201, type: 'DIVER_SWOOP',     spawned: false },
        { time: 6264, type: 'WALL',            spawned: false },
        { time: 6327, type: 'FLANK_LEFT',      y: 300, spawned: false },
        { time: 6327, type: 'FLANK_RIGHT',     y: 300, spawned: false },
        { time: 6390, type: 'SWEEP_LEFT',      spawned: false },
        { time: 6390, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 6453, type: 'CIRCLE',          spawned: false },
        { time: 6516, type: 'SHIELD_WALL',     spawned: false },
        { time: 6579, type: 'V_SHAPE',         spawned: false },
        { time: 6642, type: 'DIVER_SWOOP',     spawned: false },
        { time: 6642, type: 'DIVER_SWOOP',     spawned: false },
        { time: 6705, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 6705, type: 'FLANK_RIGHT',     y: 400, spawned: false },
        { time: 6768, type: 'WALL',            spawned: false },
        { time: 6831, type: 'SLOW_CIRCLE',     spawned: false },
        { time: 6831, type: 'SWEEP_LEFT',      spawned: false },
        { time: 6866, type: 'WALL',            spawned: false },
        { time: 6956,    type: 'SHIELD_WALL',     spawned: false },
        { time: 7014,  type: 'V_SHAPE',         spawned: false },
        { time: 7073,  type: 'WALL',            spawned: false },
        { time: 7131, type: 'DIVER_SWOOP',     spawned: false },
        { time: 7190, type: 'CIRCLE',          spawned: false },
        { time: 7248, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 7248, type: 'FLANK_RIGHT',     y: 350, spawned: false },
        { time: 7307, type: 'SHIELD_WALL',     spawned: false },
        { time: 7365, type: 'SWEEP_LEFT',      spawned: false },
        { time: 7365, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 7424, type: 'V_SHAPE',         spawned: false },
        { time: 7482, type: 'DIVER_SWOOP',     spawned: false },
        { time: 7482, type: 'DIVER_SWOOP',     spawned: false },
        // { time: 7541, type: 'MID_BOSS_PINGKO', spawned: false },
        { time: 7599, type: 'DIVER_SWOOP',     spawned: false },
        { time: 7658, type: 'WALL',            spawned: false },
        { time: 7716, type: 'FLANK_LEFT',      y: 300, spawned: false },
        { time: 7716, type: 'FLANK_RIGHT',     y: 300, spawned: false },
        { time: 7775, type: 'SWEEP_LEFT',      spawned: false },
        { time: 7775, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 7833, type: 'CIRCLE',          spawned: false },
        { time: 7892, type: 'SHIELD_WALL',     spawned: false },
        { time: 7950, type: 'V_SHAPE',         spawned: false },
        { time: 8009, type: 'DIVER_SWOOP',     spawned: false },
        { time: 8009, type: 'DIVER_SWOOP',     spawned: false },
        { time: 8067, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 8067, type: 'FLANK_RIGHT',     y: 400, spawned: false },
        { time: 8126, type: 'WALL',            spawned: false },
        { time: 8184, type: 'SLOW_CIRCLE',     spawned: false },
        { time: 8184, type: 'SWEEP_LEFT',      spawned: false },
        { time: 8217, type: 'WALL',            spawned: false },
        { time: 8307,    type: 'SHIELD_WALL',     spawned: false },
        { time: 8365,  type: 'V_SHAPE',         spawned: false },
        { time: 8424,  type: 'WALL',            spawned: false },
        { time: 8482, type: 'DIVER_SWOOP',     spawned: false },
        { time: 8541, type: 'CIRCLE',          spawned: false },
        { time: 8599, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 8599, type: 'FLANK_RIGHT',     y: 350, spawned: false },
        { time: 8658, type: 'SHIELD_WALL',     spawned: false },
        { time: 8716, type: 'SWEEP_LEFT',      spawned: false },
        { time: 8716, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 8775, type: 'V_SHAPE',         spawned: false },
        { time: 8833, type: 'DIVER_SWOOP',     spawned: false },
        { time: 8833, type: 'DIVER_SWOOP',     spawned: false },
        // { time: 8892, type: 'MID_BOSS_PINGKO', spawned: false },
        { time: 8950, type: 'DIVER_SWOOP',     spawned: false },
        { time: 9009, type: 'WALL',            spawned: false },
        { time: 9067, type: 'FLANK_LEFT',      y: 300, spawned: false },
        { time: 9067, type: 'FLANK_RIGHT',     y: 300, spawned: false },
        { time: 9126, type: 'SWEEP_LEFT',      spawned: false },
        { time: 9126, type: 'SWEEP_RIGHT',     spawned: false },
        { time: 9184, type: 'CIRCLE',          spawned: false },
        { time: 9243, type: 'SHIELD_WALL',     spawned: false },
        { time: 9301, type: 'V_SHAPE',         spawned: false },
        { time: 9360, type: 'DIVER_SWOOP',     spawned: false },
        { time: 9360, type: 'DIVER_SWOOP',     spawned: false },
        { time: 9418, type: 'FLANK_LEFT',      y: 150, spawned: false },
        { time: 9418, type: 'FLANK_RIGHT',     y: 400, spawned: false },
        { time: 9477, type: 'WALL',            spawned: false },
        { time: 9535, type: 'SLOW_CIRCLE',     spawned: false },
        { time: 9535, type: 'SWEEP_LEFT',      spawned: false },
        { time: 9568, type: 'WALL',            spawned: false },
        { time: 9658,    type: 'SHIELD_WALL',     spawned: false },
],
    4: [
        { time: 0,    type: 'SHIELD_WALL', spawned: false },
        { time: 90,  type: 'DIVER_SWOOP', spawned: false },
        { time: 180,  type: 'DIVER_SWOOP', spawned: false },
        { time: 270,  type: 'CIRCLE',      spawned: false },
        { time: 270,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 360,  type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 360,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 450, type: 'WALL',        spawned: false },
        { time: 540, type: 'V_SHAPE',     spawned: false },
        { time: 630, type: 'DIVER_SWOOP', spawned: false },
        { time: 720, type: 'SWEEP_LEFT',  spawned: false },
        { time: 720, type: 'SWEEP_RIGHT', spawned: false },
        { time: 810, type: 'SHIELD_WALL', spawned: false },
        { time: 900, type: 'CIRCLE',      spawned: false },
        { time: 990, type: 'DIVER_SWOOP', spawned: false },
        { time: 990, type: 'DIVER_SWOOP', spawned: false },
        { time: 1080, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 1080, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 1170, type: 'WALL',        spawned: false },
        { time: 1260, type: 'V_SHAPE',     spawned: false },
        { time: 1350, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1350, type: 'SWEEP_RIGHT', spawned: false },
        { time: 1440, type: 'SHIELD_WALL', spawned: false },
        { time: 1530, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1530, type: 'DIVER_SWOOP', spawned: false },
        { time: 1620, type: 'WALL',        spawned: false },
        { time: 1710, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 1710, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 1800, type: 'CIRCLE',      spawned: false },
        { time: 1890, type: 'DIVER_SWOOP', spawned: false },
        { time: 1890, type: 'DIVER_SWOOP', spawned: false },
        { time: 1980, type: 'SHIELD_WALL', spawned: false },
        { time: 2070, type: 'V_SHAPE',     spawned: false },
        { time: 2160, type: 'SWEEP_LEFT',  spawned: false },
        { time: 2160, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2250, type: 'WALL',        spawned: false },
        { time: 2340, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2430, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 2430, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 2520, type: 'CIRCLE',      spawned: false },
        { time: 2610, type: 'DIVER_SWOOP', spawned: false },
        { time: 2610, type: 'DIVER_SWOOP', spawned: false },
        { time: 2700, type: 'SHIELD_WALL', spawned: false },
        { time: 2790, type: 'V_SHAPE',    spawned: false },
        { time: 2880, type: 'SWEEP_LEFT', spawned: false },
        { time: 2880, type: 'SWEEP_RIGHT',spawned: false },
        { time: 2970, type: 'WALL',       spawned: false },
        { time: 3060, type: 'SLOW_CIRCLE',spawned: false },
        { time: 3060, type: 'DIVER_SWOOP',spawned: false },
        { time: 3150,    type: 'SHIELD_WALL', spawned: false },
        { time: 3231,  type: 'DIVER_SWOOP', spawned: false },
        { time: 3312,  type: 'DIVER_SWOOP', spawned: false },
        { time: 3393,  type: 'CIRCLE',      spawned: false },
        { time: 3393,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 3474,  type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 3474,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 3555, type: 'WALL',        spawned: false },
        { time: 3636, type: 'V_SHAPE',     spawned: false },
        { time: 3717, type: 'DIVER_SWOOP', spawned: false },
        { time: 3798, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3798, type: 'SWEEP_RIGHT', spawned: false },
        { time: 3879, type: 'SHIELD_WALL', spawned: false },
        { time: 3960, type: 'CIRCLE',      spawned: false },
        { time: 4041, type: 'DIVER_SWOOP', spawned: false },
        { time: 4041, type: 'DIVER_SWOOP', spawned: false },
        { time: 4122, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 4122, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 4203, type: 'WALL',        spawned: false },
        { time: 4284, type: 'V_SHAPE',     spawned: false },
        { time: 4365, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4365, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4446, type: 'SHIELD_WALL', spawned: false },
        { time: 4527, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4527, type: 'DIVER_SWOOP', spawned: false },
        { time: 4608, type: 'WALL',        spawned: false },
        { time: 4689, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 4689, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 4770, type: 'CIRCLE',      spawned: false },
        { time: 4851, type: 'DIVER_SWOOP', spawned: false },
        { time: 4851, type: 'DIVER_SWOOP', spawned: false },
        { time: 4932, type: 'SHIELD_WALL', spawned: false },
        { time: 5013, type: 'V_SHAPE',     spawned: false },
        { time: 5094, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5094, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5175, type: 'WALL',        spawned: false },
        { time: 5256, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5337, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 5337, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 5418, type: 'CIRCLE',      spawned: false },
        { time: 5499, type: 'DIVER_SWOOP', spawned: false },
        { time: 5499, type: 'DIVER_SWOOP', spawned: false },
        { time: 5580, type: 'SHIELD_WALL', spawned: false },
        { time: 5661, type: 'V_SHAPE',    spawned: false },
        { time: 5742, type: 'SWEEP_LEFT', spawned: false },
        { time: 5742, type: 'SWEEP_RIGHT',spawned: false },
        { time: 5823, type: 'WALL',       spawned: false },
        { time: 5904, type: 'SLOW_CIRCLE',spawned: false },
        { time: 5904, type: 'DIVER_SWOOP',spawned: false },
        { time: 5994,    type: 'SHIELD_WALL', spawned: false },
        { time: 6066,  type: 'DIVER_SWOOP', spawned: false },
        { time: 6138,  type: 'DIVER_SWOOP', spawned: false },
        { time: 6210,  type: 'CIRCLE',      spawned: false },
        { time: 6210,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 6282,  type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 6282,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 6354, type: 'WALL',        spawned: false },
        { time: 6426, type: 'V_SHAPE',     spawned: false },
        { time: 6498, type: 'DIVER_SWOOP', spawned: false },
        { time: 6570, type: 'SWEEP_LEFT',  spawned: false },
        { time: 6570, type: 'SWEEP_RIGHT', spawned: false },
        { time: 6642, type: 'SHIELD_WALL', spawned: false },
        { time: 6714, type: 'CIRCLE',      spawned: false },
        { time: 6786, type: 'DIVER_SWOOP', spawned: false },
        { time: 6786, type: 'DIVER_SWOOP', spawned: false },
        { time: 6858, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 6858, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 6930, type: 'WALL',        spawned: false },
        { time: 7002, type: 'V_SHAPE',     spawned: false },
        { time: 7074, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7074, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7146, type: 'SHIELD_WALL', spawned: false },
        { time: 7218, type: 'SLOW_CIRCLE', spawned: false },
        { time: 7218, type: 'DIVER_SWOOP', spawned: false },
        { time: 7290, type: 'WALL',        spawned: false },
        { time: 7362, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 7362, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 7434, type: 'CIRCLE',      spawned: false },
        { time: 7506, type: 'DIVER_SWOOP', spawned: false },
        { time: 7506, type: 'DIVER_SWOOP', spawned: false },
        { time: 7578, type: 'SHIELD_WALL', spawned: false },
        { time: 7650, type: 'V_SHAPE',     spawned: false },
        { time: 7722, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7722, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7794, type: 'WALL',        spawned: false },
        { time: 7866, type: 'SLOW_CIRCLE', spawned: false },
        { time: 7938, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 7938, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 8010, type: 'CIRCLE',      spawned: false },
        { time: 8082, type: 'DIVER_SWOOP', spawned: false },
        { time: 8082, type: 'DIVER_SWOOP', spawned: false },
        { time: 8154, type: 'SHIELD_WALL', spawned: false },
        { time: 8226, type: 'V_SHAPE',    spawned: false },
        { time: 8298, type: 'SWEEP_LEFT', spawned: false },
        { time: 8298, type: 'SWEEP_RIGHT',spawned: false },
        { time: 8370, type: 'WALL',       spawned: false },
        { time: 8442, type: 'SLOW_CIRCLE',spawned: false },
        { time: 8442, type: 'DIVER_SWOOP',spawned: false },
        { time: 8532,    type: 'SHIELD_WALL', spawned: false },
        { time: 8595,  type: 'DIVER_SWOOP', spawned: false },
        { time: 8658,  type: 'DIVER_SWOOP', spawned: false },
        { time: 8721,  type: 'CIRCLE',      spawned: false },
        { time: 8721,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 8784,  type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 8784,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 8847, type: 'WALL',        spawned: false },
        { time: 8910, type: 'V_SHAPE',     spawned: false },
        { time: 8973, type: 'DIVER_SWOOP', spawned: false },
        { time: 9036, type: 'SWEEP_LEFT',  spawned: false },
        { time: 9036, type: 'SWEEP_RIGHT', spawned: false },
        { time: 9099, type: 'SHIELD_WALL', spawned: false },
        { time: 9162, type: 'CIRCLE',      spawned: false },
        { time: 9225, type: 'DIVER_SWOOP', spawned: false },
        { time: 9225, type: 'DIVER_SWOOP', spawned: false },
        { time: 9288, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 9288, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 9351, type: 'WALL',        spawned: false },
        { time: 9414, type: 'V_SHAPE',     spawned: false },
        { time: 9477, type: 'SWEEP_LEFT',  spawned: false },
        { time: 9477, type: 'SWEEP_RIGHT', spawned: false },
        { time: 9540, type: 'SHIELD_WALL', spawned: false },
        { time: 9603, type: 'SLOW_CIRCLE', spawned: false },
        { time: 9603, type: 'DIVER_SWOOP', spawned: false },
        { time: 9666, type: 'WALL',        spawned: false },
        { time: 9729, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 9729, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 9792, type: 'CIRCLE',      spawned: false },
        { time: 9855, type: 'DIVER_SWOOP', spawned: false },
        { time: 9855, type: 'DIVER_SWOOP', spawned: false },
        { time: 9918, type: 'SHIELD_WALL', spawned: false },
        { time: 9981, type: 'V_SHAPE',     spawned: false },
        { time: 10044, type: 'SWEEP_LEFT',  spawned: false },
        { time: 10044, type: 'SWEEP_RIGHT', spawned: false },
        { time: 10107, type: 'WALL',        spawned: false },
        { time: 10170, type: 'SLOW_CIRCLE', spawned: false },
        { time: 10233, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 10233, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 10296, type: 'CIRCLE',      spawned: false },
        { time: 10359, type: 'DIVER_SWOOP', spawned: false },
        { time: 10359, type: 'DIVER_SWOOP', spawned: false },
        { time: 10422, type: 'SHIELD_WALL', spawned: false },
        { time: 10485, type: 'V_SHAPE',    spawned: false },
        { time: 10548, type: 'SWEEP_LEFT', spawned: false },
        { time: 10548, type: 'SWEEP_RIGHT',spawned: false },
        { time: 10611, type: 'WALL',       spawned: false },
        { time: 10674, type: 'SLOW_CIRCLE',spawned: false },
        { time: 10674, type: 'DIVER_SWOOP',spawned: false },
        { time: 10764,    type: 'SHIELD_WALL', spawned: false },
        { time: 10822,  type: 'DIVER_SWOOP', spawned: false },
        { time: 10881,  type: 'DIVER_SWOOP', spawned: false },
        { time: 10939,  type: 'CIRCLE',      spawned: false },
        { time: 10939,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 10998,  type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 10998,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 11056, type: 'WALL',        spawned: false },
        { time: 11115, type: 'V_SHAPE',     spawned: false },
        { time: 11173, type: 'DIVER_SWOOP', spawned: false },
        { time: 11232, type: 'SWEEP_LEFT',  spawned: false },
        { time: 11232, type: 'SWEEP_RIGHT', spawned: false },
        { time: 11290, type: 'SHIELD_WALL', spawned: false },
        { time: 11349, type: 'CIRCLE',      spawned: false },
        { time: 11407, type: 'DIVER_SWOOP', spawned: false },
        { time: 11407, type: 'DIVER_SWOOP', spawned: false },
        { time: 11466, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 11466, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 11524, type: 'WALL',        spawned: false },
        { time: 11583, type: 'V_SHAPE',     spawned: false },
        { time: 11641, type: 'SWEEP_LEFT',  spawned: false },
        { time: 11641, type: 'SWEEP_RIGHT', spawned: false },
        { time: 11700, type: 'SHIELD_WALL', spawned: false },
],
    5: [
        { time: 0,    type: 'SWEEP_LEFT',  spawned: false },
        { time: 0,    type: 'SWEEP_RIGHT', spawned: false },
        { time: 90,  type: 'DIVER_SWOOP', spawned: false },
        { time: 180,  type: 'DIVER_SWOOP', spawned: false },
        { time: 270,  type: 'DIVER_SWOOP', spawned: false },
        { time: 360,  type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 360,  type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 450,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 450,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 540, type: 'V_SHAPE',     spawned: false },
        { time: 630, type: 'DIVER_SWOOP', spawned: false },
        { time: 630, type: 'DIVER_SWOOP', spawned: false },
        { time: 720, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 720, type: 'FLANK_RIGHT', y: 200, spawned: false },
        { time: 810, type: 'SWEEP_LEFT',  spawned: false },
        { time: 810, type: 'SWEEP_RIGHT', spawned: false },
        { time: 900, type: 'DIVER_SWOOP', spawned: false },
        { time: 990, type: 'DIVER_SWOOP', spawned: false },
        { time: 1080, type: 'V_SHAPE',     spawned: false },
        { time: 1170, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 1170, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 1260, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1260, type: 'SWEEP_RIGHT', spawned: false },
        { time: 1350, type: 'DIVER_SWOOP', spawned: false },
        { time: 1350, type: 'DIVER_SWOOP', spawned: false },
        { time: 1440, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 1440, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 1530, type: 'DIVER_SWOOP', spawned: false },
        { time: 1620, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1620, type: 'SWEEP_RIGHT', spawned: false },
        { time: 1710, type: 'V_SHAPE',     spawned: false },
        { time: 1800, type: 'DIVER_SWOOP', spawned: false },
        { time: 1800, type: 'DIVER_SWOOP', spawned: false },
        { time: 1890, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1890, type: 'SWEEP_RIGHT', spawned: false },
        { time: 1980, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 1980, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 2070, type: 'DIVER_SWOOP', spawned: false },
        { time: 2070, type: 'DIVER_SWOOP', spawned: false },
        { time: 2160, type: 'V_SHAPE',     spawned: false },
        { time: 2250, type: 'SWEEP_LEFT',  spawned: false },
        { time: 2250, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2340, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 2340, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 2430, type: 'DIVER_SWOOP', spawned: false },
        { time: 2520, type: 'SWEEP_LEFT',  spawned: false },
        { time: 2520, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2610, type: 'V_SHAPE',     spawned: false },
        { time: 2610, type: 'DIVER_SWOOP', spawned: false },
        { time: 2700, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 2700, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 2790, type: 'SWEEP_LEFT',  spawned: false },
        { time: 2790, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2880, type: 'DIVER_SWOOP', spawned: false },
        { time: 2880, type: 'DIVER_SWOOP', spawned: false },
        { time: 2970, type: 'V_SHAPE',     spawned: false },
        { time: 3060, type: 'FLANK_LEFT', y: 150, spawned: false },
        { time: 3060, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 3150, type: 'DIVER_SWOOP',spawned: false },
        { time: 3240, type: 'SWEEP_LEFT', spawned: false },
        { time: 3240, type: 'SWEEP_RIGHT',spawned: false },
        { time: 3330, type: 'DIVER_SWOOP',spawned: false },
        { time: 3330, type: 'DIVER_SWOOP',spawned: false },
        { time: 3420,    type: 'SWEEP_LEFT',  spawned: false },
        { time: 3420,    type: 'SWEEP_RIGHT', spawned: false },
        { time: 3501,  type: 'DIVER_SWOOP', spawned: false },
        { time: 3582,  type: 'DIVER_SWOOP', spawned: false },
        { time: 3663,  type: 'DIVER_SWOOP', spawned: false },
        { time: 3744,  type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 3744,  type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 3825,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 3825,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 3906, type: 'V_SHAPE',     spawned: false },
        { time: 3987, type: 'DIVER_SWOOP', spawned: false },
        { time: 3987, type: 'DIVER_SWOOP', spawned: false },
        { time: 4068, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 4068, type: 'FLANK_RIGHT', y: 200, spawned: false },
        { time: 4149, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4149, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4230, type: 'DIVER_SWOOP', spawned: false },
        { time: 4311, type: 'DIVER_SWOOP', spawned: false },
        { time: 4392, type: 'V_SHAPE',     spawned: false },
        { time: 4473, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 4473, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 4554, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4554, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4635, type: 'DIVER_SWOOP', spawned: false },
        { time: 4635, type: 'DIVER_SWOOP', spawned: false },
        { time: 4716, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 4716, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 4797, type: 'DIVER_SWOOP', spawned: false },
        { time: 4878, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4878, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4959, type: 'V_SHAPE',     spawned: false },
        { time: 5040, type: 'DIVER_SWOOP', spawned: false },
        { time: 5040, type: 'DIVER_SWOOP', spawned: false },
        { time: 5121, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5121, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5202, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 5202, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 5283, type: 'DIVER_SWOOP', spawned: false },
        { time: 5283, type: 'DIVER_SWOOP', spawned: false },
        { time: 5364, type: 'V_SHAPE',     spawned: false },
        { time: 5445, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5445, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5526, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 5526, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 5607, type: 'DIVER_SWOOP', spawned: false },
        { time: 5688, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5688, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5769, type: 'V_SHAPE',     spawned: false },
        { time: 5769, type: 'DIVER_SWOOP', spawned: false },
        { time: 5850, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 5850, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 5931, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5931, type: 'SWEEP_RIGHT', spawned: false },
        { time: 6012, type: 'DIVER_SWOOP', spawned: false },
        { time: 6012, type: 'DIVER_SWOOP', spawned: false },
        { time: 6093, type: 'V_SHAPE',     spawned: false },
        { time: 6174, type: 'FLANK_LEFT', y: 150, spawned: false },
        { time: 6174, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 6255, type: 'DIVER_SWOOP',spawned: false },
        { time: 6336, type: 'SWEEP_LEFT', spawned: false },
        { time: 6336, type: 'SWEEP_RIGHT',spawned: false },
        { time: 6417, type: 'DIVER_SWOOP',spawned: false },
        { time: 6417, type: 'DIVER_SWOOP',spawned: false },
        { time: 6507,    type: 'SWEEP_LEFT',  spawned: false },
        { time: 6507,    type: 'SWEEP_RIGHT', spawned: false },
        { time: 6579,  type: 'DIVER_SWOOP', spawned: false },
        { time: 6651,  type: 'DIVER_SWOOP', spawned: false },
        { time: 6723,  type: 'DIVER_SWOOP', spawned: false },
        { time: 6795,  type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 6795,  type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 6867,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 6867,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 6939, type: 'V_SHAPE',     spawned: false },
        { time: 7011, type: 'DIVER_SWOOP', spawned: false },
        { time: 7011, type: 'DIVER_SWOOP', spawned: false },
        { time: 7083, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 7083, type: 'FLANK_RIGHT', y: 200, spawned: false },
        { time: 7155, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7155, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7227, type: 'DIVER_SWOOP', spawned: false },
        { time: 7299, type: 'DIVER_SWOOP', spawned: false },
        { time: 7371, type: 'V_SHAPE',     spawned: false },
        { time: 7443, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 7443, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 7515, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7515, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7587, type: 'DIVER_SWOOP', spawned: false },
        { time: 7587, type: 'DIVER_SWOOP', spawned: false },
        { time: 7659, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 7659, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 7731, type: 'DIVER_SWOOP', spawned: false },
        { time: 7803, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7803, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7875, type: 'V_SHAPE',     spawned: false },
        { time: 7947, type: 'DIVER_SWOOP', spawned: false },
        { time: 7947, type: 'DIVER_SWOOP', spawned: false },
        { time: 8019, type: 'SWEEP_LEFT',  spawned: false },
        { time: 8019, type: 'SWEEP_RIGHT', spawned: false },
        { time: 8091, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 8091, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 8163, type: 'DIVER_SWOOP', spawned: false },
        { time: 8163, type: 'DIVER_SWOOP', spawned: false },
        { time: 8235, type: 'V_SHAPE',     spawned: false },
        { time: 8307, type: 'SWEEP_LEFT',  spawned: false },
        { time: 8307, type: 'SWEEP_RIGHT', spawned: false },
        { time: 8379, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 8379, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 8451, type: 'DIVER_SWOOP', spawned: false },
        { time: 8523, type: 'SWEEP_LEFT',  spawned: false },
        { time: 8523, type: 'SWEEP_RIGHT', spawned: false },
        { time: 8595, type: 'V_SHAPE',     spawned: false },
        { time: 8595, type: 'DIVER_SWOOP', spawned: false },
        { time: 8667, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 8667, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 8739, type: 'SWEEP_LEFT',  spawned: false },
        { time: 8739, type: 'SWEEP_RIGHT', spawned: false },
        { time: 8811, type: 'DIVER_SWOOP', spawned: false },
        { time: 8811, type: 'DIVER_SWOOP', spawned: false },
        { time: 8883, type: 'V_SHAPE',     spawned: false },
        { time: 8955, type: 'FLANK_LEFT', y: 150, spawned: false },
        { time: 8955, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 9027, type: 'DIVER_SWOOP',spawned: false },
        { time: 9099, type: 'SWEEP_LEFT', spawned: false },
        { time: 9099, type: 'SWEEP_RIGHT',spawned: false },
        { time: 9171, type: 'DIVER_SWOOP',spawned: false },
        { time: 9171, type: 'DIVER_SWOOP',spawned: false },
        { time: 9261,    type: 'SWEEP_LEFT',  spawned: false },
        { time: 9261,    type: 'SWEEP_RIGHT', spawned: false },
        { time: 9324,  type: 'DIVER_SWOOP', spawned: false },
        { time: 9387,  type: 'DIVER_SWOOP', spawned: false },
        { time: 9450,  type: 'DIVER_SWOOP', spawned: false },
        { time: 9513,  type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 9513,  type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 9576,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 9576,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 9639, type: 'V_SHAPE',     spawned: false },
        { time: 9702, type: 'DIVER_SWOOP', spawned: false },
        { time: 9702, type: 'DIVER_SWOOP', spawned: false },
        { time: 9765, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 9765, type: 'FLANK_RIGHT', y: 200, spawned: false },
        { time: 9828, type: 'SWEEP_LEFT',  spawned: false },
        { time: 9828, type: 'SWEEP_RIGHT', spawned: false },
        { time: 9891, type: 'DIVER_SWOOP', spawned: false },
        { time: 9954, type: 'DIVER_SWOOP', spawned: false },
        { time: 10017, type: 'V_SHAPE',     spawned: false },
        { time: 10080, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 10080, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 10143, type: 'SWEEP_LEFT',  spawned: false },
        { time: 10143, type: 'SWEEP_RIGHT', spawned: false },
        { time: 10206, type: 'DIVER_SWOOP', spawned: false },
        { time: 10206, type: 'DIVER_SWOOP', spawned: false },
        { time: 10269, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 10269, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 10332, type: 'DIVER_SWOOP', spawned: false },
        { time: 10395, type: 'SWEEP_LEFT',  spawned: false },
        { time: 10395, type: 'SWEEP_RIGHT', spawned: false },
        { time: 10458, type: 'V_SHAPE',     spawned: false },
        { time: 10521, type: 'DIVER_SWOOP', spawned: false },
        { time: 10521, type: 'DIVER_SWOOP', spawned: false },
        { time: 10584, type: 'SWEEP_LEFT',  spawned: false },
        { time: 10584, type: 'SWEEP_RIGHT', spawned: false },
        { time: 10647, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 10647, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 10710, type: 'DIVER_SWOOP', spawned: false },
        { time: 10710, type: 'DIVER_SWOOP', spawned: false },
        { time: 10773, type: 'V_SHAPE',     spawned: false },
        { time: 10836, type: 'SWEEP_LEFT',  spawned: false },
        { time: 10836, type: 'SWEEP_RIGHT', spawned: false },
        { time: 10899, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 10899, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 10962, type: 'DIVER_SWOOP', spawned: false },
        { time: 11025, type: 'SWEEP_LEFT',  spawned: false },
        { time: 11025, type: 'SWEEP_RIGHT', spawned: false },
        { time: 11088, type: 'V_SHAPE',     spawned: false },
        { time: 11088, type: 'DIVER_SWOOP', spawned: false },
        { time: 11151, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 11151, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 11214, type: 'SWEEP_LEFT',  spawned: false },
        { time: 11214, type: 'SWEEP_RIGHT', spawned: false },
        { time: 11277, type: 'DIVER_SWOOP', spawned: false },
        { time: 11277, type: 'DIVER_SWOOP', spawned: false },
        { time: 11340, type: 'V_SHAPE',     spawned: false },
        { time: 11403, type: 'FLANK_LEFT', y: 150, spawned: false },
        { time: 11403, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 11466, type: 'DIVER_SWOOP',spawned: false },
        { time: 11529, type: 'SWEEP_LEFT', spawned: false },
        { time: 11529, type: 'SWEEP_RIGHT',spawned: false },
        { time: 11592, type: 'DIVER_SWOOP',spawned: false },
        { time: 11592, type: 'DIVER_SWOOP',spawned: false },
        { time: 11682,    type: 'SWEEP_LEFT',  spawned: false },
        { time: 11682,    type: 'SWEEP_RIGHT', spawned: false },
],
    6: [
        { time: 0,    type: 'SHIELD_WALL', spawned: false },
        { time: 0,    type: 'SHIELD_WALL', spawned: false },
        { time: 90,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 180,  type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 180,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 270,  type: 'SHIELD_WALL', spawned: false },
        { time: 360, type: 'SLOW_CIRCLE', spawned: false },
        { time: 360, type: 'SLOW_CIRCLE', spawned: false },
        { time: 450, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 450, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 540, type: 'SHIELD_WALL', spawned: false },
        { time: 630, type: 'SLOW_CIRCLE', spawned: false },
        { time: 720, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 720, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 810, type: 'SHIELD_WALL', spawned: false },
        { time: 900, type: 'SLOW_CIRCLE', spawned: false },
        { time: 900, type: 'SLOW_CIRCLE', spawned: false },
        { time: 990, type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 990, type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 1080, type: 'SHIELD_WALL', spawned: false },
        { time: 1170, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1260, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 1260, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 1350, type: 'SHIELD_WALL', spawned: false },
        { time: 1350, type: 'SHIELD_WALL', spawned: false },
        { time: 1440, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1440, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1530, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 1530, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 1620, type: 'SHIELD_WALL', spawned: false },
        { time: 1710, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1800, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 1800, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 1890, type: 'SHIELD_WALL', spawned: false },
        { time: 1980, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1980, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2070, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 2070, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 2160, type: 'SHIELD_WALL', spawned: false },
        { time: 2160, type: 'SHIELD_WALL', spawned: false },
        { time: 2250, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2340, type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 2340, type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 2430, type: 'SHIELD_WALL', spawned: false },
        { time: 2520, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2520, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2610, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 2610, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 2700, type: 'SHIELD_WALL', spawned: false },
        { time: 2790, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2880, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 2880, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 2970, type: 'SHIELD_WALL', spawned: false },
        { time: 2970, type: 'SHIELD_WALL', spawned: false },
        { time: 3060, type: 'SLOW_CIRCLE', spawned: false },
        { time: 3060, type: 'SLOW_CIRCLE', spawned: false },
        { time: 3150, type: 'FLANK_LEFT', y: 100, spawned: false },
        { time: 3150, type: 'FLANK_RIGHT',y: 400, spawned: false },
        { time: 3240, type: 'SHIELD_WALL',spawned: false },
        { time: 3330, type: 'SLOW_CIRCLE',spawned: false },
        { time: 3420, type: 'FLANK_LEFT', y: 200, spawned: false },
        { time: 3420, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 3510, type: 'SHIELD_WALL',spawned: false },
        { time: 3600, type: 'SLOW_CIRCLE',spawned: false },
        { time: 3600, type: 'SLOW_CIRCLE',spawned: false },
        { time: 3690, type: 'FLANK_LEFT', y: 150, spawned: false },
        { time: 3690, type: 'FLANK_RIGHT',y: 350, spawned: false },
        { time: 3780, type: 'SHIELD_WALL',spawned: false },
        { time: 3870, type: 'SLOW_CIRCLE',spawned: false },
        { time: 3960, type: 'FLANK_LEFT', y: 250, spawned: false },
        { time: 3960, type: 'FLANK_RIGHT',y: 250, spawned: false },
        { time: 4050, type: 'SHIELD_WALL',spawned: false },
        { time: 4140, type: 'SLOW_CIRCLE',spawned: false },
        { time: 4230,    type: 'SHIELD_WALL', spawned: false },
        { time: 4230,    type: 'SHIELD_WALL', spawned: false },
        { time: 4311,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 4392,  type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 4392,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 4473,  type: 'SHIELD_WALL', spawned: false },
        { time: 4554, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4554, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4635, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 4635, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 4716, type: 'SHIELD_WALL', spawned: false },
        { time: 4797, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4878, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 4878, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 4959, type: 'SHIELD_WALL', spawned: false },
        { time: 5040, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5040, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5121, type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 5121, type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 5202, type: 'SHIELD_WALL', spawned: false },
        { time: 5283, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5364, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 5364, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 5445, type: 'SHIELD_WALL', spawned: false },
        { time: 5445, type: 'SHIELD_WALL', spawned: false },
        { time: 5526, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5526, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5607, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 5607, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 5688, type: 'SHIELD_WALL', spawned: false },
        { time: 5769, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5850, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 5850, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 5931, type: 'SHIELD_WALL', spawned: false },
        { time: 6012, type: 'SLOW_CIRCLE', spawned: false },
        { time: 6012, type: 'SLOW_CIRCLE', spawned: false },
        { time: 6093, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 6093, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 6174, type: 'SHIELD_WALL', spawned: false },
        { time: 6174, type: 'SHIELD_WALL', spawned: false },
        { time: 6255, type: 'SLOW_CIRCLE', spawned: false },
        { time: 6336, type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 6336, type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 6417, type: 'SHIELD_WALL', spawned: false },
        { time: 6498, type: 'SLOW_CIRCLE', spawned: false },
        { time: 6498, type: 'SLOW_CIRCLE', spawned: false },
        { time: 6579, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 6579, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 6660, type: 'SHIELD_WALL', spawned: false },
        { time: 6741, type: 'SLOW_CIRCLE', spawned: false },
        { time: 6822, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 6822, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 6903, type: 'SHIELD_WALL', spawned: false },
        { time: 6903, type: 'SHIELD_WALL', spawned: false },
        { time: 6984, type: 'SLOW_CIRCLE', spawned: false },
        { time: 6984, type: 'SLOW_CIRCLE', spawned: false },
        { time: 7065, type: 'FLANK_LEFT', y: 100, spawned: false },
        { time: 7065, type: 'FLANK_RIGHT',y: 400, spawned: false },
        { time: 7146, type: 'SHIELD_WALL',spawned: false },
        { time: 7227, type: 'SLOW_CIRCLE',spawned: false },
        { time: 7308, type: 'FLANK_LEFT', y: 200, spawned: false },
        { time: 7308, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 7389, type: 'SHIELD_WALL',spawned: false },
        { time: 7470, type: 'SLOW_CIRCLE',spawned: false },
        { time: 7470, type: 'SLOW_CIRCLE',spawned: false },
        { time: 7551, type: 'FLANK_LEFT', y: 150, spawned: false },
        { time: 7551, type: 'FLANK_RIGHT',y: 350, spawned: false },
        { time: 7632, type: 'SHIELD_WALL',spawned: false },
        { time: 7713, type: 'SLOW_CIRCLE',spawned: false },
        { time: 7794, type: 'FLANK_LEFT', y: 250, spawned: false },
        { time: 7794, type: 'FLANK_RIGHT',y: 250, spawned: false },
        { time: 7875, type: 'SHIELD_WALL',spawned: false },
        { time: 7956, type: 'SLOW_CIRCLE',spawned: false },
        { time: 8046,    type: 'SHIELD_WALL', spawned: false },
        { time: 8046,    type: 'SHIELD_WALL', spawned: false },
        { time: 8118,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 8190,  type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 8190,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 8262,  type: 'SHIELD_WALL', spawned: false },
        { time: 8334, type: 'SLOW_CIRCLE', spawned: false },
        { time: 8334, type: 'SLOW_CIRCLE', spawned: false },
        { time: 8406, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 8406, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 8478, type: 'SHIELD_WALL', spawned: false },
        { time: 8550, type: 'SLOW_CIRCLE', spawned: false },
        { time: 8622, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 8622, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 8694, type: 'SHIELD_WALL', spawned: false },
        { time: 8766, type: 'SLOW_CIRCLE', spawned: false },
        { time: 8766, type: 'SLOW_CIRCLE', spawned: false },
        { time: 8838, type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 8838, type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 8910, type: 'SHIELD_WALL', spawned: false },
        { time: 8982, type: 'SLOW_CIRCLE', spawned: false },
        { time: 9054, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 9054, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 9126, type: 'SHIELD_WALL', spawned: false },
        { time: 9126, type: 'SHIELD_WALL', spawned: false },
        { time: 9198, type: 'SLOW_CIRCLE', spawned: false },
        { time: 9198, type: 'SLOW_CIRCLE', spawned: false },
        { time: 9270, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 9270, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 9342, type: 'SHIELD_WALL', spawned: false },
        { time: 9414, type: 'SLOW_CIRCLE', spawned: false },
        { time: 9486, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 9486, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 9558, type: 'SHIELD_WALL', spawned: false },
        { time: 9630, type: 'SLOW_CIRCLE', spawned: false },
        { time: 9630, type: 'SLOW_CIRCLE', spawned: false },
        { time: 9702, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 9702, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 9774, type: 'SHIELD_WALL', spawned: false },
        { time: 9774, type: 'SHIELD_WALL', spawned: false },
        { time: 9846, type: 'SLOW_CIRCLE', spawned: false },
        { time: 9918, type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 9918, type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 9990, type: 'SHIELD_WALL', spawned: false },
        { time: 10062, type: 'SLOW_CIRCLE', spawned: false },
        { time: 10062, type: 'SLOW_CIRCLE', spawned: false },
        { time: 10134, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 10134, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 10206, type: 'SHIELD_WALL', spawned: false },
        { time: 10278, type: 'SLOW_CIRCLE', spawned: false },
        { time: 10350, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 10350, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 10422, type: 'SHIELD_WALL', spawned: false },
        { time: 10422, type: 'SHIELD_WALL', spawned: false },
        { time: 10494, type: 'SLOW_CIRCLE', spawned: false },
        { time: 10494, type: 'SLOW_CIRCLE', spawned: false },
        { time: 10566, type: 'FLANK_LEFT', y: 100, spawned: false },
        { time: 10566, type: 'FLANK_RIGHT',y: 400, spawned: false },
        { time: 10638, type: 'SHIELD_WALL',spawned: false },
        { time: 10710, type: 'SLOW_CIRCLE',spawned: false },
        { time: 10782, type: 'FLANK_LEFT', y: 200, spawned: false },
        { time: 10782, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 10854, type: 'SHIELD_WALL',spawned: false },
        { time: 10926, type: 'SLOW_CIRCLE',spawned: false },
        { time: 10926, type: 'SLOW_CIRCLE',spawned: false },
        { time: 10998, type: 'FLANK_LEFT', y: 150, spawned: false },
        { time: 10998, type: 'FLANK_RIGHT',y: 350, spawned: false },
        { time: 11070, type: 'SHIELD_WALL',spawned: false },
        { time: 11142, type: 'SLOW_CIRCLE',spawned: false },
        { time: 11214, type: 'FLANK_LEFT', y: 250, spawned: false },
        { time: 11214, type: 'FLANK_RIGHT',y: 250, spawned: false },
        { time: 11286, type: 'SHIELD_WALL',spawned: false },
        { time: 11358, type: 'SLOW_CIRCLE',spawned: false },
        { time: 11448,    type: 'SHIELD_WALL', spawned: false },
        { time: 11448,    type: 'SHIELD_WALL', spawned: false },
        { time: 11511,  type: 'SLOW_CIRCLE', spawned: false },
        { time: 11574,  type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 11574,  type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 11637,  type: 'SHIELD_WALL', spawned: false },
        { time: 11700, type: 'SLOW_CIRCLE', spawned: false },
        { time: 11700, type: 'SLOW_CIRCLE', spawned: false },
        { time: 11763, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 11763, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 11826, type: 'SHIELD_WALL', spawned: false },
        { time: 11889, type: 'SLOW_CIRCLE', spawned: false },
        { time: 11952, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 11952, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 12015, type: 'SHIELD_WALL', spawned: false },
        { time: 12078, type: 'SLOW_CIRCLE', spawned: false },
        { time: 12078, type: 'SLOW_CIRCLE', spawned: false },
        { time: 12141, type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 12141, type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 12204, type: 'SHIELD_WALL', spawned: false },
        { time: 12267, type: 'SLOW_CIRCLE', spawned: false },
        { time: 12330, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 12330, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 12393, type: 'SHIELD_WALL', spawned: false },
        { time: 12393, type: 'SHIELD_WALL', spawned: false },
        { time: 12456, type: 'SLOW_CIRCLE', spawned: false },
        { time: 12456, type: 'SLOW_CIRCLE', spawned: false },
        { time: 12519, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 12519, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 12582, type: 'SHIELD_WALL', spawned: false },
        { time: 12645, type: 'SLOW_CIRCLE', spawned: false },
        { time: 12708, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 12708, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 12771, type: 'SHIELD_WALL', spawned: false },
        { time: 12834, type: 'SLOW_CIRCLE', spawned: false },
        { time: 12834, type: 'SLOW_CIRCLE', spawned: false },
        { time: 12897, type: 'FLANK_LEFT',  y: 100, spawned: false },
        { time: 12897, type: 'FLANK_RIGHT', y: 400, spawned: false },
        { time: 12960, type: 'SHIELD_WALL', spawned: false },
        { time: 12960, type: 'SHIELD_WALL', spawned: false },
        { time: 13023, type: 'SLOW_CIRCLE', spawned: false },
        { time: 13086, type: 'FLANK_LEFT',  y: 250, spawned: false },
        { time: 13086, type: 'FLANK_RIGHT', y: 250, spawned: false },
        { time: 13149, type: 'SHIELD_WALL', spawned: false },
        { time: 13212, type: 'SLOW_CIRCLE', spawned: false },
        { time: 13212, type: 'SLOW_CIRCLE', spawned: false },
        { time: 13275, type: 'FLANK_LEFT',  y: 200, spawned: false },
        { time: 13275, type: 'FLANK_RIGHT', y: 300, spawned: false },
        { time: 13338, type: 'SHIELD_WALL', spawned: false },
        { time: 13401, type: 'SLOW_CIRCLE', spawned: false },
        { time: 13464, type: 'FLANK_LEFT',  y: 150, spawned: false },
        { time: 13464, type: 'FLANK_RIGHT', y: 350, spawned: false },
        { time: 13527, type: 'SHIELD_WALL', spawned: false },
        { time: 13527, type: 'SHIELD_WALL', spawned: false },
        { time: 13590, type: 'SLOW_CIRCLE', spawned: false },
        { time: 13590, type: 'SLOW_CIRCLE', spawned: false },
        { time: 13653, type: 'FLANK_LEFT', y: 100, spawned: false },
        { time: 13653, type: 'FLANK_RIGHT',y: 400, spawned: false },
],
    7: [
        { time: 0,    type: 'CIRCLE', spawned: false },
        { time: 90,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 90,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 180,  type: 'WALL',  spawned: false },
        { time: 270, type: 'CIRCLE', spawned: false },
        { time: 360, type: 'FLANK_LEFT', y: 300, spawned: false },
        { time: 360, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 450, type: 'SWEEP_LEFT',  spawned: false },
        { time: 450, type: 'SWEEP_RIGHT', spawned: false },
        { time: 540, type: 'V_SHAPE',  spawned: false },
        { time: 630, type: 'SLOW_CIRCLE', spawned: false },
        { time: 630, type: 'CIRCLE', spawned: false },
        { time: 720, type: 'DIVER_SWOOP',  spawned: false },
        { time: 720, type: 'DIVER_SWOOP', spawned: false },
        { time: 810, type: 'SHIELD_WALL',  spawned: false },
        { time: 900, type: 'SLOW_CIRCLE', spawned: false },
        { time: 900, type: 'SWEEP_LEFT',  spawned: false },
        { time: 900, type: 'SWEEP_RIGHT', spawned: false },
        { time: 990, type: 'WALL',  spawned: false },
        { time: 990, type: 'V_SHAPE',  spawned: false },
        { time: 1080, type: 'CIRCLE', spawned: false },
        { time: 1170, type: 'FLANK_LEFT', y: 200,  spawned: false },
        { time: 1170, type: 'FLANK_RIGHT',y: 200, spawned: false },
        { time: 1260, type: 'FLANK_LEFT', y: 400, spawned: false },
        { time: 1260, type: 'FLANK_RIGHT',y: 400, spawned: false },
        { time: 1350, type: 'SHIELD_WALL',  spawned: false },
        { time: 1440, type: 'SLOW_CIRCLE', spawned: false },
        { time: 1440, type: 'DIVER_SWOOP',  spawned: false },
        { time: 1440, type: 'DIVER_SWOOP', spawned: false },
        { time: 1530, type: 'WALL',  spawned: false },
        { time: 1620, type: 'CIRCLE', spawned: false },
        { time: 1620, type: 'SWEEP_LEFT',  spawned: false },
        { time: 1620, type: 'SWEEP_RIGHT', spawned: false },
        { time: 1710, type: 'V_SHAPE',  spawned: false },
        { time: 1710, type: 'SHIELD_WALL', spawned: false },
        { time: 1800, type: 'DIVER_SWOOP',  spawned: false },
        { time: 1800, type: 'DIVER_SWOOP', spawned: false },
        { time: 1890,    type: 'CIRCLE', spawned: false },
        { time: 1971,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 1971,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 2052,  type: 'WALL',  spawned: false },
        { time: 2133, type: 'CIRCLE', spawned: false },
        { time: 2214, type: 'FLANK_LEFT', y: 300, spawned: false },
        { time: 2214, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 2295, type: 'SWEEP_LEFT',  spawned: false },
        { time: 2295, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2376, type: 'V_SHAPE',  spawned: false },
        { time: 2457, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2457, type: 'CIRCLE', spawned: false },
        { time: 2538, type: 'DIVER_SWOOP',  spawned: false },
        { time: 2538, type: 'DIVER_SWOOP', spawned: false },
        { time: 2619, type: 'SHIELD_WALL',  spawned: false },
        { time: 2700, type: 'SLOW_CIRCLE', spawned: false },
        { time: 2700, type: 'SWEEP_LEFT',  spawned: false },
        { time: 2700, type: 'SWEEP_RIGHT', spawned: false },
        { time: 2781, type: 'WALL',  spawned: false },
        { time: 2781, type: 'V_SHAPE',  spawned: false },
        { time: 2862, type: 'CIRCLE', spawned: false },
        { time: 2943, type: 'FLANK_LEFT', y: 200,  spawned: false },
        { time: 2943, type: 'FLANK_RIGHT',y: 200, spawned: false },
        { time: 3024, type: 'FLANK_LEFT', y: 400, spawned: false },
        { time: 3024, type: 'FLANK_RIGHT',y: 400, spawned: false },
        { time: 3105, type: 'SHIELD_WALL',  spawned: false },
        { time: 3186, type: 'SLOW_CIRCLE', spawned: false },
        { time: 3186, type: 'DIVER_SWOOP',  spawned: false },
        { time: 3186, type: 'DIVER_SWOOP', spawned: false },
        { time: 3267, type: 'WALL',  spawned: false },
        { time: 3348, type: 'CIRCLE', spawned: false },
        { time: 3348, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3348, type: 'SWEEP_RIGHT', spawned: false },
        { time: 3429, type: 'V_SHAPE',  spawned: false },
        { time: 3429, type: 'SHIELD_WALL', spawned: false },
        { time: 3510, type: 'DIVER_SWOOP',  spawned: false },
        { time: 3510, type: 'DIVER_SWOOP', spawned: false },
        { time: 3600,    type: 'CIRCLE', spawned: false },
        { time: 3672,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 3672,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 3744,  type: 'WALL',  spawned: false },
        { time: 3816, type: 'CIRCLE', spawned: false },
        { time: 3888, type: 'FLANK_LEFT', y: 300, spawned: false },
        { time: 3888, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 3960, type: 'SWEEP_LEFT',  spawned: false },
        { time: 3960, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4032, type: 'V_SHAPE',  spawned: false },
        { time: 4104, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4104, type: 'CIRCLE', spawned: false },
        { time: 4176, type: 'DIVER_SWOOP',  spawned: false },
        { time: 4176, type: 'DIVER_SWOOP', spawned: false },
        { time: 4248, type: 'SHIELD_WALL',  spawned: false },
        { time: 4320, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4320, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4320, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4392, type: 'WALL',  spawned: false },
        { time: 4392, type: 'V_SHAPE',  spawned: false },
        { time: 4464, type: 'CIRCLE', spawned: false },
        { time: 4536, type: 'FLANK_LEFT', y: 200,  spawned: false },
        { time: 4536, type: 'FLANK_RIGHT',y: 200, spawned: false },
        { time: 4608, type: 'FLANK_LEFT', y: 400, spawned: false },
        { time: 4608, type: 'FLANK_RIGHT',y: 400, spawned: false },
        { time: 4680, type: 'SHIELD_WALL',  spawned: false },
        { time: 4752, type: 'SLOW_CIRCLE', spawned: false },
        { time: 4752, type: 'DIVER_SWOOP',  spawned: false },
        { time: 4752, type: 'DIVER_SWOOP', spawned: false },
        { time: 4824, type: 'WALL',  spawned: false },
        { time: 4896, type: 'CIRCLE', spawned: false },
        { time: 4896, type: 'SWEEP_LEFT',  spawned: false },
        { time: 4896, type: 'SWEEP_RIGHT', spawned: false },
        { time: 4968, type: 'V_SHAPE',  spawned: false },
        { time: 4968, type: 'SHIELD_WALL', spawned: false },
        { time: 5040, type: 'DIVER_SWOOP',  spawned: false },
        { time: 5040, type: 'DIVER_SWOOP', spawned: false },
        { time: 5130,    type: 'CIRCLE', spawned: false },
        { time: 5193,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 5193,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 5256,  type: 'WALL',  spawned: false },
        { time: 5319, type: 'CIRCLE', spawned: false },
        { time: 5382, type: 'FLANK_LEFT', y: 300, spawned: false },
        { time: 5382, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 5445, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5445, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5508, type: 'V_SHAPE',  spawned: false },
        { time: 5571, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5571, type: 'CIRCLE', spawned: false },
        { time: 5634, type: 'DIVER_SWOOP',  spawned: false },
        { time: 5634, type: 'DIVER_SWOOP', spawned: false },
        { time: 5697, type: 'SHIELD_WALL',  spawned: false },
        { time: 5760, type: 'SLOW_CIRCLE', spawned: false },
        { time: 5760, type: 'SWEEP_LEFT',  spawned: false },
        { time: 5760, type: 'SWEEP_RIGHT', spawned: false },
        { time: 5823, type: 'WALL',  spawned: false },
        { time: 5823, type: 'V_SHAPE',  spawned: false },
        { time: 5886, type: 'CIRCLE', spawned: false },
        { time: 5949, type: 'FLANK_LEFT', y: 200,  spawned: false },
        { time: 5949, type: 'FLANK_RIGHT',y: 200, spawned: false },
        { time: 6012, type: 'FLANK_LEFT', y: 400, spawned: false },
        { time: 6012, type: 'FLANK_RIGHT',y: 400, spawned: false },
        { time: 6075, type: 'SHIELD_WALL',  spawned: false },
        { time: 6138, type: 'SLOW_CIRCLE', spawned: false },
        { time: 6138, type: 'DIVER_SWOOP',  spawned: false },
        { time: 6138, type: 'DIVER_SWOOP', spawned: false },
        { time: 6201, type: 'WALL',  spawned: false },
        { time: 6264, type: 'CIRCLE', spawned: false },
        { time: 6264, type: 'SWEEP_LEFT',  spawned: false },
        { time: 6264, type: 'SWEEP_RIGHT', spawned: false },
        { time: 6327, type: 'V_SHAPE',  spawned: false },
        { time: 6327, type: 'SHIELD_WALL', spawned: false },
        { time: 6390, type: 'DIVER_SWOOP',  spawned: false },
        { time: 6390, type: 'DIVER_SWOOP', spawned: false },
        { time: 6480,    type: 'CIRCLE', spawned: false },
        { time: 6538,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 6538,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 6597,  type: 'WALL',  spawned: false },
        { time: 6655, type: 'CIRCLE', spawned: false },
        { time: 6714, type: 'FLANK_LEFT', y: 300, spawned: false },
        { time: 6714, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 6772, type: 'SWEEP_LEFT',  spawned: false },
        { time: 6772, type: 'SWEEP_RIGHT', spawned: false },
        { time: 6831, type: 'V_SHAPE',  spawned: false },
        { time: 6889, type: 'SLOW_CIRCLE', spawned: false },
        { time: 6889, type: 'CIRCLE', spawned: false },
        { time: 6948, type: 'DIVER_SWOOP',  spawned: false },
        { time: 6948, type: 'DIVER_SWOOP', spawned: false },
        { time: 7006, type: 'SHIELD_WALL',  spawned: false },
        { time: 7065, type: 'SLOW_CIRCLE', spawned: false },
        { time: 7065, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7065, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7123, type: 'WALL',  spawned: false },
        { time: 7123, type: 'V_SHAPE',  spawned: false },
        { time: 7182, type: 'CIRCLE', spawned: false },
        { time: 7240, type: 'FLANK_LEFT', y: 200,  spawned: false },
        { time: 7240, type: 'FLANK_RIGHT',y: 200, spawned: false },
        { time: 7299, type: 'FLANK_LEFT', y: 400, spawned: false },
        { time: 7299, type: 'FLANK_RIGHT',y: 400, spawned: false },
        { time: 7357, type: 'SHIELD_WALL',  spawned: false },
        { time: 7416, type: 'SLOW_CIRCLE', spawned: false },
        { time: 7416, type: 'DIVER_SWOOP',  spawned: false },
        { time: 7416, type: 'DIVER_SWOOP', spawned: false },
        { time: 7474, type: 'WALL',  spawned: false },
        { time: 7533, type: 'CIRCLE', spawned: false },
        { time: 7533, type: 'SWEEP_LEFT',  spawned: false },
        { time: 7533, type: 'SWEEP_RIGHT', spawned: false },
        { time: 7591, type: 'V_SHAPE',  spawned: false },
        { time: 7591, type: 'SHIELD_WALL', spawned: false },
        { time: 7650, type: 'DIVER_SWOOP',  spawned: false },
        { time: 7650, type: 'DIVER_SWOOP', spawned: false },
        { time: 7740,    type: 'CIRCLE', spawned: false },
        { time: 7798,  type: 'SWEEP_LEFT',  spawned: false },
        { time: 7798,  type: 'SWEEP_RIGHT', spawned: false },
        { time: 7857,  type: 'WALL',  spawned: false },
        { time: 7915, type: 'CIRCLE', spawned: false },
        { time: 7974, type: 'FLANK_LEFT', y: 300, spawned: false },
        { time: 7974, type: 'FLANK_RIGHT',y: 300, spawned: false },
        { time: 8032, type: 'SWEEP_LEFT',  spawned: false },
        { time: 8032, type: 'SWEEP_RIGHT', spawned: false },
        { time: 8091, type: 'V_SHAPE',  spawned: false },
        { time: 8149, type: 'SLOW_CIRCLE', spawned: false },
        { time: 8149, type: 'CIRCLE', spawned: false },
        { time: 8208, type: 'DIVER_SWOOP',  spawned: false },
        { time: 8208, type: 'DIVER_SWOOP', spawned: false },
        { time: 8266, type: 'SHIELD_WALL',  spawned: false },
        { time: 8325, type: 'SLOW_CIRCLE', spawned: false },
        { time: 8325, type: 'SWEEP_LEFT',  spawned: false },
        { time: 8325, type: 'SWEEP_RIGHT', spawned: false },
        { time: 8383, type: 'WALL',  spawned: false },
        { time: 8383, type: 'V_SHAPE',  spawned: false },
        { time: 8442, type: 'CIRCLE', spawned: false },
        { time: 8500, type: 'FLANK_LEFT', y: 200,  spawned: false },
        { time: 8500, type: 'FLANK_RIGHT',y: 200, spawned: false },
        { time: 8559, type: 'FLANK_LEFT', y: 400, spawned: false },
        { time: 8559, type: 'FLANK_RIGHT',y: 400, spawned: false },
        { time: 8617, type: 'SHIELD_WALL',  spawned: false },
        { time: 8676, type: 'SLOW_CIRCLE', spawned: false },
        { time: 8676, type: 'DIVER_SWOOP',  spawned: false },
        { time: 8676, type: 'DIVER_SWOOP', spawned: false },
]
};

function resetTimelines() {
    for (let wave in waveTimelines) {
        waveTimelines[wave].forEach(event => event.spawned = false);
    }
}

const WAVE_DURATIONS = { 1: 8100, 2: 10000, 3: 10000, 4: 12000, 5: 12000, 6: 14000, 7: 9000 };
let bombsSpawnedInWave = 0;
let comboChain = 0, comboTimer = 0;
let flankerWarning = { timer: 0, side: null, y: 0 };
const COMBO_MAX_TIME = 120;

const keys = {}, bullets = [], bossBullets = [], enemyBullets = [], enemies = [], bombItems = [], powerItems = [], lifeItems = [], medals = [], effects = [], bowlSteam = [];
const activeEMPs = [];
const EMP_MAX_RADIUS = 600 * 1.5; // canvas.width * 1.5
const stars = Array.from({ length: 80 }, () => ({ x: Math.random() * 600, y: Math.random() * 800, size: Math.random() * 2, speed: Math.random() * 2 + 1 }));
const player = { x: 300, y: 700, speed: 4.5, focusSpeed: 2.5, hitboxSize: 4, grazeSize: 25, fireCooldown: 0, satellites: [{ x: 300, y: 700 }, { x: 300, y: 700 }, { x: 300, y: 700 }, { x: 300, y: 700 }] };
const player2 = { x: 350, y: 700, speed: 5.3, focusSpeed: 3.0, hitboxSize: 4, grazeSize: 25, fireCooldown: 0, satellites: [{ x: 350, y: 700 }, { x: 350, y: 700 }, { x: 350, y: 700 }, { x: 350, y: 700 }], image: new Image() };
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
    window.continuesUsed = 0;
    window.unlockExtraStage = false;
    window.isTrueEnding = false;
    window.devCheatsUsed = false;
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
        if (k === '1') { window.devCheatsUsed = true; linkIteration++; ngValEl.innerText = linkIteration; }
        if (k === '2') { window.devCheatsUsed = true; bombs = 9; bombsEl.innerText = bombs; power = 64; powerEl.innerText = power; }
        if (k === '3') {
            window.devCheatsUsed = true;
            if (window.isEndingSequence) {
                clearTimeout(window.victoryTimeout);
                window.isEndingSequence = false;
                triggerCreditsSequence(window.currentUnlockExtraStage);
            } else if (boss) { boss.hp = 0; }
            else { stageTimer = WAVE_DURATIONS[difficultyWave] || 3600; enemies.length = 0; waveClearTimer = 0; }
        }
        if (k === '8') {
            difficultyWave = 6;
            bossMode = false;
            boss = null;
            stageTimer = WAVE_DURATIONS[6] || 3600;
            satsukiSummonTimer = 0;
            enemies.length = 0;
            enemyBullets.length = 0;
            bossBullets.length = 0;
            waveClearTimer = 0;
            window.continuesUsed = 0;
            window.devCheatsUsed = false;
            document.getElementById('boss-ui').style.display = 'none';
        }
        if (k === '9') {
            window.godMode = !window.godMode;
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
    submitScore(name, score, difficultyWave, window.continuesUsed);
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
    // Per-player cooldown — both players can bomb independently in the same frame
    const bombTimer = isP1 ? p1BombTimer : p2BombTimer;
    if (bombs > 0 && bombTimer === 0) {
        bombs--; bombsEl.innerText = bombs;
        if (isP1) { p1BombTimer = 60; } else { p2BombTimer = 60; }
        shakeTimer = 35;
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

        // Build fizzle particles for the shockwave
        const fizzleParticles = [];
        const rgbBase = isP1 ? '170, 0, 255' : '255, 105, 180';
        for (let f = 0; f < 14; f++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1.5;
            fizzleParticles.push({
                x: sourcePlayer.x, y: sourcePlayer.y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                life: 1.0, decay: Math.random() * 0.02 + 0.012
            });
        }

        // Spawn EMP shockwave originating from the bombing player
        const glowColor = isP1 ? '#aa00ff' : '#ff69b4';
        activeEMPs.push({
            x: sourcePlayer.x, y: sourcePlayer.y,
            radius: 0, opacity: 1.0,
            dashOffset: 0,
            rgbBase, glowColor, isP1,
            arcaneAngle: 0,
            particles: fizzleParticles
        });
    }
}

function triggerVictorySequence(unlockExtraStage) {
    if (window.isEndingSequence) return;
    
    window.isEndingSequence = true;
    creditsScrollY = 800; // Initialize scroll ONCE at the very beginning
    window.currentUnlockExtraStage = unlockExtraStage;
    window.isTrueEnding = (difficultyWave >= 7);
    
    if (audio) {
        audio.forceStopAllFadesAndTracks();
        if (window.isTrueEnding) audio.hardCut('extra_ending');
        else audio.hardCut('credits');
    }
    
    // Immediately increment iteration and update HUD for NG+ visually
    linkIteration++; 
    ngValEl.innerText = linkIteration;
    iterText.innerText = "OVERCLOCKING TO ITERATION " + linkIteration + "...";

    // Stop spawning enemies and pause game mechanics, but allow rendering
    bossMode = false; 
    enemies.length = 0;
    enemyBullets.length = 0;
    bossBullets.length = 0;
    
    window.victoryTimeout = setTimeout(() => {
        triggerCreditsSequence(unlockExtraStage);
    }, 5000);
}

let creditsScrollY = 800;

function triggerCreditsSequence(unlockExtraStage) {
    if (window.creditsActive) return;
    window.creditsActive = true;
    window.isEndingSequence = true; // MUST be set to actually draw the credits if triggered manually

    // Initialize background gameplay underneath the credits (ALWAYS NG+)
    difficultyWave = 1;
    bossMode = false;
    boss = null;
    enemies.length = 0;
    enemyBullets.length = 0;
    bossBullets.length = 0;
    stageTimer = 0;
    resetTimelines();
    window.skipNextSummaryBox = true;
    isPaused = false;

    let creditsSkipped = false;
    let creditsEnded = false;
    
    // creditsScrollY initialization moved to triggerVictorySequence
    
    function skipCredits(e) {
        let k = e.key ? e.key.toLowerCase() : null;
        let p1Start = (k === keyMap.start);
        if (p1Start && !creditsSkipped) {
            creditsSkipped = true;
            endCredits();
        }
    }
    
    let skipInterval = setInterval(() => {
        let gp = navigator.getGamepads()[0];
        if (gp && gp.buttons[9].pressed) {
            if (!creditsSkipped) {
                creditsSkipped = true;
                endCredits();
            }
        }
    }, 100);

    document.addEventListener('keydown', skipCredits);

    let creditsTimeout = setTimeout(() => {
        if (!creditsSkipped) {
            creditsSkipped = true;
            endCredits();
        }
    }, 30000);

    function endCredits() {
        if (creditsEnded) return;
        creditsEnded = true;
        window.creditsActive = false;
        if (typeof creditsScrollY !== 'undefined') creditsScrollY = -2000;
        clearInterval(skipInterval);
        clearTimeout(creditsTimeout);
        document.removeEventListener('keydown', skipCredits);
    }
}

function closeSummary() { 
    summaryBox.style.display = 'none'; 
    isPaused = false; 
    waveGraze = 0; 
    scoreAtLastBoss = score; 
    shieldBrokenInWave = false; 
    updateHighScore(); 
    
    if (difficultyWave === 7 || difficultyWave === 8) {
        if (difficultyWave === 7 && linkIteration > 1) {
            if (window.unlockExtraStage) {
                difficultyWave = 7;
                bossMode = false;
                stageTimer = 0;
                resetTimelines();
                document.getElementById('boss-ui').style.display = 'none';
            } else {
                difficultyWave = 1;
                linkIteration++; ngValEl.innerText = linkIteration;
                iterText.innerText = "OVERCLOCKING TO ITERATION " + linkIteration + "...";
                resetAnimTimer = 120; shakeTimer = 120; flashTimer = 50;
                window.skipNextSummaryBox = true;
            }
        } else if (difficultyWave === 8) {
            difficultyWave = 1;
            linkIteration++; ngValEl.innerText = linkIteration;
            iterText.innerText = "OVERCLOCKING TO ITERATION " + linkIteration + "...";
            resetAnimTimer = 120; shakeTimer = 120; flashTimer = 50;
            window.skipNextSummaryBox = true;
        } else {
            triggerVictorySequence(window.unlockExtraStage);
        }
    } else if (audio && difficultyWave <= 6) {
        audio.hardCut('stage' + difficultyWave);
    }
}
function processContinue() {
    updateHighScore();
    continueCountdown = 0;
    continueUsed = true;
    window.continuesUsed++;
    console.log("Continues:", window.continuesUsed);
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
    if (difficultyWave === 6) {
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
        satsukiSummonTimer = 0;
        document.getElementById('boss-ui').style.display = 'none';
        // Restart the correct stage BGM for the wave we're resetting to
        if (audio) {
            audio.forceStopAllFadesAndTracks();
            const waveTrack = 'stage' + Math.min(difficultyWave, 6);
            audio.hardCut(waveTrack);
        }
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

    if (pObj.fireCooldown === undefined) pObj.fireCooldown = 0;
    if (pObj.fireCooldown > 0) pObj.fireCooldown--;

    if ((kMap && keys[kMap.shoot]) || (gpState && gpState.shoot)) {
        if (pObj.fireCooldown <= 0) {
            shoot(pObj);
            pObj.fireCooldown = 6;
        }
    } else {
        // Instant response on fresh tap
        pObj.fireCooldown = 0;
    }

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
                    (target === boss && boss && boss.hp > 0 && !boss.intangible) ||
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
                if (boss && boss.hp > 0 && !boss.intangible) {
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
        // Decelerating expansion: bursts fast then lingers
        emp.radius += (EMP_MAX_RADIUS - emp.radius) * 0.045 + 1.5;
        emp.arcaneAngle += 0.025;
        emp.dashOffset = (emp.dashOffset || 0) + 1.2; // spinning dashes
        // Quadratic fade so it lingers much longer before vanishing
        const t = emp.radius / EMP_MAX_RADIUS;
        emp.opacity = Math.max(0, 1.0 - (t * t));
        // Update fizzle particles
        if (emp.particles) {
            for (let p = emp.particles.length - 1; p >= 0; p--) {
                const fp = emp.particles[p];
                fp.x += fp.vx; fp.y += fp.vy;
                fp.vx *= 0.96; fp.vy *= 0.96;
                fp.life -= fp.decay;
                if (fp.life <= 0) emp.particles.splice(p, 1);
            }
        }
        if (emp.opacity <= 0 && (!emp.particles || emp.particles.length === 0)) activeEMPs.splice(i, 1);
    }
    
    for (let i = bowlSteam.length - 1; i >= 0; i--) {
        let p = bowlSteam[i];
        p.y -= 2 * ts;
        p.life -= 0.03 * ts;
        if (p.life <= 0) bowlSteam.splice(i, 1);
    }
}

function playerTakeDamage() {
    if (invulnTimer > 0 || p1BombTimer > 0 || p2BombTimer > 0) return;

    if (window.godMode) {
        invulnTimer = 120; shakeTimer = 25; 
        if (audio) audio.playExplosion();
        effects.push({ x: player.x, y: player.y, r: 40, opacity: 1 });
        return;
    }

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
            let b = arr[i];
            if (b.homing) {
                b.homingTimer -= ts;
                if (b.homingTimer > 0) {
                    let a = Math.atan2(player.y - b.y, player.x - b.x);
                    let currentSpeed = Math.hypot(b.vx, b.vy);
                    // Gradually steer instead of instant snap for fairness
                    let currentA = Math.atan2(b.vy, b.vx);
                    let diff = a - currentA;
                    // Normalize difference
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    let turn = Math.max(-0.04 * ts, Math.min(0.04 * ts, diff));
                    b.vx = Math.cos(currentA + turn) * currentSpeed;
                    b.vy = Math.sin(currentA + turn) * currentSpeed;
                    b.angle = currentA + turn;
                }
            }
            b.x += b.vx * ts; b.y += b.vy * ts;
            let hit = false;
            let checkP = (pObj, pIsFoc) => {
                let d = Math.hypot(pObj.x - b.x, pObj.y - b.y);
                if (pIsFoc && !b.grazed && d < pObj.grazeSize && d > pObj.hitboxSize + 4 && invulnTimer === 0 && p1BombTimer === 0 && p2BombTimer === 0) {
                    b.grazed = true; graze++; waveGraze++; score += 50; scoreEl.innerText = score; document.getElementById('grazeVal').innerText = graze; slowMoTimer = 15;
                    if (audio) audio.playGraze();
                    if (!hasShield) { grazeStreak++; streakTimer = 90; document.getElementById('shieldStreak').innerText = grazeStreak; if (grazeStreak >= 10) { hasShield = true; document.getElementById('shieldStat').style.display = 'inline'; } }
                }
                if (d < pObj.hitboxSize + 4 && invulnTimer === 0 && p1BombTimer === 0 && p2BombTimer === 0) {
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
        if (d1 < player.hitboxSize + 15 && invulnTimer === 0 && p1BombTimer === 0) {
            playerTakeDamage();
            hit = true;
        }
        if (is2PMode && !hit) {
            let d2 = Math.hypot(player2.x - e.x, player2.y - e.y);
            if (d2 < player2.hitboxSize + 15 && invulnTimer === 0 && p2BombTimer === 0) {
                playerTakeDamage();
                hit = true;
            }
        }
        if (hit) enemies.splice(i, 1);
    }

    if (boss && !boss.intangible) {
        if (Math.hypot(player.x - boss.x, player.y - boss.y) < player.hitboxSize + 50 && invulnTimer === 0 && p1BombTimer === 0) {
            playerTakeDamage();
        }
        if (is2PMode && Math.hypot(player2.x - boss.x, player2.y - boss.y) < player2.hitboxSize + 50 && invulnTimer === 0 && p2BombTimer === 0) {
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
    }
}

function updateBoss(ts) {
    if (boss) {
        let lastX = boss.x;
        boss.update(ts, player, bossBullets);
        if (!boss) return; // Prevent crash if boss state machine triggers cleanup
        boss.vx = boss.x - lastX;

        hpFill.style.width = Math.max(0, (boss.hp / boss.maxHP * 100)) + "%";
        hpFill.style.background = (boss.hp < boss.maxHP / 2) ? "#ffca3a" : "#ff006e";

        if (is2PMode && boss.type === 'pink') {
            if (Math.random() < 0.25 * ts) {
                bowlSteam.push({ x: boss.x + (Math.random() * 16 - 8), y: boss.y - 15, size: 2 + Math.random() * 5, life: 1.0 });
            }
        }



        if (boss && boss.hp <= 0 && boss.state !== 'portal_warp') {


            // --- STRICT WAVE 6 ROADBLOCK FOR NON-1CC RUNS ---
            if (difficultyWave === 6) {
                boss = null;
                document.getElementById('boss-ui').style.display = 'none';
                if (audio) audio.playExplosion();
                triggerVictorySequence(false);
                return; // Trigger standard credits for non-1CC
            }

            let currentWave = difficultyWave;

            score += 5000; difficultyWave++; waveClearTimer = 150; bossMode = false; stageTimer = 0; resetTimelines(); bombsSpawnedInWave = 0; flankerWarning = { timer: 0, side: null, y: 0 };
            if (audio) {
                audio.playExplosion();
                if (difficultyWave <= 6) {
                    audio.fadeTransition('stage' + difficultyWave);
                } else if (difficultyWave === 7) {
                    audio.fadeTransition('extra_stage');
                }
            }
            let b_name = boss.name;
            let b_defeat = boss.defeat;
            let isLastBoss = (currentWave === 7);

            boss = null;
            document.getElementById('boss-ui').style.display = 'none';

            if (isLastBoss) {
                // Daemon defeated! Trigger True Ending immediately.
                window.isTrueEnding = true;
                if (!window.isEndingSequence) {
                    triggerVictorySequence(false);
                }
                return;
            } else {
                isPaused = true; summaryBox.style.display = 'block';
            }

            if (difficultyWave === 7) { // Since we incremented difficultyWave on line 835
                const isSolo1CC = (!is2PMode && window.continuesUsed === 0);
                const isCoopClear = is2PMode;
                const unlockExtraStage = isSolo1CC || isCoopClear;
                if (unlockExtraStage) localStorage.setItem('fosozu_extra_unlocked', 'true');
                gameCleared = true;
                localStorage.setItem('fosozu_gameCleared', 'true');
                if (typeof update2PButton !== 'undefined') update2PButton();
                window.unlockExtraStage = unlockExtraStage;
            } else if (difficultyWave === 8) {
                gameCleared = true;
                localStorage.setItem('fosozu_gameCleared', 'true');
                if (typeof update2PButton !== 'undefined') update2PButton();
                window.unlockExtraStage = false;
            }

            let bonusAmt = Math.floor(waveGraze * 1.5 * difficultyWave);
            let bonusMsg = `<p style="color:#ff006e; font-style:italic;">"${b_defeat}"</p><hr>WAVE ${difficultyWave - 1} COMPLETE<br>GRAZE BONUS: +${bonusAmt}`;
            if (!shieldBrokenInWave) { bonusMsg += `<br>FLAWLESS UPLINK: +25,000!`; score += 25000; }
            if (difficultyWave > 3 && !continueUsed) { bonusMsg += `<br>FULL BUFFER BONUS: +50,000!`; score += 50000; }
            document.getElementById('summary-content').innerHTML = bonusMsg; score += bonusAmt; if (typeof scoreEl !== 'undefined') scoreEl.innerText = score; return;
        }
    }
    // Spawn Boss when wave timer concludes
    if (!window.isEndingSequence && !bossMode && waveClearTimer <= 0 && stageTimer >= (WAVE_DURATIONS[difficultyWave] || 3600)) {
        if (difficultyWave === 6) {
            // 10-second eerie silence before Satsuki
            if (satsukiSummonTimer === 0) {
                satsukiSummonTimer = 600;
                if (typeof audio !== 'undefined' && audio) audio.fadeTransition('boss6', 2.0);
            }
            satsukiSummonTimer -= ts;
            if (satsukiSummonTimer > 0) return;
        }

        bossMode = true;
        satsukiSummonTimer = 0;
        document.getElementById('boss-ui').style.display = 'block';

        let tIdx = (difficultyWave - 1) % BossRoster.length;
        let BossClass = BossRoster[tIdx];
        if (difficultyWave === 7) BossClass = DaemonBoss; // Override Wave 7

        if (typeof audio !== 'undefined' && audio && difficultyWave !== 6) {
            audio.forceStopAllFadesAndTracks();
        }

        boss = new BossClass(difficultyWave, linkIteration);
        
        // Music is triggered inside MadameSatsuki/DaemonBoss constructors,
        // but we explicitly call Daemon's here as a fallback just in case.
        if (audio && difficultyWave !== 6) {
            if (boss.type === 'daemon') {
                audio.hardCut('extra_boss');
            } else {
                audio.hardCut('boss' + difficultyWave);
            }
        }

        bossNameEl.innerText = boss.name;
        // Satsuki triggers dialogue herself after summoning; others go straight to dialogue
        if (difficultyWave !== 6 && boss.type !== 'daemon') {
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
    } else if (type === 'SPIRALKO_CENTER') {
        hp = 150;
        shootDelay = 10;
        speedMult = 0;
        repeatsShot = true;
    } else if (type.startsWith('CROW_DIVE')) {
        hp = 30;
        shootDelay = 80;
        speedMult = 2.0;
        repeatsShot = true;
    } else if (type === 'SHOTGUNKO_WALL') {
        hp = 80;
        shootDelay = 150;
        speedMult = 0.6;
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
    
    if (difficultyWave === 7) {
        speedMult *= 1.3;
        shootDelay = Math.max(120, shootDelay * 0.7); 
        repeatsShot = true;
    }

    let speed = baseSpeed * speedMult;

    if (type === 'MID_BOSS_PINGKO') {
        // PingKo drops down to y=150 and stays there.
        enemies.push({ x: 300, y: -50, vx: 0, vy: 2, speed: 0, type: 'midboss', nextShot: Date.now() + 2000, hp: hp, repeatsShot: true, isMidBoss: true, fleeTimer: 900, targetY: 150 });
    } else if (type === 'SPIRALKO_CENTER') {
        enemies.push({ x: 150 + Math.random() * 300, y: -50, vx: 0, vy: 1.5, speed: 0, type: 'spiralko', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: true, isMidBoss: true, fleeTimer: 600, targetY: 150 + Math.random() * 150, angle: 0 });
    } else if (type === 'CROW_DIVE_LEFT') {
        enemies.push({ x: 50, y: -50, vx: speed * 0.4, vy: speed, speed: speed, type: 'crow', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: true, diverState: 'DOWN' });
    } else if (type === 'CROW_DIVE_RIGHT') {
        enemies.push({ x: 550, y: -50, vx: -speed * 0.4, vy: speed, speed: speed, type: 'crow', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: true, diverState: 'DOWN' });
    } else if (type === 'SHOTGUNKO_WALL') {
        enemies.push({ x: 150, y: -50, vx: 0, vy: speed, speed: speed, type: 'shotgunko', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: true });
        enemies.push({ x: 300, y: -100, vx: 0, vy: speed, speed: speed, type: 'shotgunko', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: true });
        enemies.push({ x: 450, y: -50, vx: 0, vy: speed, speed: speed, type: 'shotgunko', nextShot: Date.now() + shootDelay, hp: hp, repeatsShot: true });
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
        let waveIndex = ((difficultyWave - 1) % 7) + 1;
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
            
            if (difficultyWave === 7 && !e.isMidBoss) {
                if (e.type === 'blue') {
                    e.angle = (e.angle || 0) + 0.4;
                    for (let j = 0; j < 3; j++) {
                        let a = e.angle + (j * Math.PI * 2 / 3);
                        enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * 3 * eSpd, Math.sin(a) * 3 * eSpd, 'rice', '#00f2ff'));
                    }
                    e.nextShot = Date.now() + 150;
                } else if (e.type === 'pink') {
                    let a_b = Math.atan2(player.y - e.y, player.x - e.x);
                    for (let j = 0; j < 3; j++) {
                        let a = a_b + (Math.random() - 0.5) * 0.6; 
                        enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * (2 + Math.random() * 2) * eSpd, Math.sin(a) * (2 + Math.random() * 2) * eSpd, 'amulet', '#ff006e'));
                    }
                    e.nextShot = Date.now() + 600;
                } else {
                    let a_b = Math.atan2(player.y - e.y, player.x - e.x); 
                    for (let j = -1; j <= 1; j++) {
                        let a = a_b + (j * 0.15);
                        enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * 4 * eSpd, Math.sin(a) * 4 * eSpd, 'rice', '#b5179e'));
                    }
                    e.nextShot = Date.now() + 400;
                }
                if (!e.nextShot) e.nextShot = Date.now() + 500;
            } else {
                if (e.type === 'spiralko') {
                    e.angle += 0.4;
                    for (let j = 0; j < 3; j++) {
                        let a = e.angle + (j * Math.PI * 2 / 3);
                        enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * 3 * eSpd, Math.sin(a) * 3 * eSpd, 'rice', '#00f2ff'));
                    }
                    e.nextShot = Date.now() + 50;
                }
                else if (e.isMidBoss && e.fleeTimer > 0) {
                    // Fast 8-way spiral for midboss
                    let r = (Date.now() / 150); 
                    for (let j = 0; j < 8; j++) { 
                        let a = r + (j * Math.PI / 4); 
                        enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * 4 * eSpd, Math.sin(a) * 4 * eSpd, 'orb', '#ffca3a')); 
                    }
                    e.nextShot = Date.now() + 250; // fast fire rate
                }
                else if (e.type === 'blue') { 
                    let r = (Date.now() / 400); 
                    for (let j = 0; j < 4; j++) { 
                        let a = r + (j * Math.PI / 2); 
                        enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * 3 * eSpd, Math.sin(a) * 3 * eSpd, 'orb', '#ff003c')); 
                    } 
                }
                else if (e.type === 'crow') {
                    let a_b = Math.atan2(player.y - e.y, player.x - e.x); 
                    for (let j = -1; j <= 1; j++) {
                        let a = a_b + (j * 0.15);
                        enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * 4 * eSpd, Math.sin(a) * 4 * eSpd, 'rice', '#b5179e'));
                    }
                    e.nextShot = Date.now() + 200;
                }
                else if (e.type === 'shotgunko') {
                    let a_b = Math.atan2(player.y - e.y, player.x - e.x);
                    for (let j = 0; j < 5; j++) {
                        let a = a_b + (Math.random() - 0.5) * 1.0; 
                        enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * (2 + Math.random() * 2) * eSpd, Math.sin(a) * (2 + Math.random() * 2) * eSpd, 'amulet', '#ff006e'));
                    }
                    e.nextShot = Date.now() + 400; 
                }
                else { 
                    let a_b = Math.atan2(player.y - e.y, player.x - e.x); 
                    for (let j = -2; j <= 2; j++) { 
                        let a = a_b + (j * 0.25); 
                        enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * 3.5 * eSpd, Math.sin(a) * 3.5 * eSpd, 'orb', '#ff003c')); 
                    } 
                }
                
                if (e.repeatsShot) {
                    e.nextShot = e.isMidBoss ? Date.now() + 250 : Date.now() + 1500;
                } else {
                    e.nextShot = Date.now() + 9999999;
                }
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
    if (resetAnimTimer > 0) { resetAnimTimer--; resetOverlay.style.opacity = Math.min(1, resetAnimTimer / 30); resetText.style.display = (resetAnimTimer > 10) ? "block" : "none"; iterText.style.display = (resetAnimTimer > 10) ? "block" : "none"; if (resetAnimTimer === 0) { if (window.skipNextSummaryBox) { window.skipNextSummaryBox = false; isPaused = false; } else { isPaused = true; summaryBox.style.display = 'block'; } } return; }
    if (!gameStarted || gameOver || isPaused) return;

    const ts = (slowMoTimer > 0) ? 0.4 : 1.0;

    if (!bossMode && waveClearTimer <= 0) {
        stageTimer += ts;
    }

    if (slowMoTimer > 0) slowMoTimer--; if (flashTimer > 0) flashTimer--; if (invulnTimer > 0) invulnTimer--;
    if (waveClearTimer > 0) waveClearTimer--; if (p1BombTimer > 0) p1BombTimer--; if (p2BombTimer > 0) p2BombTimer--; if (shakeTimer > 0) shakeTimer--;
    if (streakTimer > 0) streakTimer--; else if (grazeStreak > 0 && !hasShield) { grazeStreak = 0; document.getElementById('shieldStreak').innerText = 0; }

    stars.forEach(s => { s.y += s.speed * ts; if (s.y > 800) s.y = 0; });

    if (!window.isPlayerLocked) {
        updatePlayer(ts, player, (inputMode === 'gamepad') ? gamepadState : null, (inputMode === 'keyboard') ? keyMap : null);
        if (is2PMode) updatePlayer(ts, player2, (inputModeP2 === 'gamepad') ? gamepadState2 : null, (inputModeP2 === 'keyboard') ? keyMapP2 : null);
    }
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
        ctx.save();
        if (pObj.alpha !== undefined) ctx.globalAlpha = pObj.alpha;
        if (isP1) {
            if (assets.player.loaded) ctx.drawImage(assets.player.img, pObj.x - 50, pObj.y - 50, 100, 100); 
            else { ctx.fillStyle = 'purple'; ctx.beginPath(); ctx.arc(pObj.x, pObj.y, 25, 0, 7); ctx.fill(); }
        } else {
            if (pObj.image && pObj.image.complete && pObj.image.naturalWidth > 0) ctx.drawImage(pObj.image, pObj.x - 50, pObj.y - 50, 100, 100); 
        }
        ctx.restore();
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

    if (boss && (boss.hp > 0 || boss.state === 'portal_warp') && typeof boss.draw === 'function') {
        boss.draw(ctx, typeof player !== 'undefined' ? player : null, typeof player2 !== 'undefined' ? player2 : null);
    }

    drawPlayer(player, true);
    if (is2PMode) drawPlayer(player2, false);

    if (boss) {
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
                const colorMap = { daemon: '#39ff14', pink: '#ff006e', blue: '#00f2ff', green: '#0f0', purple: '#b5179e', amber: '#f77f00', crimson: '#d90429' };
                ctx.fillStyle = colorMap[boss.type] || '#fff';
                if (boss.alpha !== undefined) ctx.globalAlpha = boss.alpha;
                else if (boss.hp < boss.maxHP / 2 && Date.now() % 200 < 100) ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(boss.x, boss.y, 75, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }

            if (boss.type === 'daemon' && boss.state === 'attack_drifter' && boss.telegraphX) {
                ctx.save();
                ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
                ctx.strokeStyle = '#39ff14';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#39ff14';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(boss.telegraphX, boss.telegraphY, 60, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(57, 255, 20, 0.15)';
                ctx.fill();
                ctx.restore();
            }

            if (boss.type === 'daemon' && boss.state === 'attack_reach_scythe') {
                let cycleTimer = boss.stateTimer % 180;
                if (cycleTimer <= 60) {
                    ctx.save();
                    ctx.globalAlpha = (cycleTimer / 60) * 0.7;
                    ctx.strokeStyle = '#dc143c';
                    ctx.lineWidth = 2 + Math.random() * 2;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#dc143c';
                    ctx.beginPath();
                    ctx.moveTo(boss.x, boss.y);
                    ctx.lineTo(boss.x + Math.cos(boss.reachAngle) * 1500, boss.y + Math.sin(boss.reachAngle) * 1500);
                    ctx.stroke();
                    ctx.restore();
                }
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
                ctx.strokeStyle = difficultyWave === 7 ? '#dc143c' : '#00f2ff';
                ctx.shadowColor = difficultyWave === 7 ? '#dc143c' : '#00f2ff';
                ctx.shadowBlur = difficultyWave === 7 ? 15 : 12;
                
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
                ctx.strokeStyle = difficultyWave === 7 ? '#dc143c' : '#0f0';
                ctx.shadowColor = difficultyWave === 7 ? '#dc143c' : '#0f0';
                ctx.shadowBlur = difficultyWave === 7 ? 15 : 12;
                
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
                ctx.strokeStyle = difficultyWave === 7 ? '#dc143c' : '#ff006e';
                ctx.shadowColor = difficultyWave === 7 ? '#dc143c' : '#ff006e';
                ctx.shadowBlur = difficultyWave === 7 ? 15 : 12;
                
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
            } else if (e.type === 'spiralko') {
                if (assets['blue'] && assets['blue'].loaded) {
                    ctx.drawImage(assets['blue'].img, -25, -25, 50, 50);
                } else {
                    ctx.fillStyle = '#00f2ff';
                    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
                }
            } else if (e.type === 'crow') {
                if (assets['purple'] && assets['purple'].loaded) {
                    ctx.drawImage(assets['purple'].img, -25, -25, 50, 50);
                } else {
                    ctx.fillStyle = '#b5179e';
                    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(20, 10); ctx.lineTo(-20, 10); ctx.closePath(); ctx.fill();
                }
            } else if (e.type === 'shotgunko') {
                if (assets['green'] && assets['green'].loaded) {
                    ctx.drawImage(assets['green'].img, -25, -25, 50, 50);
                } else {
                    ctx.fillStyle = '#0f0';
                    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(20, 10); ctx.lineTo(-20, 10); ctx.closePath(); ctx.fill();
                }
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
        let isP2 = b.isP2Bullet || b.isP2Homing;
        let isHoming = b.isHoming || b.isP2Homing;
        let colorBase = isP2 ? '#ff69b4' : '#00ffff';
        let shape = isHoming ? 'amulet' : 'rice';

        ctx.save();
        ctx.translate(b.x, b.y);

        if (isHoming) {
            ctx.rotate(Date.now() * 0.01);
        } else {
            let angle = Math.atan2(b.vy || -1, b.vx || 0);
            ctx.rotate(angle);
        }

        if (shape === 'rice') {
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
            grad.addColorStop(0, colorBase);
            grad.addColorStop(1, colorBase);
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === 'amulet') {
            ctx.fillStyle = colorBase;
            ctx.fillRect(-8, -6, 16, 12);
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(-5, -3, 10, 6);
        }

        ctx.restore();
    });
    effects.forEach(eff => { ctx.strokeStyle = `rgba(0, 242, 255, ${eff.opacity})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(eff.x, eff.y, eff.r, 0, Math.PI * 2); ctx.stroke(); });

    // EMP Shockwave Render
    activeEMPs.forEach(emp => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = emp.glowColor;
        ctx.shadowBlur = 35;

        if (emp.isP1) {
            // ── P1 Fosozu: Purple Y2K radial shockwave ───────────────────────

            // Layer 1: Base energy ring (solid, semi-transparent)
            ctx.beginPath();
            ctx.arc(emp.x, emp.y, emp.radius, 0, Math.PI * 2);
            ctx.lineWidth = 14;
            ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.85})`;
            ctx.stroke();

            // Layer 2: Digital data ring — spinning dashed segments outside the main ring
            ctx.save();
            ctx.translate(emp.x, emp.y);
            ctx.rotate(emp.arcaneAngle * 1.8);
            ctx.setLineDash([18, 22]);
            ctx.lineDashOffset = -(emp.dashOffset || 0);
            ctx.beginPath();
            ctx.arc(0, 0, emp.radius + 10, 0, Math.PI * 2);
            ctx.lineWidth = 5;
            ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.6})`;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Layer 3: Inner soft halo trail
            if (emp.radius > 25) {
                ctx.beginPath();
                ctx.arc(emp.x, emp.y, emp.radius - 20, 0, Math.PI * 2);
                ctx.lineWidth = 7;
                ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.35})`;
                ctx.stroke();
            }

            // Layer 4: Core flash — bright tight ring that fades out faster
            const coreOpacity = Math.max(0, emp.opacity * 1.4 - 0.4);
            if (emp.radius < 180 && coreOpacity > 0) {
                ctx.beginPath();
                ctx.arc(emp.x, emp.y, emp.radius * 0.3, 0, Math.PI * 2);
                ctx.lineWidth = 10;
                ctx.strokeStyle = `rgba(200, 120, 255, ${coreOpacity})`;
                ctx.stroke();
            }

            // Layer 5: Rotating Triforce Geometry
            ctx.save();
            ctx.translate(emp.x, emp.y);
            ctx.rotate(emp.radius * 0.05);
            ctx.globalAlpha = emp.opacity;
            ctx.fillStyle = '#FFD700';
            
            let s = emp.radius * 0.4;
            let h = s * Math.sqrt(3) / 2;
            
            ctx.beginPath();
            // Top triangle
            ctx.moveTo(0, -4 * h / 3);
            ctx.lineTo(-s / 2, -h / 3);
            ctx.lineTo(s / 2, -h / 3);
            ctx.closePath();
            
            // Bottom-left triangle
            ctx.moveTo(-s / 2, -h / 3);
            ctx.lineTo(-s, 2 * h / 3);
            ctx.lineTo(0, 2 * h / 3);
            ctx.closePath();
            
            // Bottom-right triangle
            ctx.moveTo(s / 2, -h / 3);
            ctx.lineTo(0, 2 * h / 3);
            ctx.lineTo(s, 2 * h / 3);
            ctx.closePath();
            
            ctx.fill();
            ctx.restore();

        } else {
            // ── P2 PingKo: Pink arcane summoning circle shockwave ────────────
            ctx.translate(emp.x, emp.y);
            ctx.rotate(emp.arcaneAngle);

            // Layer 1: Outer expanding ring
            ctx.beginPath();
            ctx.arc(0, 0, emp.radius, 0, Math.PI * 2);
            ctx.lineWidth = 12;
            ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.85})`;
            ctx.stroke();

            // Layer 2: Spinning dashed data ring (counter-rotates for contrast)
            ctx.save();
            ctx.rotate(-emp.arcaneAngle * 2.5);
            ctx.setLineDash([14, 18]);
            ctx.lineDashOffset = (emp.dashOffset || 0);
            ctx.beginPath();
            ctx.arc(0, 0, emp.radius + 9, 0, Math.PI * 2);
            ctx.lineWidth = 4;
            ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.55})`;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Layer 3: Rotating hexagram
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
                    ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.65})`;
                    ctx.stroke();
                }
            }

            // Layer 4: 6 glowing rune dots on the outer ring
            for (let d = 0; d < 6; d++) {
                const a = (d / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * emp.radius, Math.sin(a) * emp.radius, Math.max(1, 4.5 * emp.opacity), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${emp.rgbBase}, ${emp.opacity})`;
                ctx.shadowBlur = 15;
                ctx.fill();
            }

            // Layer 5: Inner concentric ring counter-rotating + core flash
            ctx.rotate(-emp.arcaneAngle * 2);
            if (emp.radius > 30) {
                ctx.beginPath();
                ctx.arc(0, 0, emp.radius * 0.6, 0, Math.PI * 2);
                ctx.lineWidth = 4;
                ctx.strokeStyle = `rgba(${emp.rgbBase}, ${emp.opacity * 0.45})`;
                ctx.stroke();
            }
            const coreOpacityP2 = Math.max(0, emp.opacity * 1.4 - 0.4);
            if (emp.radius < 160 && coreOpacityP2 > 0) {
                ctx.beginPath();
                ctx.arc(0, 0, emp.radius * 0.25, 0, Math.PI * 2);
                ctx.lineWidth = 8;
                ctx.strokeStyle = `rgba(255, 180, 220, ${coreOpacityP2})`;
                ctx.stroke();
            }
        }

        ctx.restore();

        // Fizzle particles (rendered outside translate so they use world coords)
        if (emp.particles && emp.particles.length > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.shadowColor = emp.glowColor;
            ctx.shadowBlur = 12;
            emp.particles.forEach(fp => {
                ctx.beginPath();
                ctx.arc(fp.x, fp.y, Math.max(0.5, 2.5 * fp.life), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${emp.rgbBase}, ${fp.life})`;
                ctx.fill();
            });
            ctx.restore();
        }
    });
    bossBullets.forEach(b => { 
        if (b.draw) b.draw(ctx); 
        else { ctx.fillStyle = b.color || '#ff006e'; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 7); ctx.fill(); }
    });

    enemyBullets.forEach(b => { 
        if (b.draw) b.draw(ctx); 
        else { ctx.fillStyle = '#0f0'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill(); }
    });
    const isFocused1 = (inputMode === 'keyboard' && keys[keyMap.focus]) || (inputMode === 'gamepad' && gamepadState.focus);
    if (isFocused1) { ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(player.x, player.y, player.hitboxSize, 0, 7); ctx.fill(); }
    const isFocused2 = (inputModeP2 === 'keyboard' && keys[keyMapP2.focus]) || (inputModeP2 === 'gamepad' && gamepadState2.focus);
    if (is2PMode && isFocused2) { ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(player2.x, player2.y, player2.hitboxSize, 0, 7); ctx.fill(); }

    if (isPaused && dialogueBox.style.display !== 'block' && summaryBox.style.display !== 'block' && resetAnimTimer <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 600, 800);
    }

    if (window.isEndingSequence) {
        if (typeof creditsScrollY !== 'undefined') creditsScrollY -= 1; // Unconditional scroll

        let bgY = 0;
        if (typeof creditsScrollY !== 'undefined') {
            let lastLineOffset = (window.isTrueEnding || window.currentUnlockExtraStage) ? 250 : 160;
            bgY = Math.min(0, creditsScrollY + lastLineOffset);
        }
        
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; 
        ctx.fillRect(0, bgY, canvas.width, canvas.height); // Use fixed canvas.height so it rolls UP seamlessly
        
        if (bgY <= -canvas.height) {
            window.isEndingSequence = false;
            if (typeof audio !== 'undefined' && audio) {
                audio.playBGM('stage1');
            }
        }

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '24px Courier';
        
        if (typeof creditsScrollY !== 'undefined') {
            ctx.fillText("STAFF ROLL", 300, creditsScrollY);
            ctx.font = '16px Courier';
            ctx.fillText("THANK YOU FOR PLAYING", 300, creditsScrollY + 60);
            ctx.fillText("Special thanks to everyone that has", 300, creditsScrollY + 100);
            ctx.fillText("helped us grow and learn", 300, creditsScrollY + 130);
            ctx.fillText("throughout this project!", 300, creditsScrollY + 160);
            
            if (window.isTrueEnding || window.currentUnlockExtraStage) {
                ctx.fillStyle = '#39ff14';
                ctx.fillText("-- EXTRA STAGE CLEAR --", 300, creditsScrollY + 220);
                ctx.fillStyle = '#ffca3a';
                ctx.fillText("TRUE ENDING", 300, creditsScrollY + 250);
            }
        }
    }

    if (gameOver) { ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, 600, 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText("SIGNAL LOST", 300, 400); }

    // Render top-left HUD (dynamically concatenates linkIteration as requested)
    if (gameStarted && !window.isEndingSequence && !gameOver) {
        ctx.fillStyle = '#00f2ff';
        ctx.textAlign = 'left';
        ctx.font = 'bold 16px Courier';
        ctx.fillText(`WAVE: ${difficultyWave} | Iteration: ${linkIteration}`, 10, 25);
    }
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
