import { update, draw } from './systems.js';
import { gameState } from './entities.js';

let lastTime = 0;
const requiredElapsed = 1000 / 60;

function loop(timestamp) {
    const elap = timestamp - lastTime;
    if (elap > requiredElapsed) {
        lastTime = timestamp - (elap % requiredElapsed);
        update();
        draw();
    }
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);