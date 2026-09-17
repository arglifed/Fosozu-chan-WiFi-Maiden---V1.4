const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('scoreVal'), hiScoreEl = document.getElementById('hiScoreVal'), livesEl = document.getElementById('livesVal'), bombsEl = document.getElementById('bombsVal');
const powerEl = document.getElementById('powerVal');
const summaryBox = document.getElementById('summary-box'), continueUI = document.getElementById('continue-ui'), dialogueBox = document.getElementById('dialogue-box'), warningBorder = document.getElementById('warning-border');
const fpsCounterEl = document.getElementById('fpsCounter'), hpFill = document.getElementById('hp-bar-fill'), bossNameEl = document.getElementById('bossName'), resetOverlay = document.getElementById('reset-overlay'), resetText = document.getElementById('reset-text'), iterText = document.getElementById('iter-text'), ngValEl = document.getElementById('ngVal');

canvas.width = 600; canvas.height = 800;

const assets = { 
    player: { img: new Image(), src: 'fosozu.png', loaded: false }, 
    pink: { img: new Image(), src: 'pink_girl.png', loaded: false }, 
    blue: { img: new Image(), src: 'blue_girl.png', loaded: false }, 
    green: { img: new Image(), src: 'green_girl.png', loaded: false },
    purple: { img: new Image(), src: 'crow.png', loaded: false },
    amber: { img: new Image(), src: 'lief.png', loaded: false },
    crimson: { img: new Image(), src: 'satsuki.png', loaded: false }
};
let assetsLoaded = 0;
const totalAssets = Object.keys(assets).length;

Object.values(assets).forEach(a => { 
    a.img.onload = () => { a.loaded = true; assetsLoaded++; }; 
    a.img.onerror = () => { a.loaded = false; assetsLoaded++; };
    a.img.src = a.src; 
});

let sessionHiScore = parseInt(localStorage.getItem('fosozu_hiScore')) || 0;
hiScoreEl.innerText = sessionHiScore;

let score = 0, graze = 0, lives = 3, bombs = 3, power = 0, gameOver = false, gameStarted = false, isPaused = false;
let bossMode = false, boss = null, difficultyWave = 1, scoreAtLastBoss = 0, continueUsed = false;
let waveClearTimer = 0, bombEffectTimer = 0, invulnTimer = 0, shakeTimer = 0, stallingTimer = 0, continueCountdown = 0;
let slowMoTimer = 0, flashTimer = 0, grazeStreak = 0, streakTimer = 0, hasShield = false, waveGraze = 0, dialogueIndex = 0, resetAnimTimer = 0, linkIteration = 1, shieldBrokenInWave = false;

// WAVE-BASED MECHANICS
let stageTimer = 0;
const WAVE_DURATION = 1800;
let bombsSpawnedInWave = 0;

const keys = {}, bullets = [], bossBullets = [], enemyBullets = [], enemies = [], bombItems = [], powerItems = [], medals = [], effects = [];
const stars = Array.from({ length: 80 }, () => ({ x: Math.random()*600, y: Math.random()*800, size: Math.random()*2, speed: Math.random()*2+1 }));
const player = { x: 300, y: 700, speed: 6, focusSpeed: 2.5, hitboxSize: 4, grazeSize: 25, satellites: [{x:300,y:700}, {x:300,y:700}, {x:300,y:700}, {x:300,y:700}] };

let audio = null;

let gamepadState = { up: false, down: false, left: false, right: false, shoot: false, bomb: false, focus: false, start: false, select: false };
let prevGamepadState = Object.assign({}, gamepadState);

function pollGamepad() {
    prevGamepadState = Object.assign({}, gamepadState);
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) { gp = gamepads[i]; break; }
    }
    
    if (gp) {
        const deadzone = 0.2;
        gamepadState.left = gp.axes[0] < -deadzone || (gp.buttons[14] && gp.buttons[14].pressed);
        gamepadState.right = gp.axes[0] > deadzone || (gp.buttons[15] && gp.buttons[15].pressed);
        gamepadState.up = gp.axes[1] < -deadzone || (gp.buttons[12] && gp.buttons[12].pressed);
        gamepadState.down = gp.axes[1] > deadzone || (gp.buttons[13] && gp.buttons[13].pressed);
        
        gamepadState.shoot = gp.buttons[0] && gp.buttons[0].pressed;
        gamepadState.bomb = gp.buttons[1] && gp.buttons[1].pressed;
        gamepadState.focus = (gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[4] && gp.buttons[4].pressed) || (gp.buttons[5] && gp.buttons[5].pressed) || (gp.buttons[6] && gp.buttons[6].pressed) || (gp.buttons[7] && gp.buttons[7].pressed);
        gamepadState.start = gp.buttons[9] && gp.buttons[9].pressed;
        gamepadState.select = gp.buttons[8] && gp.buttons[8].pressed;
    } else {
        gamepadState = { up: false, down: false, left: false, right: false, shoot: false, bomb: false, focus: false, start: false, select: false };
    }
}

function handleGamepadButtons() {
    if (gamepadState.start && !prevGamepadState.start) {
        if (!gameStarted) {
            if (assetsLoaded === totalAssets) {
                if (!audio) { audio = new AudioManager(); audio.resume(); }
                gameStarted = true;
            }
        } else if (continueCountdown > 0) {
            processContinue();
        } else if (!gameOver && dialogueBox.style.display !== 'block' && summaryBox.style.display !== 'block' && resetAnimTimer <= 0) {
            isPaused = !isPaused;
        }
    }

    if (gameStarted && !gameOver && !isPaused && gamepadState.bomb && !prevGamepadState.bomb) {
        useBomb();
    }
    
    if (isPaused && gamepadState.shoot && !prevGamepadState.shoot) {
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

window.addEventListener('keydown', e => { 
    keys[e.code] = true; keys[e.key.toLowerCase()] = true; 
    
    if (e.code === 'KeyF' || e.key === 'f') toggleFullscreen();
    
    if (!gameStarted) {
        if (assetsLoaded < totalAssets) return;
        if (e.code === 'KeyZ' || e.code === 'Space' || e.code === 'Enter') { 
            if (!audio) { audio = new AudioManager(); audio.resume(); }
            gameStarted = true; 
        }
        // STAFF MODE:
        if (e.key === 'd') { linkIteration++; ngValEl.innerText = linkIteration; }
        if (e.key === 'b') { bombs = 9; bombsEl.innerText = bombs; power = 64; powerEl.innerText = power; }
    } else {
        if (e.code === 'Enter' || e.code === 'Escape') {
            if (!gameOver && dialogueBox.style.display !== 'block' && summaryBox.style.display !== 'block' && continueCountdown <= 0 && resetAnimTimer <= 0) {
                isPaused = !isPaused;
            }
        }
    }
    
    if (isPaused) { if (summaryBox.style.display === 'block' && (e.code === 'KeyZ' || e.key === 'z')) closeSummary(); else if (dialogueBox.style.display === 'block' && (e.code === 'KeyZ' || e.key === 'z')) progressDialogue(); }
    if (continueCountdown > 0 && (e.code === 'KeyC' || e.key === 'c' || e.code === 'Enter')) processContinue();
    if (gameStarted && !gameOver && !isPaused && (e.code === 'KeyX' || e.key === 'x')) useBomb();
});
window.addEventListener('keyup', e => { keys[e.code] = false; keys[e.key.toLowerCase()] = false; });

function updateHighScore() { if (score > sessionHiScore) { sessionHiScore = score; localStorage.setItem('fosozu_hiScore', sessionHiScore); hiScoreEl.innerText = sessionHiScore; } }
function startBossDialogue() { isPaused = true; dialogueIndex = 0; document.getElementById('dialogue-text').innerText = boss.intro[0]; dialogueBox.style.display = 'block'; }
function progressDialogue() { dialogueIndex++; if (dialogueIndex < boss.intro.length) { document.getElementById('dialogue-text').innerText = boss.intro[dialogueIndex]; } else { dialogueBox.style.display = 'none'; isPaused = false; } }

function useBomb() { 
    if (bombs > 0 && bombEffectTimer === 0) { 
        bombs--; bombsEl.innerText = bombs; bombEffectTimer = 60; shakeTimer = 35; 
        bossBullets.length = 0; enemyBullets.length = 0; 
        
        enemies.forEach(e => {
            score += 100;
            medals.push({ x: e.x, y: e.y });
            if (bombsSpawnedInWave < 1 && Math.random() < 0.05) {
                bombItems.push({ x: e.x, y: e.y });
                bombsSpawnedInWave++;
            }
            if (Math.random() < 0.45) powerItems.push({ x: e.x, y: e.y });
        });
        enemies.length = 0;
        scoreEl.innerText = score;

        if (boss) boss.hp -= 40; 
        if (audio) audio.playExplosion(); 
    } 
}

function closeSummary() { summaryBox.style.display = 'none'; isPaused = false; waveGraze = 0; scoreAtLastBoss = score; shieldBrokenInWave = false; updateHighScore(); }
function processContinue() { updateHighScore(); continueCountdown = 0; continueUsed = true; continueUI.style.display = 'none'; lives = 3; livesEl.innerText = lives; bombs = 3; bombsEl.innerText = bombs; power = 0; powerEl.innerText = power; score = 0; scoreEl.innerText = score; scoreAtLastBoss = 0; invulnTimer = 180; bossBullets.length = 0; enemyBullets.length = 0; enemies.length = 0; bombItems.length = 0; powerItems.length = 0; hasShield = false; grazeStreak = 0; shieldBrokenInWave = false; document.getElementById('shieldStat').style.display = 'none'; document.getElementById('shieldStreak').innerText = 0; linkIteration = 1; ngValEl.innerText = 1; accumulator = 0; stageTimer = 0; bombsSpawnedInWave = 0; }

function shoot() { 
    if (audio) audio.playShoot();
    
    // Core Shots
    if (hasShield) { bullets.push({ x: player.x, y: player.y - 30, vx: 0, vy: -18, w: 10, h: 40, damage: 2 }); bullets.push({ x: player.x - 15, y: player.y - 20, vx: -1.5, vy: -18, w: 10, h: 40, damage: 2 }); bullets.push({ x: player.x + 15, y: player.y - 20, vx: 1.5, vy: -18, w: 10, h: 40, damage: 2 }); } 
    else if (grazeStreak >= 5) { bullets.push({ x: player.x, y: player.y - 30, vx: 0, vy: -20, w: 4, h: 15, damage: 1.2 }); bullets.push({ x: player.x - 12, y: player.y - 20, vx: -3, vy: -18, w: 6, h: 15, damage: 1.2 }); bullets.push({ x: player.x + 12, y: player.y - 20, vx: 3, vy: -18, w: 6, h: 15, damage: 1.2 }); } 
    else { bullets.push({ x: player.x, y: player.y - 30, vx: 0, vy: -15, w: 4, h: 10, damage: 1 }); bullets.push({ x: player.x - 10, y: player.y - 20, vx: -2.5, vy: -14, w: 4, h: 10, damage: 1 }); bullets.push({ x: player.x + 10, y: player.y - 20, vx: 2.5, vy: -14, w: 4, h: 10, damage: 1 }); }

    // Homing Tracking Packets
    let homingCount = Math.floor(power / 16);
    if (homingCount > 0) {
        for (let i = 0; i < homingCount; i++) {
            let offset = (i - (homingCount-1)/2) * 10;
            bullets.push({ x: player.x + offset, y: player.y - 10, vx: (Math.random()-0.5)*4, vy: -10, w: 6, h: 6, damage: 0.5, isHoming: true, color: '#ffca3a' });
        }
    }

    // Satellite Shots
    let activeCount = power >= 48 ? 4 : (power >= 32 ? 3 : (power >= 16 ? 2 : (power >= 8 ? 1 : 0)));
    for (let i = 0; i < activeCount; i++) {
        bullets.push({ x: player.satellites[i].x, y: player.satellites[i].y, vx: 0, vy: -20, w: 4, h: 15, damage: 0.8, color: '#00f2ff' });
    }
}

function updatePlayer(ts) {
    const isFocused = keys['shift'] || gamepadState.focus;
    let s_cur = isFocused ? player.focusSpeed : player.speed;
    if (keys['arrowup'] || keys['w'] || gamepadState.up) player.y -= s_cur; 
    if (keys['arrowdown'] || keys['s'] || gamepadState.down) player.y += s_cur;
    if (keys['arrowleft'] || keys['a'] || gamepadState.left) player.x -= s_cur; 
    if (keys['arrowright'] || keys['d'] || gamepadState.right) player.x += s_cur;
    
    // Satellites lerping
    let activeCount = power >= 48 ? 4 : (power >= 32 ? 3 : (power >= 16 ? 2 : (power >= 8 ? 1 : 0)));
    for(let i=0; i<4; i++) {
        let targetX = player.x, targetY = player.y;
        if (i < activeCount) {
            if (isFocused) {
                let offsets = activeCount === 1 ? [0] :
                              activeCount === 2 ? [-45, 45] :
                              activeCount === 3 ? [-60, 0, 60] :
                              [-60, -30, 30, 60];
                targetX = player.x + offsets[i];
                targetY = player.y + 10;
            } else {
                let angle = (Date.now() / 400) + (i * Math.PI * 2 / activeCount);
                targetX = player.x + Math.cos(angle) * 55;
                targetY = player.y + Math.sin(angle) * 15;
            }
        }
        player.satellites[i].x += (targetX - player.satellites[i].x) * 0.3 * ts;
        player.satellites[i].y += (targetY - player.satellites[i].y) * 0.3 * ts;
    }

    if (keys['z'] || keys[' '] || gamepadState.shoot) { if (Date.now() % 60 < 10) shoot(); }

    const isOff = (player.x < 0 || player.x > 600 || player.y < 0 || player.y > 800);
    if (isOff) { stallingTimer++; warningBorder.style.display = 'block'; if (stallingTimer > 90) { shakeTimer = 40; player.x = 300; player.y = 600; stallingTimer = 0; score = Math.max(0, score - 500); scoreEl.innerText = score; } } else { stallingTimer = 0; document.getElementById('warning-border').style.display = 'none'; }
}

function updateProjectiles(ts) {
    bullets.forEach((b, i) => { 
        if (b.isHoming) {
            let closest = null;
            let minDist = Infinity;
            if (boss && boss.hp > 0) {
                let d = Math.hypot(boss.x - b.x, boss.y - b.y);
                if (d < minDist) { minDist = d; closest = boss; }
            }
            enemies.forEach(e => {
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
        
        b.y += b.vy * ts; 
        b.x += b.vx * ts; 
        if (b.y < -50 || b.x < -50 || b.x > 650) bullets.splice(i, 1); 
    });
    effects.forEach((eff, i) => { eff.r += 6; eff.opacity -= 0.05; if (eff.opacity <= 0) effects.splice(i, 1); });
}

function playerTakeDamage() {
    if (invulnTimer > 0 || bombEffectTimer > 0) return;
    
    let powerLost = Math.min(power, 16);
    power = Math.max(0, power - 16); powerEl.innerText = power; 
    
    for (let i = 0; i < powerLost; i++) {
        let angle = Math.random() * Math.PI * 2;
        let spd = Math.random() * 6 + 3;
        powerItems.push({ x: player.x, y: player.y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 5, spawnTime: Date.now() });
    }

    if (hasShield) { 
        hasShield = false; shieldBrokenInWave = true; invulnTimer = 60; shakeTimer = 20; 
        document.getElementById('shieldStat').style.display = 'none'; grazeStreak = 0; document.getElementById('shieldStreak').innerText = 0; 
        effects.push({ x: player.x, y: player.y, r: 40, opacity: 1 }); if(audio) audio.playShieldBreak(); 
    } else { 
        let bombsLost = bombs;
        bombs = 3; bombsEl.innerText = bombs; 
        for (let i = 0; i < bombsLost; i++) {
            let angle = Math.random() * Math.PI * 2;
            let spd = Math.random() * 5 + 4;
            bombItems.push({ x: player.x, y: player.y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 6, spawnTime: Date.now() });
        }

        lives--; livesEl.innerText = lives; 
        if(lives <= 0) { updateHighScore(); continueCountdown=10; continueUI.style.display='flex'; document.getElementById('continue-timer').innerText = 10; } 
        else { invulnTimer=120; shakeTimer=25; if(audio) audio.playExplosion(); } 
    }
}

function handleCollisions(ts) {
    const isFocused = keys['shift'] || gamepadState.focus;
    [bossBullets, enemyBullets].forEach(arr => {
        for (let i = arr.length - 1; i >= 0; i--) {
            let b = arr[i]; b.x += b.vx * ts; b.y += b.vy * ts;
            let d = Math.hypot(player.x - b.x, player.y - b.y);
            if (isFocused && !b.grazed && d < player.grazeSize && d > player.hitboxSize + 4 && invulnTimer === 0 && bombEffectTimer === 0) {
                b.grazed = true; graze++; waveGraze++; score += 50; scoreEl.innerText = score; document.getElementById('grazeVal').innerText = graze; slowMoTimer = 15;
                if (audio) audio.playGraze();
                if (!hasShield) { grazeStreak++; streakTimer = 90; document.getElementById('shieldStreak').innerText = grazeStreak; if (grazeStreak >= 10) { hasShield = true; document.getElementById('shieldStat').style.display = 'inline'; } }
            }
            if (d < player.hitboxSize + 4 && invulnTimer === 0 && bombEffectTimer === 0) { 
                playerTakeDamage();
            }
            if (b.y > 850 || b.y < -50 || b.x < -50 || b.x > 650) arr.splice(i, 1);
        }
    });

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        let d = Math.hypot(player.x - e.x, player.y - e.y);
        if (d < player.hitboxSize + 15 && invulnTimer === 0 && bombEffectTimer === 0) {
            playerTakeDamage();
            enemies.splice(i, 1);
        }
    }

    if (boss) {
        if (Math.hypot(player.x - boss.x, player.y - boss.y) < player.hitboxSize + 50 && invulnTimer === 0 && bombEffectTimer === 0) {
            playerTakeDamage();
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            if (Math.hypot(bullets[i].x - boss.x, bullets[i].y - boss.y) < 65) {
                let wasPhase1 = boss.hp > boss.maxHP / 2;
                boss.hp -= (bullets[i].damage || 1); 
                bullets.splice(i, 1); 
                hpFill.style.width = Math.max(0, (boss.hp / boss.maxHP * 100)) + "%";
                
                if (audio && Math.random() < 0.3) audio.playEnemyHit();
                
                let isPhase2 = boss.hp <= boss.maxHP / 2;
                if (wasPhase1 && isPhase2 && boss.hp > 0) {
                    boss.enterPhase2();
                    if (audio) audio.playBossPhaseChange();
                }

                if (boss.hp <= 0) { 
                    score += 5000; difficultyWave++; waveClearTimer = 150; bossMode = false; stageTimer = 0; bombsSpawnedInWave = 0;
                    if (audio) audio.playExplosion();
                    let b_name = boss.name;
                    let b_defeat = boss.defeat;
                    let isLastBoss = (boss.constructor === BossRoster[BossRoster.length - 1]);
                    
                    boss = null; 
                    document.getElementById('boss-ui').style.display = 'none'; 
                    
                    if (isLastBoss) { 
                        linkIteration++; ngValEl.innerText = linkIteration; 
                        iterText.innerText = "OVERCLOCKING TO ITERATION " + linkIteration + "..."; 
                        resetAnimTimer = 120; shakeTimer = 120; flashTimer = 50; 
                    } 
                    else { isPaused = true; summaryBox.style.display = 'block'; }
                    
                    let bonusAmt = (waveGraze * 100);
                    let bonusMsg = `<p style="color:#ff006e; font-style:italic;">"${b_defeat}"</p><hr>WAVE ${difficultyWave-1} COMPLETE<br>GRAZE BONUS: +${bonusAmt}`;
                    if (!shieldBrokenInWave) { bonusMsg += `<br>FLAWLESS UPLINK: +25,000!`; score += 25000; }
                    if (difficultyWave > 3 && !continueUsed) { bonusMsg += `<br>FULL BUFFER BONUS: +50,000!`; score += 50000; }
                    document.getElementById('summary-content').innerHTML = bonusMsg; score += bonusAmt; scoreEl.innerText = score; return;
                }
            }
        }
    }
}

function updateBoss(ts) {
    if (boss) {
        boss.update(ts, player, bossBullets);
        hpFill.style.background = (boss.hp < boss.maxHP/2) ? "#ffca3a" : "#ff006e";
    }
    // Spawn Boss when wave timer concludes
    if (!bossMode && waveClearTimer <= 0 && stageTimer >= WAVE_DURATION && enemies.length === 0) { 
        bossMode = true; 
        document.getElementById('boss-ui').style.display = 'block'; 
        
        let tIdx = (difficultyWave - 1) % BossRoster.length; 
        let BossClass = BossRoster[tIdx]; 
        boss = new BossClass(difficultyWave, linkIteration); 
        
        bossNameEl.innerText = boss.name; 
        startBossDialogue(); 
    }
}

function updateEnemies(ts) {
    if (!bossMode && waveClearTimer <= 0 && stageTimer < WAVE_DURATION && Math.random() < 0.12) {
        enemies.push({ x: Math.random()*540+30, y:-50, speed: (3.5+(difficultyWave*0.4)) * Math.min(3.5, 1 + (linkIteration-1)*0.05), type: Math.random()>0.5?'blue':'green', lastShot: Date.now() });
    }
    
    enemies.forEach((e, i) => {
        e.y += e.speed * ts;
        if (Date.now() - e.lastShot > 1000) { 
            let eSpd = Math.min(3.5, 1 + (linkIteration-1)*0.1);
            if (e.type === 'blue') { let r = (Date.now() / 400); for(let j=0; j<4; j++) { let a = r + (j * Math.PI / 2); enemyBullets.push({x:e.x, y:e.y, vx:Math.cos(a)*3*eSpd, vy:Math.sin(a)*3*eSpd, grazed:false}); } }
            else { let a_b = Math.atan2(player.y-e.y, player.x-e.x); for(let j=-2; j<=2; j++) { let a = a_b + (j * 0.25); enemyBullets.push({x:e.x, y:e.y, vx:Math.cos(a)*3.5*eSpd, vy:Math.sin(a)*3.5*eSpd, grazed:false}); } }
            e.lastShot = Date.now();
        }
        for(let bi=bullets.length-1; bi>=0; bi--) {
            if(Math.hypot(bullets[bi].x-e.x, bullets[bi].y-e.y)<40) { 
                enemies.splice(i,1); bullets.splice(bi,1); score+=100; scoreEl.innerText=score; 
                if (audio) audio.playEnemyHit(); 
                medals.push({ x: e.x, y: e.y }); 
                if (bombsSpawnedInWave < 1 && Math.random() < 0.05) {
                    bombItems.push({ x: e.x, y: e.y });
                    bombsSpawnedInWave++;
                }
                if (Math.random() < 0.45) powerItems.push({ x: e.x, y: e.y });
            }
        }
        if (e.y > 900) enemies.splice(i, 1);
    });

    const isPoCActive = player.y < 150 && (keys['shift'] || keys['z'] || keys[' '] || gamepadState.shoot || gamepadState.focus);

    bombItems.forEach((p, i) => { 
        if (isPoCActive) {
            let angle = Math.atan2(player.y - p.y, player.x - p.x);
            p.x += Math.cos(angle) * 15 * ts;
            p.y += Math.sin(angle) * 15 * ts;
        } else {
            if (p.vx !== undefined) { p.x += p.vx * ts; p.vx *= 0.95; }
            if (p.vy !== undefined) { p.y += p.vy * ts; p.vy += 0.2 * ts; if (p.vy > 3) p.vy = 3; }
            else { p.y += 3 * ts; }
        }
        if ((!p.spawnTime || Date.now() - p.spawnTime > 500) && Math.hypot(player.x-p.x, player.y-p.y)<30){ bombs++; bombsEl.innerText=bombs; bombItems.splice(i,1); } 
        else if(p.y > 850 || p.x < -100 || p.x > 700) bombItems.splice(i,1); 
    });
    
    powerItems.forEach((p, i) => { 
        if (isPoCActive) {
            let angle = Math.atan2(player.y - p.y, player.x - p.x);
            p.x += Math.cos(angle) * 15 * ts;
            p.y += Math.sin(angle) * 15 * ts;
        } else {
            if (p.vx !== undefined) { p.x += p.vx * ts; p.vx *= 0.95; }
            if (p.vy !== undefined) { p.y += p.vy * ts; p.vy += 0.2 * ts; if (p.vy > 3.5) p.vy = 3.5; }
            else { p.y += 3.5 * ts; }
        }
        if ((!p.spawnTime || Date.now() - p.spawnTime > 500) && Math.hypot(player.x-p.x, player.y-p.y)<30){ power = Math.min(64, power + 1); powerEl.innerText = power; powerItems.splice(i,1); } 
        else if(p.y > 850 || p.x < -100 || p.x > 700) powerItems.splice(i,1); 
    });

    medals.forEach((m, i) => { 
        if (isPoCActive) {
            let angle = Math.atan2(player.y - m.y, player.x - m.x);
            m.x += Math.cos(angle) * 15 * ts;
            m.y += Math.sin(angle) * 15 * ts;
        } else {
            m.y += 4 * ts; 
        }
        if (Math.hypot(player.x-m.x, player.y-m.y)<30){ score += 500; scoreEl.innerText=score; medals.splice(i,1); } 
        else if(m.y > 850) medals.splice(i,1); 
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
    
    updatePlayer(ts);
    updateProjectiles(ts);
    handleCollisions(ts);
    updateBoss(ts);
    updateEnemies(ts);
}

function draw() {
    ctx.save(); if (shakeTimer > 0) { const m = shakeTimer / 4; ctx.translate((Math.random()-0.5)*m, (Math.random()-0.5)*m); }
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, 600, 800);
    
    if (!gameStarted) { 
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '20px Courier'; 
        if (assetsLoaded < totalAssets) {
            ctx.fillText(`LOADING ASSETS... (${assetsLoaded}/${totalAssets})`, 300, 380);
        } else {
            ctx.fillText("READY - PRESS Z OR START", 300, 380); 
            ctx.font='14px Courier'; 
            ctx.fillText("HI-SCORE: " + sessionHiScore, 300, 410); 
            ctx.fillText("LINK ITERATION: " + linkIteration, 300, 440); 
        }
        ctx.restore(); return; 
    }
    
    stars.forEach(s => { ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.size, s.size); });
    if (invulnTimer % 10 < 5) { if (assets.player.loaded) ctx.drawImage(assets.player.img, player.x-50, player.y-50, 100, 100); else { ctx.fillStyle='purple'; ctx.beginPath(); ctx.arc(player.x, player.y, 25, 0, 7); ctx.fill(); } }
    
    if (boss) {
        if (assets[boss.type] && assets[boss.type].loaded) { 
            if (boss.hp < boss.maxHP/2 && Date.now() % 200 < 100) ctx.globalAlpha = 0.5; 
            ctx.drawImage(assets[boss.type].img, boss.x-75, boss.y-75, 150, 150); 
            ctx.globalAlpha = 1.0; 
        } else {
            const colorMap = { pink: '#ff006e', blue: '#00f2ff', green: '#0f0', purple: '#b5179e', amber: '#f77f00', crimson: '#d90429' };
            ctx.fillStyle = colorMap[boss.type] || '#fff';
            if (boss.hp < boss.maxHP/2 && Date.now() % 200 < 100) ctx.globalAlpha = 0.5; 
            ctx.beginPath();
            ctx.arc(boss.x, boss.y, 75, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0; 
        }
        
        if (boss.flashTimer > 0 && Math.floor(boss.flashTimer) % 6 < 3) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(boss.x, boss.y, 75, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
    }
    
    enemies.forEach(e => { ctx.fillStyle='#444'; ctx.fillRect(e.x-15, e.y-15, 30, 30); ctx.strokeStyle=(e.type==='blue'?'#00f2ff':'#0f0'); ctx.strokeRect(e.x-15, e.y-15, 30, 30); });
    
    bombItems.forEach(p => { ctx.fillStyle='#f0f'; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 7); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText("B", p.x-4, p.y+4); });
    powerItems.forEach(p => { ctx.fillStyle='#ff006e'; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText("P", p.x-4, p.y+4); });
    medals.forEach(m => { ctx.fillStyle='#ffca3a'; ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, 7); ctx.fill(); ctx.fillStyle='#000'; ctx.fillText("M", m.x-3, m.y+4); });
    
    // Draw Satellites
    let activeCount = power >= 48 ? 4 : (power >= 32 ? 3 : (power >= 16 ? 2 : (power >= 8 ? 1 : 0)));
    for(let i=0; i<activeCount; i++) {
        let s = player.satellites[i];
        
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate((Date.now() % 10000) * 0.02);
        
        // 4. Left hemisphere (Cyan)
        ctx.fillStyle = '#00f2ff';
        ctx.beginPath();
        ctx.arc(0, 0, 15, Math.PI / 2, Math.PI * 1.5);
        ctx.fill();
        
        // 5. Right hemisphere (Magenta)
        ctx.fillStyle = '#b5179e';
        ctx.beginPath();
        ctx.arc(0, 0, 15, Math.PI * 1.5, Math.PI * 2.5);
        ctx.fill();
        
        // 6. Top teardrop (Magenta)
        ctx.fillStyle = '#b5179e';
        ctx.beginPath(); ctx.arc(0, -7.5, 7.5, 0, Math.PI * 2); ctx.fill();
        
        // 7. Bottom teardrop (Cyan)
        ctx.fillStyle = '#00f2ff';
        ctx.beginPath(); ctx.arc(0, 7.5, 7.5, 0, Math.PI * 2); ctx.fill();
        
        // 8. Top eye (Cyan)
        ctx.fillStyle = '#00f2ff';
        ctx.beginPath(); ctx.arc(0, -7.5, 2, 0, Math.PI * 2); ctx.fill();
        
        // 9. Bottom eye (Magenta)
        ctx.fillStyle = '#b5179e';
        ctx.beginPath(); ctx.arc(0, 7.5, 2, 0, Math.PI * 2); ctx.fill();
        
        ctx.restore();
    }
    
    bullets.forEach(b => { ctx.fillStyle = b.color || (hasShield ? '#00f2ff' : (grazeStreak >= 5 ? '#ffca3a' : '#00f2ff')); ctx.fillRect(b.x - (b.w||4)/2, b.y - (b.h||10), (b.w||4), (b.h||10)); });
    effects.forEach(eff => { ctx.strokeStyle = `rgba(0, 242, 255, ${eff.opacity})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(eff.x, eff.y, eff.r, 0, Math.PI * 2); ctx.stroke(); }); 
    bossBullets.forEach(b => { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 7); ctx.fill(); });
    
    ctx.fillStyle = '#0f0'; enemyBullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill(); });
    const isFocused = keys['shift'] || gamepadState.focus;
    if (isFocused) { ctx.fillStyle='red'; ctx.beginPath(); ctx.arc(player.x,player.y,player.hitboxSize,0,7); ctx.fill(); }
    
    if (isPaused && dialogueBox.style.display !== 'block' && summaryBox.style.display !== 'block' && resetAnimTimer <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,600,800);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '30px Courier';
        ctx.fillText("PAUSED", 300, 400);
    }
    
    if (gameOver) { ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.fillRect(0,0,600,800); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText("SIGNAL LOST", 300, 400); }
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
    
    if (continueCountdown > 0) {
        if (timestamp - lastContinueTime > 1000) {
            continueCountdown--;
            document.getElementById('continue-timer').innerText = continueCountdown;
            lastContinueTime = timestamp;
            if (continueCountdown <= 0) gameOver = true;
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
