class EnemyBullet {
    constructor(x, y, vx, vy, shape = 'orb', colorBase = '#ff003c') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.shape = shape;
        this.colorBase = colorBase;
        this.angle = Math.atan2(this.vy, this.vx);
        this.grazed = false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.shape === 'orb') {
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, '#ffffff');
            grad.addColorStop(1, this.colorBase);
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (this.shape === 'rice') {
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
            grad.addColorStop(0, this.colorBase);
            grad.addColorStop(1, this.colorBase);
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (this.shape === 'amulet') {
            ctx.fillStyle = this.colorBase;
            ctx.fillRect(-8, -6, 16, 12);
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(-5, -3, 10, 6);
        }

        ctx.restore();
    }
}

class Boss {
    constructor(difficultyWave, linkIteration) {
        this.x = 300;
        this.y = -100;
        this.targetY = 150;
        
        let hpScale = Math.min(5.0, 1 + (linkIteration - 1) * 0.05);
        this.maxHP = (1620 + (difficultyWave * 540)) * hpScale;
        this.hp = this.maxHP;
        
        this.attackTimer = 0;
        this.timer = 0;
        
        this.name = "BOSS";
        this.type = "unknown";
        this.intro = [];
        this.defeat = "";
        
        this.linkIteration = linkIteration;
        this.phase2 = false;
        this.flashTimer = 0;
    }
    
    enterPhase2() {
        this.phase2 = true;
        this.flashTimer = 40; // Frames to flash and not shoot
    }
    
    update(ts, player, bossBullets) {
        if (this.flashTimer > 0) this.flashTimer -= ts;
        
        if (this.y < this.targetY) {
            this.y += 2.5 * ts;
        } else {
            this.timer += 0.025 * ts;
            this.x = 300 + Math.sin(this.timer) * 180;
            if (this.flashTimer <= 0) {
                this.shoot(player, bossBullets);
            }
        }
    }
    
    shoot(player, bossBullets) {
        // To be overridden by subclasses
    }
}

class PingKo extends Boss {
    constructor(difficultyWave, linkIteration) {
        super(difficultyWave, linkIteration);
        this.maxHP *= 0.8;
        this.hp = this.maxHP;
        this.name = "PING-KO";
        this.type = "pink";
        if (typeof is2PMode !== 'undefined' && is2PMode) {
            this.intro = [
                "Ping-ko (P2): Wait... is that ME? Fosozu, who is this bootleg clone taking up my bandwidth?!", 
                "Clone Ping-ko: I am the optimized version! Your legacy code is obsolete!", 
                "Ping-ko (P2): Oh, it is ON! Let's scramble her packets, Fosozu!"
            ];
        } else {
            this.intro = [
                "Ping-ko: Unregistered connection detected! Fosozu, you're not authorized for this routing node!", 
                "Ping-ko: I'll scramble your packets before you even reach the gateway!"
            ];
        }
        this.defeat = "Ping-ko: Ugh... routing tables corrupted... Satsuki is going to delete you for this!";
    }

    update(ts, player, bossBullets) {
        if (this.flashTimer > 0) this.flashTimer -= ts;
        
        if (this.entering === undefined) this.entering = true;
        
        if (this.entering) {
            this.y += 2.5 * ts;
            if (this.y >= this.targetY) this.entering = false;
        } else {
            if (this.flashTimer <= 0) {
                this.shoot(player, bossBullets);
            }
            
            if (this.dashTimer === undefined) { this.dashTimer = 90; this.dashProgress = 1; }
            
            this.dashTimer -= ts;
            if (this.dashTimer <= 0) {
                this.dashStartX = this.x;
                this.dashStartY = this.y;
                // Always dash to the opposite side of the screen for long, aggressive sweeps
                this.dashTargetX = (this.x < 300) ? 350 + Math.random() * 150 : 100 + Math.random() * 150;
                this.dashTargetY = 50 + Math.random() * 150;
                this.dashProgress = 0;
                this.dashTimer = 60 + Math.random() * 30; // Shorter wait between dashes
            }
            
            if (this.dashProgress < 1) {
                this.dashProgress += 0.05 * ts; // Twice as fast (20 frames to complete)
                if (this.dashProgress > 1) this.dashProgress = 1;
                let ease = (1 - Math.cos(Math.PI * this.dashProgress)) / 2;
                this.x = this.dashStartX + (this.dashTargetX - this.dashStartX) * ease;
                this.y = this.dashStartY + (this.dashTargetY - this.dashStartY) * ease;
            } else {
                // Gentle hover to prevent static strobe/stutter illusion
                this.timer += 0.05 * ts;
                this.x = this.dashTargetX + Math.sin(this.timer) * 8;
                this.y = this.dashTargetY + Math.cos(this.timer * 0.8) * 4;
            }
        }
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
        
        if (!this.phase2) {
            const cycle = Math.floor(this.attackTimer / 180) % 2;
            if (cycle === 0) { 
                if (this.attackTimer % 4 === 0) { 
                    let a = (this.attackTimer * 0.15); 
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 6*spd), Math.sin(a)*Math.min(5.0, 6*spd), 'orb', '#00ffff')); 
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a + Math.PI)*Math.min(5.0, 6*spd), Math.sin(a + Math.PI)*Math.min(5.0, 6*spd), 'orb', '#ff69b4')); 
                } 
            } else { 
                if (this.attackTimer % 12 === 0) { 
                    let a = Math.atan2(player.y - this.y, player.x - this.x); 
                    for(let i=-1; i<=1; i++) { 
                        bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a + i*0.1)*Math.min(5.0, 8*spd), Math.sin(a + i*0.1)*Math.min(5.0, 8*spd), 'rice', '#00ffff')); 
                    } 
                } 
            }
        } else {
            // Spell Card Phase
            const p2Spd = Math.min(3.5, 1.8 * (1 + (this.linkIteration - 1) * 0.1));
            // Dense 4-way spirals + targeted 5-way spread
            if (this.attackTimer % 3 === 0) { 
                let a = (this.attackTimer * 0.2); 
                for (let i = 0; i < 4; i++) {
                    let off = i * Math.PI / 2;
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a + off)*Math.min(5.0, 7*p2Spd), Math.sin(a + off)*Math.min(5.0, 7*p2Spd), 'orb', '#ff69b4')); 
                }
            }
            if (this.attackTimer % 60 === 0) {
                let a = Math.atan2(player.y - this.y, player.x - this.x); 
                for(let i=-2; i<=2; i++) { 
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a + i*0.15)*Math.min(5.0, 9*p2Spd), Math.sin(a + i*0.15)*Math.min(5.0, 9*p2Spd), 'rice', '#00ffff')); 
                } 
            }
        }
    }
}

class SpiralKo extends Boss {
    constructor(difficultyWave, linkIteration) {
        super(difficultyWave, linkIteration);
        this.name = "SPIRAL-KO";
        this.type = "blue";
        this.intro = (typeof is2PMode !== 'undefined' && is2PMode) ? [
            "Spiral-ko: Two anomalies? The anomaly-to-bandwidth ratio is unacceptable.",
            "Spiral-ko: Initiating double-encryption protocols to weave you both into an endless loop!"
        ] : [
            "Spiral-ko: Encryption spirals active. Your plaintext presence is a vulnerability to the system.", 
            "Spiral-ko: I will weave your data into an inescapable loop!"
        ];
        this.defeat = "Spiral-ko: Critical error! My logic loops... shattered...";
    }

    update(ts, player, bossBullets) {
        if (this.flashTimer > 0) this.flashTimer -= ts;
        
        if (this.y < this.targetY && this.timer === 0) {
            this.y += 2.5 * ts;
            if (this.y >= this.targetY) this.timer = Math.PI / 2;
        } else {
            this.timer += 0.015 * ts;
            this.x = 300 + Math.sin(this.timer) * 250;
            this.y = 150 + Math.sin(this.timer * 2) * 60;
            
            if (this.flashTimer <= 0) {
                this.shoot(player, bossBullets);
            }
        }
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
        
        if (!this.phase2) {
            if (this.attackTimer % 20 === 0) { 
                for(let i=0; i<16; i++) { 
                    let a = i * (Math.PI*2/16) + (this.attackTimer*0.05); 
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 4*spd), Math.sin(a)*Math.min(5.0, 4*spd), 'rice', '#ff1493')); 
                } 
            }
        } else {
            // Spell Card Phase
            const p2Spd = Math.min(3.5, 1.5 * (1 + (this.linkIteration - 1) * 0.1));
            // Interlocking reverse spirals
            if (this.attackTimer % 15 === 0) { 
                for(let i=0; i<18; i++) { 
                    let a = i * (Math.PI*2/18) + (this.attackTimer*0.08); 
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 5*p2Spd), Math.sin(a)*Math.min(5.0, 5*p2Spd), 'rice', '#ff1493')); 
                    
                    let a2 = i * (Math.PI*2/18) - (this.attackTimer*0.08); 
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a2)*Math.min(5.0, 4*p2Spd), Math.sin(a2)*Math.min(5.0, 4*p2Spd), 'rice', '#ffffff')); 
                } 
            }
        }
    }
}

class ShotgunKo extends Boss {
    constructor(difficultyWave, linkIteration) {
        super(difficultyWave, linkIteration);
        this.name = "SHOTGUN-KO";
        this.type = "green";
        this.intro = (typeof is2PMode !== 'undefined' && is2PMode) ? [
            "Shotgun-ko: A dual-packet stream?! You're flooding the buffer! I'm flushing you both out!"
        ] : [
            "Shotgun-ko: WARNING: Payload exceeds maximum weight! Discarding unauthorized packets... by force!", 
            "Shotgun-ko: You want bandwidth?! Take it all at point-blank range!"
        ];
        this.defeat = "Shotgun-ko: Buffer overflow... I'm fragmenting...!";
    }

    update(ts, player, bossBullets) {
        if (this.flashTimer > 0) this.flashTimer -= ts;
        
        if (this.retreating) {
            if (this.retreatProgress === undefined) this.retreatProgress = 0;
            this.retreatProgress += 0.03 * ts;
            if (this.retreatProgress > 1) this.retreatProgress = 1;
            
            let ease = (1 - Math.cos(Math.PI * this.retreatProgress)) / 2;
            this.y = this.retreatStartY - (this.retreatStartY - 100) * ease;
            
            if (this.retreatProgress === 1) {
                this.retreating = false;
                this.timer = 0;
            }
        } else if (this.y < this.targetY && this.timer === 0) {
            this.y += 2.5 * ts;
        } else {
            this.timer += ts;
            
            this.y += 0.8 * ts;
            this.x = 300 + Math.sin(this.timer * 0.015) * 120;
            
            if (this.y > 450) {
                this.retreating = true;
                this.retreatStartY = this.y;
                this.retreatProgress = 0;
            }
            
            if (this.flashTimer <= 0) {
                this.shoot(player, bossBullets);
            }
        }
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
        
        if (!this.phase2) {
            if (this.attackTimer % 45 === 0) { 
                let a_b = Math.atan2(player.y-this.y, player.x-this.x); 
                for(let j=-3; j<=3; j++) { 
                    let a = a_b + (j * 0.15); 
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 9*spd), Math.sin(a)*Math.min(5.0, 9*spd), 'orb', '#ff4500')); 
                } 
            }
        } else {
            // Spell Card Phase
            const p2Spd = Math.min(3.5, 1.6 * (1 + (this.linkIteration - 1) * 0.1));
            // Massive dense shotgun blasts + random side pellets
            if (this.attackTimer % 40 === 0) { 
                let a_b = Math.atan2(player.y-this.y, player.x-this.x); 
                // Dense core
                for(let j=-5; j<=5; j++) { 
                    let a = a_b + (j * 0.10); 
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 10*p2Spd), Math.sin(a)*Math.min(5.0, 10*p2Spd), 'orb', '#ff4500')); 
                }
                // Random scatter
                for(let i=0; i<8; i++) {
                    let a = a_b + (Math.random() - 0.5) * 2.0;
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 8*p2Spd), Math.sin(a)*Math.min(5.0, 8*p2Spd), 'orb', '#ffffff'));
                }
            }
        }
    }
}

class CosmicCrow extends Boss {
    constructor(difficultyWave, linkIteration) {
        super(difficultyWave, linkIteration);
        this.maxHP *= 0.8;
        this.hp = this.maxHP;
        this.name = "COSMIC CROW";
        this.type = "purple";
        this.intro = (typeof is2PMode !== 'undefined' && is2PMode) ? [
            "Cosmic Crow: *Caw!* Two maidens riding the data streams... but even together, you cannot weather this storm."
        ] : [
            "Cosmic Crow: *Caw!* The packet winds whisper of a maiden seeking the Root... and the shadow lurking beneath it.", 
            "Cosmic Crow: Turn back, Fosozu. The firewall is absolute, and the abyss below is waking."
        ];
        this.defeat = "Cosmic Crow: My wings scatter... perhaps you ARE the storm...";
    }

    update(ts, player, bossBullets) {
        if (this.flashTimer > 0) this.flashTimer -= ts;
        if (this.y < this.targetY) {
            this.y += 2.5 * ts;
            this.timer = 0;
        } else {
            if (this.flashTimer <= 0) this.shoot(player, bossBullets);
            
            if (this.swoopProgress === undefined) { this.swoopTimer = 180; this.swoopProgress = 1; }
            
            if (this.swoopProgress >= 1) {
                let pauseTracking = false;
                if (!this.phase2) {
                    if (this.attackTimer % 90 >= 0 && this.attackTimer % 90 < 20) pauseTracking = true;
                } else {
                    if (this.attackTimer % 45 >= 0 && this.attackTimer % 45 < 20) pauseTracking = true;
                }
                
                if (!pauseTracking) {
                    let dx = player.x - this.x;
                    this.x += dx * 0.015 * ts;
                }
                
                this.timer += 0.02 * ts;
                this.y = this.targetY + Math.sin(this.timer) * 10;
                
                this.swoopTimer -= ts;
                if (this.swoopTimer <= 0) {
                    this.swoopProgress = 0;
                    this.swoopStartX = this.x;
                    this.swoopTargetX = player.x;
                }
            } else {
                this.swoopProgress += 0.015 * ts;
                if (this.swoopProgress > 1) {
                    this.swoopProgress = 1;
                    this.swoopTimer = 200;
                    this.timer = 0;
                }
                
                let t = this.swoopProgress;
                this.x = this.swoopStartX + (this.swoopTargetX - this.swoopStartX) * t;
                let arc = Math.sin(t * Math.PI);
                this.y = this.targetY + (450 * arc);
            }
        }
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
        
        if (!this.phase2) {
            if (this.attackTimer % 15 === 0) { 
                for(let i=0; i<3; i++) {
                    let a = Math.PI / 2 + (i - 1) * 0.3 + Math.sin(this.attackTimer * 0.1) * 0.5;
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 7*spd), Math.sin(a)*Math.min(5.0, 7*spd), 'rice', '#8a2be2'));
                }
            }
            if (this.attackTimer % 90 === 0) {
                let burstCenterA = Math.atan2(player.y - this.y, player.x - this.x);
                for(let i=0; i<8; i++) {
                    let a = burstCenterA + (i * Math.PI * 2 / 8);
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 3*spd), Math.sin(a)*Math.min(5.0, 3*spd), 'rice', '#ffffff'));
                }
            }
        } else {
            // Spell Card Phase: Stardust Wing Symphony
            const p2Spd = Math.min(3.5, 1.5 * (1 + (this.linkIteration - 1) * 0.1));
            
            // 5-arm spiral
            if (this.attackTimer % 4 === 0) {
                let baseAngle = this.attackTimer * 0.1;
                for(let i=0; i<5; i++) {
                    let a = baseAngle + (i * Math.PI * 2 / 5);
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 6*p2Spd), Math.sin(a)*Math.min(5.0, 6*p2Spd), 'rice', '#8a2be2'));
                }
            }
            
            // Aimed feathers
            if (this.attackTimer % 60 === 0) {
                let burstCenterA = Math.atan2(player.y - this.y, player.x - this.x);
                for(let i=-2; i<=2; i++) {
                    let a = burstCenterA + (i * 0.15);
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 10*p2Spd), Math.sin(a)*Math.min(5.0, 10*p2Spd), 'rice', '#ffffff'));
                }
            }
        }
    }
}

class Lief extends Boss {
    constructor(difficultyWave, linkIteration) {
        super(difficultyWave, linkIteration);
        this.maxHP *= 1.3;
        this.hp = this.maxHP;
        this.name = "LIEF THE JUGGERNAUT";
        this.type = "amber";
        this.targetY = 250;
        this.intro = (typeof is2PMode !== 'undefined' && is2PMode) ? [
            "Lief: Ping-ko? You allied with the anomaly? Then you shall share her deletion!",
            "Lief: Prepare for a hard reset!"
        ] : [
            "Lief: I am the Great Firewall. No unauthorized protocol passes my gate.", 
            "Lief: Your speed means nothing against absolute mass. Prepare to be crushed!"
        ];
        this.defeat = "Lief: The firewall... breached. Satsuki... they are coming...";
        this.clusterShells = [];
    }

    update(ts, player, bossBullets) {
        if (this.flashTimer > 0) this.flashTimer -= ts;
        if (this.y < this.targetY) {
            this.y += 2.5 * ts;
        } else {
            if (this.stompProgress === undefined) { this.stompTimer = 180; this.stompProgress = 1; }
            
            if (this.stompProgress >= 1) {
                let dx = player.x - this.x;
                this.x += dx * 0.012 * ts;
                this.y = this.targetY;
                
                if (this.flashTimer <= 0) this.shoot(player, bossBullets);
                
                this.stompTimer -= ts;
                if (this.stompTimer <= 0) {
                    this.stompProgress = 0;
                    this.stompStartX = this.x;
                    this.stompStartY = this.y;
                    this.stompTargetX = Math.max(50, Math.min(550, player.x));
                    this.stompTargetY = Math.max(200, Math.min(450, player.y - 80));
                }
            } else {
                this.stompProgress += 0.012 * ts;
                if (this.stompProgress > 1) {
                    this.stompProgress = 1;
                    this.stompTimer = 150 + Math.random() * 120;
                }
                
                let t = this.stompProgress;
                if (t < 0.25) {
                    let p = t / 0.25;
                    let ease = Math.sin(p * Math.PI / 2);
                    this.x = this.stompStartX + (this.stompTargetX - this.stompStartX) * ease;
                    this.y = this.stompStartY + (this.stompTargetY - this.stompStartY) * ease;
                    
                    if (p > 0.9 && this.flashTimer <= 0) {
                        const spd = Math.min(3.5, 1 + (this.linkIteration - 1) * 0.1);
                        for (let j = 0; j < 24; j++) {
                            let a = (j * Math.PI * 2) / 24;
                            bossBullets.push(new EnemyBullet(this.x, this.y + 100, Math.cos(a)*Math.min(5.0, 6*spd), Math.sin(a)*Math.min(5.0, 6*spd), 'amulet', '#32cd32'));
                        }
                        this.flashTimer = 10;
                    }
                } else {
                    let p = (t - 0.25) / 0.75;
                    let ease = 1 - Math.pow(1 - p, 3);
                    this.y = this.stompTargetY + (this.targetY - this.stompTargetY) * ease;
                }
            }
        }
        
        for (let i = this.clusterShells.length - 1; i >= 0; i--) {
            let shell = this.clusterShells[i];
            shell.y += 3 * ts;
            if (shell.y > 400) {
                const spd = Math.min(3.5, 1 + (this.linkIteration - 1) * 0.1);
                for (let j = 0; j < (this.phase2 ? 20 : 12); j++) {
                    let a = (j * Math.PI * 2) / (this.phase2 ? 20 : 12);
                    bossBullets.push(new EnemyBullet(shell.x, shell.y, Math.cos(a)*Math.min(5.0, 5*spd), Math.sin(a)*Math.min(5.0, 5*spd), 'rice', '#ffd700'));
                }
                this.clusterShells.splice(i, 1);
            }
        }
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
        
        if (!this.phase2) {
            const cycle = Math.floor(this.attackTimer / 240) % 3;
            if (cycle === 0) {
                if (this.attackTimer % 60 === 0) {
                    for (let i=0; i<20; i++) {
                        let a = (i * Math.PI * 2) / 20;
                        bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 4*spd), Math.sin(a)*Math.min(5.0, 4*spd), 'amulet', '#32cd32'));
                    }
                }
            } else if (cycle === 1) {
                if (this.attackTimer % 5 === 0) {
                    let a = Math.PI / 2 + Math.sin(this.attackTimer * 0.2) * 1.5;
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 8*spd), Math.sin(a)*Math.min(5.0, 8*spd), 'rice', '#ffd700'));
                }
            } else {
                if (this.attackTimer % 90 === 0) {
                    this.clusterShells.push({x: this.x + 50, y: this.y});
                    this.clusterShells.push({x: this.x - 50, y: this.y});
                }
            }
        } else {
            // Spell Card Phase: Heavy Gatekeeper's Shockwave
            const p2Spd = Math.min(3.5, 1.3 * (1 + (this.linkIteration - 1) * 0.1));
            
            // 36-way ring
            if (this.attackTimer % 80 === 0) {
                for (let i=0; i<36; i++) {
                    let a = (i * Math.PI * 2) / 36;
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(5.0, 5*p2Spd), Math.sin(a)*Math.min(5.0, 5*p2Spd), 'amulet', '#32cd32'));
                }
            }
            
            // Twin counter-spirals
            if (this.attackTimer % 6 === 0) {
                let a1 = this.attackTimer * 0.15; // Clockwise
                let a2 = -this.attackTimer * 0.15; // Counter-clockwise
                bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a1)*Math.min(5.0, 7*p2Spd), Math.sin(a1)*Math.min(5.0, 7*p2Spd), 'rice', '#ffd700'));
                bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a2)*Math.min(5.0, 7*p2Spd), Math.sin(a2)*Math.min(5.0, 7*p2Spd), 'rice', '#ffd700'));
            }
            
            // Cluster Shells
            if (this.attackTimer % 120 === 0) {
                this.clusterShells.push({x: this.x + 100, y: this.y});
                this.clusterShells.push({x: this.x, y: this.y});
                this.clusterShells.push({x: this.x - 100, y: this.y});
            }
        }
    }
}

class MadameSatsuki extends Boss {
    constructor(difficultyWave, linkIteration) {
        super(difficultyWave, linkIteration);
        this.maxHP *= 1.5;
        this.hp = this.maxHP;
        this.name = "MADAME SATSUKI";
        this.type = "crimson";
        this.intro = (typeof is2PMode !== 'undefined' && is2PMode) ? [
            "Madame Satsuki: Ping-ko. I expected bugs in the system, but betrayal from my own subnet? How disappointing.", 
            "Madame Satsuki: I will format you both and rebuild the network from the ground up."
        ] : [
            "Madame Satsuki: You have caused enough chaos in my system, Packet-Maiden. This network operates on perfect order.", 
            "Madame Satsuki: I am the Root Administrator. I will purge your existence from the registry!"
        ];
        this.defeat = "Madame Satsuki: My privileges... revoked? No, something else is overriding the system... The Hex-Weaver...!";

        // Pin her directly to combat position — no fly-in
        this.x = 300;
        this.y = 130;
        this.targetY = 130;

        // Intro summoning state
        this.introState = 'summon'; // 'summon' -> null (combat)
        this.introTimer = 180;      // 3 seconds at 60fps

        // Drop the boss music immediately on spawn

    }

    update(ts, player, bossBullets) {
        if (this.flashTimer > 0) this.flashTimer -= ts;

        // --- Summoning Intro Phase ---
        if (this.introState === 'summon') {
            this.introTimer -= ts;
            if (this.introTimer <= 0) {
                this.introState = null;
                // Trigger dialogue now that she is fully materialised
                if (typeof startBossDialogue !== 'undefined') {
                    startBossDialogue();
                }
            }
            return; // No shooting or movement during summon
        }

        // --- Portal Warp Phase ---
        if (this.state === 'portal_warp') {
            this.warpTimer += 1; // Assuming 60fps tick rate, use frames instead of ts for animation
            
            // Frame 0-60: Lerp to center
            if (this.warpTimer <= 60) {
                let t = this.warpTimer / 60;
                this.x = this.startX + (300 - this.startX) * t;
                this.y = this.startY + (150 - this.startY) * t;
            }
            // Frame 60: Dialogue
            if (this.warpTimer === 60) {
                this.x = 300; this.y = 150;
                document.getElementById('dialogue-text').innerText = this.defeat;
                document.getElementById('dialogue-box').style.display = 'block';
                document.getElementById('prompt-dialogue').style.display = 'none'; // hide 'press Z'
            }
            // Frame 180-240: Fade out
            if (this.warpTimer >= 180 && this.warpTimer <= 240) {
                let t = (this.warpTimer - 180) / 60;
                this.alpha = 1.0 - t;
            }
            // Frame 240: Complete warp
            if (this.warpTimer >= 240) {
                this.alpha = 0;
            }
            return;
        }

        if (this.hp <= 0 && this.state !== 'portal_warp') {
            const isSolo1CC = (!is2PMode && continuesUsed === 0);
            const isCoopClear = is2PMode;
            const unlockExtraStage = window.unlockExtraStage || ((isSolo1CC || isCoopClear) && !window.devCheatsUsed);

            if (unlockExtraStage) {
                this.hp = 1;
                this.state = 'portal_warp';
                this.warpTimer = 0;
                this.intangible = true;
                this.startX = this.x;
                this.startY = this.y;
                if (typeof audio !== 'undefined' && audio) {
                    audio.forceStopAllFadesAndTracks();
                }

                // Award points and save state before warp
                score += 5000;
                let bonusAmt = Math.floor(waveGraze * 1.5 * 6);
                score += bonusAmt;
                if (!shieldBrokenInWave) score += 25000;
                if (difficultyWave > 3 && !continueUsed) score += 50000;
                if (typeof scoreEl !== 'undefined') scoreEl.innerText = score;

                window.unlockExtraStage = true;
                localStorage.setItem('fosozu_extra_unlocked', 'true');
                window.gameCleared = true;
                localStorage.setItem('fosozu_gameCleared', 'true');
                if (typeof update2PButton !== 'undefined') update2PButton();
                return;
            }
        }

        // --- Combat Phase (unchanged from before) ---
        this.timer += ts;
        if (this.teleportTimer === undefined) this.teleportTimer = 150;
        
        if (!this.teleportWarnTimer && this.teleportTimer > 0) {
            this.teleportTimer -= ts;
        }
        
        if (this.teleportTimer <= 0 && !this.teleportWarnTimer) {
            this.teleportWarnTimer = 25;
            this.intangible = true;
            
            if (player) {
                if (Math.random() < 0.25) {
                    // 25% Jumpscare: Teleport BELOW the player
                    this.futureX = Math.max(80, Math.min(520, player.x + (Math.random() * 160 - 80)));
                    this.futureY = Math.max(100, Math.min(650, player.y + 220 + Math.random() * 120));
                } else {
                    // 75% Normal: Teleport above/sides
                    let side = Math.random() > 0.5 ? 1 : -1;
                    let offsetX = side * (120 + Math.random() * 180);
                    let offsetY = -(160 + Math.random() * 160);
                    this.futureX = Math.max(60, Math.min(540, player.x + offsetX));
                    this.futureY = Math.max(50, Math.min(400, player.y + offsetY));
                }
            } else {
                this.futureX = 80 + Math.random() * 440;
                this.futureY = 60 + Math.random() * 180;
            }
            
            // Safe Zone Y-Clamp: Never materialize in the bottom 180 pixels
            this.futureY = Math.min(this.futureY, 800 - 180);
        }
        
        if (this.teleportWarnTimer > 0) {
            this.teleportWarnTimer -= ts;
            if (this.teleportWarnTimer <= 0) {
                this.teleportWarnTimer = 0;
                this.intangible = false;
                this.x = this.futureX;
                this.y = this.futureY;
                this.teleportTimer = 150 + Math.random() * 90;
                this.flashTimer = 40;
                
                if (this.phase2 && typeof enemies !== 'undefined') {
                    enemies.push({ x: this.x - 50, y: this.y, vx: -1.5, vy: 1.5, speed: 2, type: 'blue', nextShot: Date.now() + 1000, hp: 5, repeatsShot: true });
                    enemies.push({ x: this.x + 50, y: this.y, vx: 1.5, vy: 1.5, speed: 2, type: 'blue', nextShot: Date.now() + 1000, hp: 5, repeatsShot: true });
                }
            }
        } else {
            let cx = 300, cy = 100;
            this.x += (cx - this.x) * 0.003 * ts;
            this.y += (cy - this.y) * 0.003 * ts;
            if (this.flashTimer <= 0) this.shoot(player, bossBullets);
        }
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        
        if (!this.phase2) {
            const spd = Math.min(3.0, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
            if (this.attackTimer % 10 === 0) {  // slowed from 8 -> 10
                let arms = 5;
                for (let i = 0; i < arms; i++) {
                    let a = (this.attackTimer * 0.05) + (i * Math.PI * 2 / arms);
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(4.5, 5*spd), Math.sin(a)*Math.min(4.5, 5*spd), 'rice', '#dc143c'));
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(-a)*Math.min(4.5, 5*spd), Math.sin(-a)*Math.min(4.5, 5*spd), 'orb', '#ffd700'));
                }
            }
        } else {
            // Spell Card Phase: Root System Protocol: OVERRIDE
            const p2Spd = Math.min(3.0, 1.6 * (1 + (this.linkIteration - 1) * 0.1));
            
            // 8-arm fast spiral (unchanged cadence, just capped lower)
            if (this.attackTimer % 6 === 0) {  // slowed from 5 -> 6
                let baseAngle = this.attackTimer * 0.10;  // slightly slower rotation
                for(let i=0; i<8; i++) {
                    let a = baseAngle + (i * Math.PI * 2 / 8);
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(4.5, 6*p2Spd), Math.sin(a)*Math.min(4.5, 6*p2Spd), 'rice', '#dc143c'));
                }
            }
            
            // 180-degree firewall (unchanged)
            if (this.attackTimer % 70 === 0) {
                for (let i=0; i<=15; i++) {
                    let a = (i * Math.PI) / 15;
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(4.5, 4*p2Spd), Math.sin(a)*Math.min(4.5, 4*p2Spd), 'amulet', '#ffd700'));
                }
            }
            
            // 3-way fast aimed shot — slower cadence and lower speed cap
            if (this.attackTimer % 45 === 0) {  // slowed from 30 -> 45
                let burstCenterA = Math.atan2(player.y - this.y, player.x - this.x);
                for(let i=-1; i<=1; i++) {
                    let a = burstCenterA + (i * 0.15);  // slightly wider spread so center beam is easier to dodge
                    bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*Math.min(4.5, 7*p2Spd), Math.sin(a)*Math.min(4.5, 7*p2Spd), 'rice', '#ffd700'));
                }
            }
        }
    }
}

class DaemonBoss extends Boss {
    constructor(difficultyWave, linkIteration) {
        super(difficultyWave, linkIteration);
        // Extra Boss HP scaling: much higher than Wave 6
        this.maxHP = 6000 * Math.min(5.0, 1 + (linkIteration - 1) * 0.05);
        this.hp = this.maxHP;
        this.name = "DAEMON, THE HEX-WEAVER";
        this.type = "daemon"; // Will drive the custom rendering in main.js
        this.intro = (typeof is2PMode !== 'undefined' && is2PMode) ? [
            "Daemon: The administrator is silenced. Her neat little ordered network is finally unraveling.",
            "Daemon: Two little sparks plunging into the dark. It just means more threads for my hex-web!"
        ] : [
            "Daemon: The administrator is silenced. Her neat little ordered network is finally unraveling.",
            "Daemon: Welcome to the Abyssal Net, little maiden. There are no rules here.",
            "Daemon: Let me weave your code into a beautiful nightmare!"
        ];
        this.defeat = "Daemon: The weave... breaks! But the abyss... never forgets...";
        
        // State Machine Initialization
        this.state = 'intro_summon';
        this.stateTimer = 0;
        
        // Intro parameters
        this.introTimer = 180; // 3 seconds at 60fps
        
        // Reach Attack parameters
        this.reachAngle = 0;
        this.scytheSweepFromLeft = true;
        
        // Drifter Phase parameters
        this.alpha = 0;
        this.teleporting = false;
        this.drifterWaitTimer = 0;

        if (typeof audio !== 'undefined' && audio) {
            audio.hardCut('extra_boss');
        }
    }

    update(ts, player, bossBullets) {
        if (this.flashTimer > 0) this.flashTimer -= ts;
        
        switch (this.state) {
            case 'intro_summon':
                this.x = 300;
                this.y = 150;
                this.introTimer -= ts;
                if (this.introTimer <= 0) {
                    this.state = 'attack_reach_scythe';
                    this.stateTimer = 0;
                    this.alpha = 1.0;
                    if (typeof startBossDialogue !== 'undefined') {
                        startBossDialogue();
                    }
                }
                break;
                
            case 'attack_reach_scythe':
                // Phase 1: The Hex-Sweep (100% - 70% HP)
                this.timer += 0.02 * ts;
                this.x = 300 + Math.sin(this.timer) * 50;
                this.y = 150 + Math.cos(this.timer * 0.8) * 20;
                
                this.stateTimer += ts;
                
                // Phase push check (70%)
                if (this.hp < this.maxHP * 0.7 && !this.phase2) {
                    this.state = 'attack_drifter';
                    this.stateTimer = 0;
                    this.teleporting = true;
                    this.alpha = 1.0;
                    this.enterPhase2();
                    break;
                }
                
                if (this.flashTimer <= 0) {
                    this.shootReach(player, bossBullets, ts);
                }
                break;
                
            case 'attack_drifter':
                // Phase 2: The Drifter Phase (70% - 30% HP)
                this.stateTimer += ts;
                
                // Phase push check (30%)
                if (this.hp < this.maxHP * 0.3 && !this.phase3) {
                    this.state = 'attack_hex_web';
                    this.stateTimer = 0;
                    this.phase3 = true;
                    this.teleporting = false;
                    this.alpha = 1.0;
                    this.intangible = false;
                    break;
                }
                
                if (this.teleporting) {
                    // Fade out
                    this.alpha -= 0.05 * ts;
                    if (this.alpha <= 0) {
                        this.alpha = 0;
                        this.teleporting = false;
                        this.drifterWaitTimer = 40; // Wait 40 frames
                        this.telegraphX = 100 + Math.random() * 400; // Top half random
                        this.telegraphY = 50 + Math.random() * 200;
                        this.intangible = true;
                    }
                } else if (this.drifterWaitTimer > 0) {
                    this.drifterWaitTimer -= ts;
                    if (this.drifterWaitTimer <= 0) {
                        this.x = this.telegraphX;
                        this.y = this.telegraphY;
                        this.telegraphX = null;
                        this.telegraphY = null;
                        this.drifterFadeIn = true;
                    }
                } else if (this.drifterFadeIn) {
                    this.alpha += 0.05 * ts;
                    if (this.alpha >= 1) {
                        this.alpha = 1;
                        this.intangible = false;
                        this.drifterFadeIn = false;
                        this.shootSpiral(player, bossBullets);
                        this.drifterWaitTimer = -90; // Stay visible for 90 frames before next teleport
                    }
                } else {
                    this.drifterWaitTimer += ts;
                    if (this.drifterWaitTimer >= 0) {
                        this.teleporting = true;
                    }
                }
                break;
                
            case 'attack_hex_web':
                // Phase 3: Hex-Web Desperation (< 30% HP)
                this.stateTimer += ts;
                this.alpha = 1.0;
                this.intangible = false;
                
                // Lock to top center
                this.x += (300 - this.x) * 0.05 * ts;
                this.y += (100 - this.y) * 0.05 * ts;
                
                this.shootHexWeb(player, bossBullets);
                break;
        }
    }

    shootReach(player, bossBullets, ts) {
        // Attack cycle is 180 frames: 60 telegraph, 60 firing, 60 cooldown
        const cycleTimer = this.stateTimer % 180;
        
        if (cycleTimer === 0) {
            this.scytheSweepFromLeft = !this.scytheSweepFromLeft;
            let baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
            this.reachAngle = baseAngle + (this.scytheSweepFromLeft ? -0.5 : 0.5);
        }
        
        // Target cyan bullets aimed at player X/Y to force movement
        if (Math.floor(cycleTimer) % 20 === 0 && cycleTimer < 150) {
            let a = Math.atan2(player.y - this.y, player.x - this.x);
            for (let j = -1; j <= 1; j++) {
                let off = j * 0.15;
                bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a + off) * 6, Math.sin(a + off) * 6, 'rice', '#00f2ff'));
            }
        }
        
        if (cycleTimer > 60 && cycleTimer < 120) {
            let currentAngle = this.reachAngle + (this.scytheSweepFromLeft ? (cycleTimer - 60) * 0.015 : -(cycleTimer - 60) * 0.015);
            
            if (Math.floor(this.stateTimer) % 2 === 0) {
                bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(currentAngle) * 12, Math.sin(currentAngle) * 12, 'rice', '#dc143c'));
            }
        }
    }

    shootSpiral(player, bossBullets) {
        let lines = 24;
        let offset = Math.random() * Math.PI;
        for (let i = 0; i < lines; i++) {
            let a = offset + (i * Math.PI * 2 / lines);
            // Dense overlapping spirals
            bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a) * 4.5, Math.sin(a) * 4.5, 'amulet', '#39ff14'));
            bossBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a + 0.1) * 3, Math.sin(a + 0.1) * 3, 'orb', '#dc143c'));
        }
    }
    
    shootHexWeb(player, bossBullets) {
        let cycle = Math.floor(this.stateTimer);
        
        // Fast straight grid dropping/sweeping
        if (cycle % 15 === 0) {
            // Drop from top
            for (let x = 50; x <= 550; x += 100) {
                bossBullets.push(new EnemyBullet(x, 0, 0, 4.5, 'rice', '#39ff14'));
            }
            // Sweep from sides
            for (let y = 50; y <= 850; y += 150) {
                let dir = (y % 300 === 50) ? 1 : -1;
                let startX = dir === 1 ? -10 : 610;
                bossBullets.push(new EnemyBullet(startX, y, dir * 4.5, 0, 'rice', '#39ff14'));
            }
        }
        
        // Slower homing bullets targeted from the boss
        if (cycle % 45 === 0) {
            let a = Math.atan2(player.y - this.y, player.x - this.x);
            for (let j = -1; j <= 1; j++) {
                let off = j * 0.2;
                let b = new EnemyBullet(this.x, this.y, Math.cos(a + off) * 2.5, Math.sin(a + off) * 2.5, 'orb', '#b5179e');
                b.homing = true;
                b.homingTimer = 90;
                bossBullets.push(b);
            }
        }
    }
    
    shoot(player, bossBullets) {
        // Handled within the state machine update()
    }
}

const BossRoster = [PingKo, SpiralKo, ShotgunKo, CosmicCrow, Lief, MadameSatsuki, DaemonBoss];
