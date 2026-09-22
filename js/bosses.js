class Boss {
    constructor(difficultyWave, linkIteration) {
        this.x = 300;
        this.y = -100;
        this.targetY = 150;
        
        let hpScale = Math.min(5.0, 1 + (linkIteration - 1) * 0.05);
        this.maxHP = (900 + (difficultyWave * 300)) * hpScale;
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
        this.intro = [
            "Ping-ko: B-Baka! Why are you clogging my bandwidth?!", 
            "Ping-ko: It's not like I wanted you to connect anyway!", 
            "Ping-ko: Prepare to be throttled!"
        ];
        this.defeat = "Ping-ko: Ugh... fine! Synced!";
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 6*spd), vy:Math.sin(a)*Math.min(5.0, 6*spd), color:'#ff006e'}); 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + Math.PI)*Math.min(5.0, 6*spd), vy:Math.sin(a + Math.PI)*Math.min(5.0, 6*spd), color:'#ff006e'}); 
                } 
            } else { 
                if (this.attackTimer % 12 === 0) { 
                    let a = Math.atan2(player.y - this.y, player.x - this.x); 
                    for(let i=-1; i<=1; i++) { 
                        bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + i*0.1)*Math.min(5.0, 8*spd), vy:Math.sin(a + i*0.1)*Math.min(5.0, 8*spd), color:'#ff006e'}); 
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + off)*Math.min(5.0, 7*p2Spd), vy:Math.sin(a + off)*Math.min(5.0, 7*p2Spd), color:'#ff006e'}); 
                }
            }
            if (this.attackTimer % 60 === 0) {
                let a = Math.atan2(player.y - this.y, player.x - this.x); 
                for(let i=-2; i<=2; i++) { 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + i*0.15)*Math.min(5.0, 9*p2Spd), vy:Math.sin(a + i*0.15)*Math.min(5.0, 9*p2Spd), color:'#ffffff'}); 
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
        this.intro = [
            "Spiral-ko: Scanning... Scanning...", 
            "Spiral-ko: Your data packets are so... unoptimized. Embarrassing!", 
            "Spiral-ko: Let me encrypt you into a thousand pieces!"
        ];
        this.defeat = "Spiral-ko: Critical error! My spirals... unraveled!";
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 4*spd), vy:Math.sin(a)*Math.min(5.0, 4*spd), color:'#00f2ff'}); 
                } 
            }
        } else {
            // Spell Card Phase
            const p2Spd = Math.min(3.5, 1.5 * (1 + (this.linkIteration - 1) * 0.1));
            // Interlocking reverse spirals
            if (this.attackTimer % 15 === 0) { 
                for(let i=0; i<18; i++) { 
                    let a = i * (Math.PI*2/18) + (this.attackTimer*0.08); 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 5*p2Spd), vy:Math.sin(a)*Math.min(5.0, 5*p2Spd), color:'#00f2ff'}); 
                    
                    let a2 = i * (Math.PI*2/18) - (this.attackTimer*0.08); 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a2)*Math.min(5.0, 4*p2Spd), vy:Math.sin(a2)*Math.min(5.0, 4*p2Spd), color:'#ffffff'}); 
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
        this.intro = [
            "Shotgun-ko: MOVE! You're creating a bottleneck!", 
            "Shotgun-ko: If you can't handle 10Gbps, you don't belong here!", 
            "Shotgun-ko: EAT MY UPLOAD SPEED!"
        ];
        this.defeat = "Shotgun-ko: FINAL COMMAND: SERVER RESET INITIATED!";
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 9*spd), vy:Math.sin(a)*Math.min(5.0, 9*spd), color:'#0f0'}); 
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 10*p2Spd), vy:Math.sin(a)*Math.min(5.0, 10*p2Spd), color:'#0f0'}); 
                }
                // Random scatter
                for(let i=0; i<8; i++) {
                    let a = a_b + (Math.random() - 0.5) * 2.0;
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 8*p2Spd), vy:Math.sin(a)*Math.min(5.0, 8*p2Spd), color:'#ffffff'});
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
        this.intro = [
            "Cosmic Crow: *Caw!* The packet winds are shifting...", 
            "Cosmic Crow: Adjust your scarf, little maiden!", 
            "Cosmic Crow: Can you weave through stardust?"
        ];
        this.defeat = "Cosmic Crow: My feathers... scattered across the cosmos!";
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 7*spd), vy:Math.sin(a)*Math.min(5.0, 7*spd), color:'#b5179e'});
                }
            }
            if (this.attackTimer % 90 === 0) {
                let burstCenterA = Math.atan2(player.y - this.y, player.x - this.x);
                for(let i=0; i<8; i++) {
                    let a = burstCenterA + (i * Math.PI * 2 / 8);
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 3*spd), vy:Math.sin(a)*Math.min(5.0, 3*spd), color:'#ffffff'});
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 6*p2Spd), vy:Math.sin(a)*Math.min(5.0, 6*p2Spd), color:'#b5179e'});
                }
            }
            
            // Aimed feathers
            if (this.attackTimer % 60 === 0) {
                let burstCenterA = Math.atan2(player.y - this.y, player.x - this.x);
                for(let i=-2; i<=2; i++) {
                    let a = burstCenterA + (i * 0.15);
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 10*p2Spd), vy:Math.sin(a)*Math.min(5.0, 10*p2Spd), color:'#ffffff'});
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
        this.intro = [
            "Lief: Halt, Packet-Maiden.", 
            "Lief: You face the heavy gatekeeper of the network.", 
            "Lief: Let's see if your bandwidth can withstand true crushing force!"
        ];
        this.defeat = "Lief: Hah... a worthy display of speed. The path is open.";
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
                            bossBullets.push({x: this.x, y: this.y + 100, vx: Math.cos(a)*Math.min(5.0, 6*spd), vy: Math.sin(a)*Math.min(5.0, 6*spd), color: '#f77f00'});
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
                    bossBullets.push({x: shell.x, y: shell.y, vx: Math.cos(a)*Math.min(5.0, 5*spd), vy: Math.sin(a)*Math.min(5.0, 5*spd), color: '#f77f00'});
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
                        bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 4*spd), vy:Math.sin(a)*Math.min(5.0, 4*spd), color:'#f77f00'});
                    }
                }
            } else if (cycle === 1) {
                if (this.attackTimer % 5 === 0) {
                    let a = Math.PI / 2 + Math.sin(this.attackTimer * 0.2) * 1.5;
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 8*spd), vy:Math.sin(a)*Math.min(5.0, 8*spd), color:'#ffca3a'});
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(5.0, 5*p2Spd), vy:Math.sin(a)*Math.min(5.0, 5*p2Spd), color:'#ffca3a'});
                }
            }
            
            // Twin counter-spirals
            if (this.attackTimer % 6 === 0) {
                let a1 = this.attackTimer * 0.15; // Clockwise
                let a2 = -this.attackTimer * 0.15; // Counter-clockwise
                bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a1)*Math.min(5.0, 7*p2Spd), vy:Math.sin(a1)*Math.min(5.0, 7*p2Spd), color:'#f77f00'});
                bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a2)*Math.min(5.0, 7*p2Spd), vy:Math.sin(a2)*Math.min(5.0, 7*p2Spd), color:'#f77f00'});
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
        this.intro = [
            "Madame Satsuki: So, you are the anomaly running loose in my system.", 
            "Madame Satsuki: How quaint. But access to the root server is strictly denied.", 
            "Madame Satsuki: Terminate protocol initiated."
        ];
        this.defeat = "Madame Satsuki: Impossible... my root security... compromised! SYSTEM REBOOT!";
    }

    update(ts, player, bossBullets) {
        if (this.flashTimer > 0) this.flashTimer -= ts;
        if (this.y < this.targetY) {
            this.y += 2.5 * ts;
        } else {
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
                
                // Move offscreen during telegraph
                this.x = -1000;
                this.y = -1000;
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
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        
        if (!this.phase2) {
            const spd = Math.min(3.0, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
            if (this.attackTimer % 10 === 0) {  // slowed from 8 -> 10
                let arms = 5;
                for (let i = 0; i < arms; i++) {
                    let a = (this.attackTimer * 0.05) + (i * Math.PI * 2 / arms);
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(4.5, 5*spd), vy:Math.sin(a)*Math.min(4.5, 5*spd), color:'#d90429'});
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(-a)*Math.min(4.5, 5*spd), vy:Math.sin(-a)*Math.min(4.5, 5*spd), color:'#ffb3c1'});
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(4.5, 6*p2Spd), vy:Math.sin(a)*Math.min(4.5, 6*p2Spd), color:'#d90429'});
                }
            }
            
            // 180-degree firewall (unchanged)
            if (this.attackTimer % 70 === 0) {
                for (let i=0; i<=15; i++) {
                    let a = (i * Math.PI) / 15;
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(4.5, 4*p2Spd), vy:Math.sin(a)*Math.min(4.5, 4*p2Spd), color:'#ffb3c1'});
                }
            }
            
            // 3-way fast aimed shot — slower cadence and lower speed cap
            if (this.attackTimer % 45 === 0) {  // slowed from 30 -> 45
                let burstCenterA = Math.atan2(player.y - this.y, player.x - this.x);
                for(let i=-1; i<=1; i++) {
                    let a = burstCenterA + (i * 0.15);  // slightly wider spread so center beam is easier to dodge
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*Math.min(4.5, 7*p2Spd), vy:Math.sin(a)*Math.min(4.5, 7*p2Spd), color:'#ffffff'});
                }
            }
        }
    }
}

const BossRoster = [PingKo, SpiralKo, ShotgunKo, CosmicCrow, Lief, MadameSatsuki];
