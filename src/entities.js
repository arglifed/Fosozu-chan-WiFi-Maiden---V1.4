import { assets, playSound } from './engine.js';

export const player = { x: 300, y: 700, speed: 6, focusSpeed: 2.5, hitboxSize: 4, grazeSize: 25 };

export const gameState = {
    score: 0, graze: 0, lives: 3, bombs: 2, 
    gameOver: false, gameStarted: false, isPaused: false,
    bossMode: false, difficultyWave: 1, linkIteration: 1
};

export const lists = {
    bullets: [], bossBullets: [], enemyBullets: [],
    enemies: [], powerups: [], medals: [], effects: []
};

export const bossLore = {
    pink: { intro: ["Ping-ko: B-Baka! Why are you clogging my bandwidth?!", "Ping-ko: Prepare to be throttled!"], defeat: "Ping-ko: Ugh... fine! Synced!" },
    blue: { intro: ["Spiral-ko: Scanning... Scanning...", "Spiral-ko: Encrypting your data packets!"], defeat: "Spiral-ko: Spirals... unraveled!" },
    green: { intro: ["Shotgun-ko: MOVE! Bottleneck detected!", "Shotgun-ko: EAT MY UPLOAD SPEED!"], defeat: "Shotgun-ko: FINAL COMMAND: SERVER RESET!" }
};