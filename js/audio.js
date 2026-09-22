class AudioManager {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Pre-generate white noise buffer for explosions (Extended to 1.5s)
        const bufferSize = this.ctx.sampleRate * 1.5;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        // Volume State
        this.masterVolume = parseFloat(localStorage.getItem('fosozu_vol_master')) ?? 1.0;
        if (isNaN(this.masterVolume)) this.masterVolume = 1.0;
        this.bgmVolume = parseFloat(localStorage.getItem('fosozu_vol_bgm')) ?? 1.0;
        if (isNaN(this.bgmVolume)) this.bgmVolume = 1.0;
        this.seVolume = parseFloat(localStorage.getItem('fosozu_vol_se')) ?? 1.0;
        if (isNaN(this.seVolume)) this.seVolume = 1.0;

        // BGM Setup
        const bgmFiles = {
            'title': 'audio/bgm_title.wav',
            'alt_title': 'audio/bgm_alt_title.wav',
            'stage1': 'audio/bgm_stage1.wav',
            'boss1': 'audio/bgm_boss1.wav',
            'stage2': 'audio/bgm_stage2.wav',
            'boss2': 'audio/bgm_boss2.wav',
            'stage3': 'audio/bgm_stage3.wav',
            'boss3': 'audio/bgm_boss3.wav',
            'stage4': 'audio/bgm_stage4.wav',
            'boss4': 'audio/bgm_boss4.wav',
            'stage5': 'audio/bgm_stage5.wav',
            'boss5': 'audio/bgm_boss5.wav',
            'stage6': 'audio/bgm_stage6.wav',
            'boss6': 'audio/bgm_boss6.wav',
            'boss6_phase2': 'audio/bgm_boss6_phase2.wav',
            'ending': 'audio/bgm_ending.wav',
            'credits': 'audio/bgm_credits.wav',
            'gameover': 'audio/bgm_gameover.wav',
            'extra_stage': 'audio/bgm_extra_stage.wav',
            'extra_boss': 'audio/bgm_extra_boss.wav',
            'extra_ending': 'audio/bgm_extra_ending.wav'
        };

        const noLoopTracks = ['gameover', 'ending', 'credits', 'extra_ending'];

        this.bgm = {};
        for (let key in bgmFiles) {
            let audioEl = new Audio(bgmFiles[key]);
            audioEl.preload = "auto"; // Explicitly request full download to prevent streaming aborts
            audioEl.loop = !noLoopTracks.includes(key);
            audioEl.addEventListener('ended', function() {
                if (!noLoopTracks.includes(key)) {
                    this.currentTime = 0;
                    this.play().catch(e => console.warn('BGM Loop fallback prevented:', e));
                }
            });
            audioEl.volume = this.masterVolume * this.bgmVolume;
            this.bgm[key] = audioEl;
        }
        
        this.currentBGMKey = null;
        this.fadeInterval = null;
        this.pausedTrackKey = null;
    }

    pauseForContinue() {
        if (!this.currentBGMKey) return;
        if (this.currentBGMKey === 'gameover') return; // Prevent overwriting pausedTrackKey on double-calls
        
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        
        let currentTrack = this.bgm[this.currentBGMKey];
        if (currentTrack) {
            currentTrack.pause();
            this.pausedTrackKey = this.currentBGMKey;
            this.currentBGMKey = null; // Clear so hardCut doesn't reset it
        }
        
        this.hardCut('gameover');
    }

    resumeFromContinue() {
        if (!this.pausedTrackKey) return;
        
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }

        if (this.currentBGMKey && this.bgm[this.currentBGMKey]) {
            this.bgm[this.currentBGMKey].pause();
            this.bgm[this.currentBGMKey].currentTime = 0;
        }
        
        this.currentBGMKey = this.pausedTrackKey;
        let resumeTrack = this.bgm[this.pausedTrackKey];
        
        if (resumeTrack) {
            resumeTrack.volume = this.masterVolume * this.bgmVolume;
            resumeTrack.play().catch(e => console.warn('BGM Autoplay prevented:', e));
        }
        
        this.pausedTrackKey = null;
    }

    playBGM(trackKey) {
        if (!this.bgm[trackKey]) return;
        if (this.currentBGMKey === trackKey) return; // Already playing

        if (this.currentBGMKey && this.bgm[this.currentBGMKey]) {
            this.bgm[this.currentBGMKey].pause();
            this.bgm[this.currentBGMKey].currentTime = 0;
        }

        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }

        this.currentBGMKey = trackKey;
        this.bgm[trackKey].volume = this.masterVolume * this.bgmVolume;
        this.bgm[trackKey].play().catch(e => console.warn('BGM Autoplay prevented:', e));
    }

    hardCut(trackKey) {
        this.playBGM(trackKey);
    }

    fadeTransition(nextTrackKey, duration = 1.0) {
        if (!this.bgm[nextTrackKey]) return;
        if (this.currentBGMKey === nextTrackKey) return;

        let prevTrack = this.currentBGMKey ? this.bgm[this.currentBGMKey] : null;
        let nextTrack = this.bgm[nextTrackKey];

        let targetVol = this.masterVolume * this.bgmVolume;

        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
            if (prevTrack) prevTrack.volume = targetVol;
        }

        this.currentBGMKey = nextTrackKey;
        nextTrack.volume = 0;
        nextTrack.currentTime = 0;
        nextTrack.play().catch(e => console.warn('BGM Autoplay prevented:', e));

        const steps = 20;
        const intervalTime = (duration * 1000) / steps;
        const volumeStep = targetVol / steps;
        let currentStep = 0;

        this.fadeInterval = setInterval(() => {
            currentStep++;
            
            if (prevTrack && prevTrack.volume >= volumeStep) {
                prevTrack.volume -= volumeStep;
            }
            if (nextTrack.volume <= targetVol - volumeStep) {
                nextTrack.volume += volumeStep;
            }

            if (currentStep >= steps) {
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                if (prevTrack) {
                    prevTrack.pause();
                    prevTrack.currentTime = 0;
                    prevTrack.volume = targetVol;
                }
                nextTrack.volume = targetVol;
            }
        }, intervalTime);
    }

    updateVolumes(master, bgm, se) {
        this.masterVolume = master;
        this.bgmVolume = bgm;
        this.seVolume = se;

        localStorage.setItem('fosozu_vol_master', master);
        localStorage.setItem('fosozu_vol_bgm', bgm);
        localStorage.setItem('fosozu_vol_se', se);

        if (this.currentBGMKey && this.bgm[this.currentBGMKey]) {
            if (!this.fadeInterval) {
                this.bgm[this.currentBGMKey].volume = this.masterVolume * this.bgmVolume;
            }
        }
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playGraze() {
        if (!this.ctx) return;
        const mainOsc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        
        mainOsc.type = 'square';
        subOsc.type = 'square';
        
        mainOsc.frequency.setValueAtTime(800, this.ctx.currentTime);
        mainOsc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.05);
        
        subOsc.frequency.setValueAtTime(400, this.ctx.currentTime); // Down an octave
        subOsc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);

        let vol = 0.05 * this.masterVolume * this.seVolume;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        
        mainOsc.connect(filter);
        subOsc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        mainOsc.start(); subOsc.start();
        mainOsc.stop(this.ctx.currentTime + 0.05); subOsc.stop(this.ctx.currentTime + 0.05);
    }

    playShoot() {
        if (!this.ctx) return;
        const mainOsc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        
        mainOsc.type = 'sawtooth';
        subOsc.type = 'square'; // Brassy bite
        
        mainOsc.frequency.setValueAtTime(600, this.ctx.currentTime);
        mainOsc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        
        subOsc.frequency.setValueAtTime(300, this.ctx.currentTime); // Down an octave
        subOsc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.1);
        
        let vol = 0.04 * this.masterVolume * this.seVolume;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        
        mainOsc.connect(filter);
        subOsc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        mainOsc.start(); subOsc.start();
        mainOsc.stop(this.ctx.currentTime + 0.1); subOsc.stop(this.ctx.currentTime + 0.1);
    }

    playExplosion() {
        if (!this.ctx) return;
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1.0); // Sweep to 50Hz

        let vol = 0.4 * this.masterVolume * this.seVolume;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5); // Extended to 1.5s
        
        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        noiseSource.start();
        noiseSource.stop(this.ctx.currentTime + 1.5);
    }

    playShieldBreak() {
        if (!this.ctx) return;
        let vol = 0.15 * this.masterVolume * this.seVolume;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        gain.connect(this.ctx.destination);

        [200, 215, 280].forEach(freq => {
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            osc.connect(gain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.4);
        });
    }

    playEnemyHit() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.05);
        
        let vol = 0.1 * this.masterVolume * this.seVolume;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playBossPhaseChange() {
        if (!this.ctx) return;
        const mainOsc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        mainOsc.type = 'sine';
        subOsc.type = 'triangle';
        
        // Rising chime
        mainOsc.frequency.setValueAtTime(440, this.ctx.currentTime); // A4
        mainOsc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.6); // A5
        
        subOsc.frequency.setValueAtTime(880, this.ctx.currentTime); 
        subOsc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.6);
        
        let vol = 0.15 * this.masterVolume * this.seVolume;
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
        
        mainOsc.connect(gain);
        subOsc.connect(gain);
        gain.connect(this.ctx.destination);
        
        mainOsc.start(); subOsc.start();
        mainOsc.stop(this.ctx.currentTime + 1.5); subOsc.stop(this.ctx.currentTime + 1.5);
    }
}
