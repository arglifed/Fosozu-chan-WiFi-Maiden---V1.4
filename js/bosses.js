class Boss {
    constructor(difficultyWave, linkIteration) {
        this.x = 300;
        this.y = -100;
        this.targetY = 150;
        
        let hpScale = Math.min(5.0, 1 + (linkIteration - 1) * 0.05);
        this.maxHP = (120 + (difficultyWave * 80)) * hpScale;
        this.hp = this.maxHP;
        
        this.attackTimer = 0;
        this.timer = 0;
        
        this.name = "BOSS";
        this.type = "unknown";
        this.intro = [];
        this.defeat = "";
        
        this.linkIteration = linkIteration;
    }
    
    update(ts, player, bossBullets) {
        if (this.y < this.targetY) {
            this.y += 2.5 * ts;
        } else {
            this.timer += 0.025 * ts;
            this.x = 300 + Math.sin(this.timer) * 180;
            this.shoot(player, bossBullets);
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
        const p2 = this.hp < this.maxHP / 2;
        const spd = Math.min(3.5, (p2 ? 1.5 : 1.0) * (1 + (this.linkIteration - 1) * 0.1));
        
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
        const p2 = this.hp < this.maxHP / 2;
        const spd = Math.min(3.5, (p2 ? 1.5 : 1.0) * (1 + (this.linkIteration - 1) * 0.1));
        
        if (this.attackTimer % 20 === 0) { 
            for(let i=0; i<16; i++) { 
                let a = i * (Math.PI*2/16) + (this.attackTimer*0.05); 
                bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*4*spd, vy:Math.sin(a)*4*spd, color:'#00f2ff'}); 
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
        const p2 = this.hp < this.maxHP / 2;
        const spd = Math.min(3.5, (p2 ? 1.5 : 1.0) * (1 + (this.linkIteration - 1) * 0.1));
        
        if (this.attackTimer % 45 === 0) { 
            let a_b = Math.atan2(player.y-this.y, player.x-this.x); 
            for(let j=-3; j<=3; j++) { 
                let a = a_b + (j * 0.15); 
                bossBullets.push({x:this.x, y:this.y, vx:Math.cos(a)*9*spd, vy:Math.sin(a)*9*spd, color:'#0f0'}); 
            } 
        }
    }
}

const BossRoster = [PingKo, SpiralKo, ShotgunKo];
