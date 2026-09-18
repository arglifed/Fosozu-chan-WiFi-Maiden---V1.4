class Boss {
    constructor(difficultyWave, linkIteration) {
        this.x = 300;
        this.y = -100;
        this.targetY = 150;
        
        let hpScale = Math.min(5.0, 1 + (linkIteration - 1) * 0.05);
        this.maxHP = (300 + (difficultyWave * 300)) * hpScale;
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
        this.name = "PING-KO";
        this.type = "pink";
        this.intro = [
            "Ping-ko: B-Baka! Why are you clogging my bandwidth?!", 
            "Ping-ko: It's not like I wanted you to connect anyway!", 
            "Ping-ko: Prepare to be throttled!"
        ];
        this.defeat = "Ping-ko: Ugh... fine! Synced!";
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
        
        if (!this.phase2) {
            const cycle = Math.floor(this.attackTimer / 180) % 2;
            if (cycle === 0) { 
                if (this.attackTimer % 4 === 0) { 
                    let a = (this.attackTimer * 0.15); 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*6*spd, vy:Math.sin(a)*6*spd, color:'#ff006e'}); 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + Math.PI)*6*spd, vy:Math.sin(a + Math.PI)*6*spd, color:'#ff006e'}); 
                } 
            } else { 
                if (this.attackTimer % 12 === 0) { 
                    let a = Math.atan2(player.y - this.y, player.x - this.x); 
                    for(let i=-1; i<=1; i++) { 
                        bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + i*0.1)*8*spd, vy:Math.sin(a + i*0.1)*8*spd, color:'#ff006e'}); 
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + off)*7*p2Spd, vy:Math.sin(a + off)*7*p2Spd, color:'#ff006e'}); 
                }
            }
            if (this.attackTimer % 60 === 0) {
                let a = Math.atan2(player.y - this.y, player.x - this.x); 
                for(let i=-2; i<=2; i++) { 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + i*0.15)*9*p2Spd, vy:Math.sin(a + i*0.15)*9*p2Spd, color:'#ffffff'}); 
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

    shoot(player, bossBullets) {
        this.attackTimer++;
        const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
        
        if (!this.phase2) {
            if (this.attackTimer % 20 === 0) { 
                for(let i=0; i<16; i++) { 
                    let a = i * (Math.PI*2/16) + (this.attackTimer*0.05); 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*4*spd, vy:Math.sin(a)*4*spd, color:'#00f2ff'}); 
                } 
            }
        } else {
            // Spell Card Phase
            const p2Spd = Math.min(3.5, 1.5 * (1 + (this.linkIteration - 1) * 0.1));
            // Interlocking reverse spirals
            if (this.attackTimer % 15 === 0) { 
                for(let i=0; i<18; i++) { 
                    let a = i * (Math.PI*2/18) + (this.attackTimer*0.08); 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*5*p2Spd, vy:Math.sin(a)*5*p2Spd, color:'#00f2ff'}); 
                    
                    let a2 = i * (Math.PI*2/18) - (this.attackTimer*0.08); 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a2)*4*p2Spd, vy:Math.sin(a2)*4*p2Spd, color:'#ffffff'}); 
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

    shoot(player, bossBullets) {
        this.attackTimer++;
        const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
        
        if (!this.phase2) {
            if (this.attackTimer % 45 === 0) { 
                let a_b = Math.atan2(player.y-this.y, player.x-this.x); 
                for(let j=-3; j<=3; j++) { 
                    let a = a_b + (j * 0.15); 
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*9*spd, vy:Math.sin(a)*9*spd, color:'#0f0'}); 
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
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*10*p2Spd, vy:Math.sin(a)*10*p2Spd, color:'#0f0'}); 
                }
                // Random scatter
                for(let i=0; i<8; i++) {
                    let a = a_b + (Math.random() - 0.5) * 2.0;
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*8*p2Spd, vy:Math.sin(a)*8*p2Spd, color:'#ffffff'});
                }
            }
        }
    }
}

class CosmicCrow extends Boss {
    constructor(difficultyWave, linkIteration) {
        super(difficultyWave, linkIteration);
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
        } else {
            this.timer += 0.05 * ts;
            this.x = 300 + Math.sin(this.timer) * 220; 
            if (this.flashTimer <= 0) this.shoot(player, bossBullets);
        }
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
        
        if (!this.phase2) {
            if (this.attackTimer % 15 === 0) { 
                for(let i=0; i<3; i++) {
                    let a = Math.PI / 2 + (i - 1) * 0.3 + Math.sin(this.attackTimer * 0.1) * 0.5;
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*7*spd, vy:Math.sin(a)*7*spd, color:'#b5179e'});
                }
            }
            if (this.attackTimer % 90 === 0) {
                let burstCenterA = Math.atan2(player.y - this.y, player.x - this.x);
                for(let i=0; i<8; i++) {
                    let a = burstCenterA + (i * Math.PI * 2 / 8);
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*3*spd, vy:Math.sin(a)*3*spd, color:'#ffffff'});
                }
            }
        } else {
            // Spell Card Phase
            const p2Spd = Math.min(3.5, 1.5 * (1 + (this.linkIteration - 1) * 0.1));
            // Dense massive cascades + overlapping stars
            if (this.attackTimer % 8 === 0) { 
                for(let i=0; i<5; i++) {
                    let a = Math.PI / 2 + (i - 2) * 0.25 + Math.sin(this.attackTimer * 0.15) * 0.8;
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*8*p2Spd, vy:Math.sin(a)*8*p2Spd, color:'#b5179e'});
                }
            }
            if (this.attackTimer % 45 === 0) {
                let burstCenterA = Math.atan2(player.y - this.y, player.x - this.x);
                for(let i=0; i<12; i++) {
                    let a = burstCenterA + (i * Math.PI * 2 / 12);
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*5*p2Spd, vy:Math.sin(a)*5*p2Spd, color:'#ffffff'});
                }
            }
        }
    }
}

class Lief extends Boss {
    constructor(difficultyWave, linkIteration) {
        super(difficultyWave, linkIteration);
        this.name = "LIEF THE JUGGERNAUT";
        this.type = "amber";
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
            this.timer += 0.015 * ts;
            this.x = 300 + Math.sin(this.timer) * 120;
            if (this.flashTimer <= 0) this.shoot(player, bossBullets);
        }
        
        for (let i = this.clusterShells.length - 1; i >= 0; i--) {
            let shell = this.clusterShells[i];
            shell.y += 3 * ts;
            if (shell.y > 400) {
                const spd = Math.min(3.5, 1 + (this.linkIteration - 1) * 0.1);
                for (let j = 0; j < (this.phase2 ? 20 : 12); j++) {
                    let a = (j * Math.PI * 2) / (this.phase2 ? 20 : 12);
                    bossBullets.push({x: shell.x, y: shell.y, vx: Math.cos(a)*5*spd, vy: Math.sin(a)*5*spd, color: '#f77f00'});
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
                        bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*4*spd, vy:Math.sin(a)*4*spd, color:'#f77f00'});
                    }
                }
            } else if (cycle === 1) {
                if (this.attackTimer % 5 === 0) {
                    let a = Math.PI / 2 + Math.sin(this.attackTimer * 0.2) * 1.5;
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*8*spd, vy:Math.sin(a)*8*spd, color:'#ffca3a'});
                }
            } else {
                if (this.attackTimer % 90 === 0) {
                    this.clusterShells.push({x: this.x + 50, y: this.y});
                    this.clusterShells.push({x: this.x - 50, y: this.y});
                }
            }
        } else {
            // Spell Card Phase
            const p2Spd = Math.min(3.5, 1.3 * (1 + (this.linkIteration - 1) * 0.1));
            // Constant shockwaves + sweeps + more clusters
            if (this.attackTimer % 40 === 0) {
                for (let i=0; i<24; i++) {
                    let a = (i * Math.PI * 2) / 24;
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*5*p2Spd, vy:Math.sin(a)*5*p2Spd, color:'#f77f00'});
                }
            }
            if (this.attackTimer % 4 === 0) {
                let a = Math.PI / 2 + Math.sin(this.attackTimer * 0.3) * 2.0;
                bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*9*p2Spd, vy:Math.sin(a)*9*p2Spd, color:'#ffca3a'});
            }
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
            this.timer += 0.02 * ts;
            this.x = 300 + Math.sin(this.timer) * 150;
            if (this.flashTimer <= 0) this.shoot(player, bossBullets);
        }
    }

    shoot(player, bossBullets) {
        this.attackTimer++;
        
        if (!this.phase2) {
            const spd = Math.min(3.5, 1.0 * (1 + (this.linkIteration - 1) * 0.1));
            if (this.attackTimer % 8 === 0) {
                let arms = 5;
                for (let i = 0; i < arms; i++) {
                    let a = (this.attackTimer * 0.05) + (i * Math.PI * 2 / arms);
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*5*spd, vy:Math.sin(a)*5*spd, color:'#d90429'});
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(-a)*5*spd, vy:Math.sin(-a)*5*spd, color:'#ffb3c1'});
                }
            }
        } else {
            // Spell Card Phase
            const p2Spd = Math.min(3.5, 1.8 * (1 + (this.linkIteration - 1) * 0.1));
            if (this.attackTimer % 3 === 0) {
                let a = (this.attackTimer * 0.15);
                bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*7*p2Spd, vy:Math.sin(a)*7*p2Spd, color:'#d90429'});
                bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + Math.PI)*7*p2Spd, vy:Math.sin(a + Math.PI)*7*p2Spd, color:'#d90429'});
                
                // Interlocking reverse
                let aRev = -(this.attackTimer * 0.10);
                bossBullets.push({x:this.x, y:this.y, vx:Math.cos(aRev)*5*p2Spd, vy:Math.sin(aRev)*5*p2Spd, color:'#ffb3c1'});
            }
            if (this.attackTimer % 20 === 0) {
                let a = Math.atan2(player.y - this.y, player.x - this.x);
                for(let i=-3; i<=3; i++) {
                    bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a + i*0.12)*9*p2Spd, vy:Math.sin(a + i*0.12)*9*p2Spd, color:'#ffffff'});
                }
            }
        }
    }
}

const BossRoster = [PingKo, SpiralKo, ShotgunKo, CosmicCrow, Lief, MadameSatsuki];
