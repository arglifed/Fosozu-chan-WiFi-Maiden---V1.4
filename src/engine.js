// Audio Engine
export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
export function playSound(freq, type, duration, vol=0.1) {
    if (audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

// Input Handling
export const keys = {};
window.addEventListener('keydown', e => { 
    if (audioCtx.state === 'suspended') audioCtx.resume();
    keys[e.code] = true; 
    keys[e.key.toLowerCase()] = true; 
});
window.addEventListener('keyup', e => { 
    keys[e.code] = false; 
    keys[e.key.toLowerCase()] = false; 
});

// Asset Management
export const assets = { 
    player: { img: new Image(), src: 'assets/images/fosozu.png', loaded: false }, 
    pink: { img: new Image(), src: 'assets/images/pink_girl.png', loaded: false }, 
    blue: { img: new Image(), src: 'assets/images/blue_girl.png', loaded: false }, 
    green: { img: new Image(), src: 'assets/images/green_girl.png', loaded: false } 
};

Object.values(assets).forEach(a => { 
    a.img.onload = () => a.loaded = true; 
    a.img.src = a.src; 
});