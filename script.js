// Game Configuration
const CONFIG = {
    gravity: 1.8, // Higher gravity for shorter, tighter jumps
    friction: 0.8,
    airFriction: 0.99, // More air resistance to shorten jump distance
    moveSpeed: 2.2,
    maxSpeed: 5.2,
    jumpForce: -20.0, // Slightly reduced force
    bounceForce: -10,
    canvasWidth: window.innerWidth,
    canvasHeight: window.innerHeight,
    blockSize: 50 // Standard size for our new SVG
};

// Assets
const ASSETS = {
    player: {
        run: ['assets/Run_1.png', 'assets/Run_2.png', 'assets/Run_3.png'],
        jump: ['assets/Jump_1.png', 'assets/Jump_2.png']
    },
    env: {
        block: 'assets/block.svg'
    },
    collectible: {
        coin: 'assets/Coin_2.png'
    },
    enemy: {
        normal: 'assets/Bad_1.png',
        squashed: 'assets/Bad_2.png'
    }
};

// Image Loader
const images = {};
let imagesLoaded = 0;
const totalImages = 9;

function loadImage(key, src) {
    const img = new Image();
    img.src = src;
    img.onload = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            startGame();
        }
    };
    images[key] = img;
}

loadImage('run1', ASSETS.player.run[0]);
loadImage('run2', ASSETS.player.run[1]);
loadImage('run3', ASSETS.player.run[2]);
loadImage('jump1', ASSETS.player.jump[0]);
loadImage('jump2', ASSETS.player.jump[1]);
loadImage('block', ASSETS.env.block);
loadImage('coin', ASSETS.collectible.coin);
loadImage('enemyNormal', ASSETS.enemy.normal);
loadImage('enemySquashed', ASSETS.enemy.squashed);

// Game State
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');

let score = 0;
let startTime = 0;
let gameTime = 0;
let gameOver = false;
let gameWon = false;
let cameraX = 0;

// Resize canvas
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    CONFIG.canvasWidth = canvas.width;
    CONFIG.canvasHeight = canvas.height;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
const keys = {
    left: false,
    right: false,
    up: false,
    upPressed: false
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        if (!keys.up) keys.upPressed = true;
        keys.up = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        keys.up = false;
        keys.upPressed = false;
    }
});

// Game Objects
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 60;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.facingRight = true;
        this.animTimer = 0;
        this.runFrame = 0;
    }

    update(dt) {
        if (gameOver || gameWon) return;

        // Movement
        if (keys.left) {
            this.vx -= CONFIG.moveSpeed * dt;
            this.facingRight = false;
        }
        if (keys.right) {
            this.vx += CONFIG.moveSpeed * dt;
            this.facingRight = true;
        }

        // Friction
        const currentFriction = this.grounded ? CONFIG.friction : CONFIG.airFriction;
        this.vx *= Math.pow(currentFriction, dt);
        this.vx = Math.max(Math.min(this.vx, CONFIG.maxSpeed), -CONFIG.maxSpeed);

        // Gravity
        this.vy += CONFIG.gravity * dt;

        // Jump
        if (keys.upPressed && this.grounded) {
            this.vy = CONFIG.jumpForce;
            this.grounded = false;
            keys.upPressed = false;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Animation
        if (this.grounded && Math.abs(this.vx) > 0.5) {
            this.animTimer += dt;
            if (this.animTimer > 2.5) { // Faster animation speed
                this.runFrame = (this.runFrame + 1) % 3;
                this.animTimer = 0;
            }
        }

        // Death
        if (this.y > CONFIG.canvasHeight + 200) {
            resetGame();
        }
    }

    draw(ctx) {
        let sprite;
        if (!this.grounded) {
            sprite = this.vy < 0 ? images['jump1'] : images['jump2'];
        } else {
            if (Math.abs(this.vx) > 0.5) {
                // Animation handled in update()
                if (this.runFrame === 0) sprite = images['run1'];
                else if (this.runFrame === 1) sprite = images['run2'];
                else sprite = images['run3'];
            } else {
                sprite = images['run1'];
            }
        }

        ctx.save();
        if (!this.facingRight) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

class Block {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    }

    draw(ctx) {
        const ptrn = ctx.createPattern(images['block'], 'repeat');
        ctx.fillStyle = ptrn;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Simple border
        ctx.strokeStyle = '#3e2723'; // Dark brown
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor(x, y, range) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 50;
        this.startX = x;
        this.range = range;
        this.speed = 1.5;
        this.dir = 1;
        this.state = 'alive';
        this.removeTimer = 0;
    }

    update(dt) {
        if (this.state === 'squashed') {
            this.removeTimer += dt;
            return;
        }
        this.x += this.speed * this.dir * dt;
        if (this.x > this.startX + this.range || this.x < this.startX) {
            this.dir *= -1;
        }
    }

    draw(ctx) {
        if (this.state === 'squashed') {
            ctx.drawImage(images['enemySquashed'], this.x, this.y + 20, this.width, this.height - 20);
        } else {
            ctx.drawImage(images['enemyNormal'], this.x, this.y, this.width, this.height);
        }
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.collected = false;
        this.floatOffset = 0;
    }

    update(dt) {
        this.floatOffset += 0.1 * dt;
    }

    draw(ctx) {
        if (this.collected) return;
        const yOff = Math.sin(this.floatOffset) * 5;
        ctx.drawImage(images['coin'], this.x, this.y + yOff, this.width, this.height);
    }
}

class FinishLine {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 200;
    }

    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = 'black';
        for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) ctx.fillRect(this.x, this.y + i * 20, 10, 20);
        }
        ctx.fillStyle = 'white';
        for (let i = 0; i < 10; i++) {
            if (i % 2 !== 0) ctx.fillRect(this.x, this.y + i * 20, 10, 20);
        }
    }
}

// Level Data
let player;
let blocks = [];
let enemies = [];
let coins = [];
let finishLine;

function initLevel() {
    player = new Player(100, 300);

    // Level Design for shorter jumps
    // Max jump height is roughly 120px with current settings
    // Max jump distance is roughly 250px

    blocks = [
        // Start Area
        new Block(0, 500, 800, 100),

        // Easy Steps
        new Block(900, 450, 150, 50),
        new Block(1150, 400, 150, 50),
        new Block(1400, 350, 150, 50),

        // Drop down to ground
        new Block(1650, 500, 600, 100),

        // Gap jump
        new Block(2350, 500, 400, 100),

        // Staircase up
        new Block(2850, 450, 100, 50),
        new Block(3050, 380, 100, 50),
        new Block(3250, 310, 100, 50),

        // High platform run
        new Block(3450, 310, 600, 50),

        // Drop down
        new Block(4200, 500, 800, 100),

        // Final tricky jumps
        new Block(5100, 450, 100, 50),
        new Block(5300, 400, 100, 50),
        new Block(5500, 450, 100, 50),

        // Finish Area
        new Block(5700, 500, 1000, 100)
    ];

    enemies = [
        new Enemy(500, 450, 200),
        new Enemy(1800, 450, 300),
        new Enemy(3600, 260, 300), // On high platform
        new Enemy(4400, 450, 400),
        new Enemy(5800, 450, 300)
    ];

    coins = [
        new Coin(300, 400),
        new Coin(1225, 350),
        new Coin(1900, 400),
        new Coin(3050, 250),
        new Coin(3700, 250),
        new Coin(5350, 350),
        new Coin(6000, 400)
    ];

    finishLine = new FinishLine(6500, 300);

    score = 0;
    scoreEl.innerText = score;

    startTime = Date.now();
    gameTime = 0;
    timerEl.innerText = 0;

    gameOver = false;
    gameWon = false;
}

function resetGame() {
    initLevel();
}

function checkCollisions() {
    if (gameWon) return;

    player.grounded = false;

    // Blocks
    for (let block of blocks) {
        if (player.x < block.x + block.width &&
            player.x + player.width > block.x &&
            player.y < block.y + block.height &&
            player.y + player.height > block.y) {

            const dx = (player.x + player.width / 2) - (block.x + block.width / 2);
            const dy = (player.y + player.height / 2) - (block.y + block.height / 2);
            const width = (player.width + block.width) / 2;
            const height = (player.height + block.height) / 2;
            const crossWidth = width * dy;
            const crossHeight = height * dx;

            if (Math.abs(dx) <= width && Math.abs(dy) <= height) {
                if (crossWidth > crossHeight) {
                    if (crossWidth > -crossHeight) {
                        player.y = block.y + block.height;
                        player.vy = 0;
                    } else {
                        player.x = block.x - player.width;
                        player.vx = 0;
                    }
                } else {
                    if (crossWidth > -crossHeight) {
                        player.x = block.x + block.width;
                        player.vx = 0;
                    } else {
                        if (player.vy >= 0) {
                            player.y = block.y - player.height;
                            player.vy = 0;
                            player.grounded = true;
                        }
                    }
                }
            }
        }
    }

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        if (enemy.state === 'alive') {
            if (player.x < enemy.x + enemy.width &&
                player.x + player.width > enemy.x &&
                player.y < enemy.y + enemy.height &&
                player.y + player.height > enemy.y) {

                if (player.vy > 0 && player.y + player.height < enemy.y + enemy.height / 2 + 10) {
                    enemy.state = 'squashed';
                    player.vy = CONFIG.bounceForce;
                } else {
                    resetGame();
                }
            }
        } else if (enemy.state === 'squashed') {
            if (enemy.removeTimer > 30) {
                enemies.splice(i, 1);
            }
        }
    }

    // Coins
    for (let coin of coins) {
        if (!coin.collected) {
            if (player.x < coin.x + coin.width &&
                player.x + player.width > coin.x &&
                player.y < coin.y + coin.height &&
                player.y + player.height > coin.y) {

                coin.collected = true;
                score++;
                scoreEl.innerText = score;
            }
        }
    }

    // Finish Line
    if (player.x < finishLine.x + finishLine.width &&
        player.x + player.width > finishLine.x &&
        player.y < finishLine.y + finishLine.height &&
        player.y + player.height > finishLine.y) {

        gameWon = true;
    }
}

let lastTime = 0;
function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = (timestamp - lastTime) / (1000 / 60);
    lastTime = timestamp;

    // Cap dt to prevent huge jumps (e.g. tab switching)
    const dt = Math.min(deltaTime, 3);

    player.update(dt);
    enemies.forEach(e => e.update(dt));
    coins.forEach(c => c.update(dt));
    checkCollisions();

    if (!gameOver && !gameWon) {
        gameTime = Math.floor((Date.now() - startTime) / 1000);
        timerEl.innerText = gameTime;
    }

    let targetCamX = player.x - CONFIG.canvasWidth / 3;
    if (targetCamX < 0) targetCamX = 0;
    cameraX += (targetCamX - cameraX) * 0.1 * dt;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-Math.floor(cameraX), 0);

    blocks.forEach(b => b.draw(ctx));
    finishLine.draw(ctx);
    coins.forEach(c => c.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    player.draw(ctx);

    if (gameWon) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(cameraX, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.fillText("YOU WON!", cameraX + CONFIG.canvasWidth / 2 - 100, CONFIG.canvasHeight / 2);
        ctx.font = '24px Arial';
        ctx.fillText("Time: " + gameTime + "s | Coins: " + score, cameraX + CONFIG.canvasWidth / 2 - 120, CONFIG.canvasHeight / 2 + 50);
    }

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

function startGame() {
    initLevel();
    lastTime = 0;
    requestAnimationFrame(gameLoop);
}
