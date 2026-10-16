const config = {
    type: Phaser.AUTO,
    width: 600,
    height: 800,
    physics: { default: 'arcade' },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let isCalibrated = false;
let pingText;
let car;
let road;
let enemies;
let ws;
let score = 0;
let scoreText;
let police;
let policeActive = false;
let myRoomId = Math.floor(1000 + Math.random() * 9000).toString();
let isConnected = false;
let isGameOver = false;
let targetVelocityX = 0;
let targetY = 650;
let scrollSpeed = 5;
let spawnEvent;

function preload() {
    this.load.image('roadTex', 'assets/road.png');
    this.load.image('carTex', 'assets/car.png');
    this.load.image('enemyTex', 'assets/enemy.png');
    this.load.image('policeTex', 'assets/police.png');
}

function create() {
    isGameOver = false;
    targetVelocityX = 0;
    scrollSpeed = 5;

    targetY = 650;
    policeActive = false;
    isCalibrated = false;

    // Build the world
    road = this.add.tileSprite(300, 400, 600, 800, 'roadTex');
    car = this.physics.add.sprite(300, 650, 'carTex');
    car.setDisplaySize(50, 100);
    car.setCollideWorldBounds(true);

    score = 0;
    scoreText = this.add.text(20, 80, 'Score: 0', { 
        font: '32px sans-serif', 
        fill: '#ffffff', 
        fontStyle: 'bold' 
    }).setDepth(30);
    pingText = this.add.text(450, 80, 'Ping: -- ms', { 
        font: '24px sans-serif', fill: '#00ff00', fontStyle: 'bold' 
    }).setDepth(30);

    // Send a ping every 1 second
    this.time.addEvent({
        delay: 1000,
        callback: () => {
            if (ws && ws.readyState === WebSocket.OPEN && isConnected) {
                ws.send(JSON.stringify({ type: 'ping', time: Date.now(), roomId: myRoomId }));
            }
        },
        loop: true
    });

    // Spawn police off-screen at the bottom
    police = this.physics.add.sprite(300, 950, 'policeTex');
    police.setDisplaySize(50, 100);
    
    // Trigger game over if police touches the player
    this.physics.add.collider(car, police, handleCrash, null, this);
    
    enemies = this.physics.add.group();

    // Spawn traffic every 1.5 seconds
    spawnEvent = this.time.addEvent({
        delay: 1500,
        callback: () => {
            if (isGameOver || !isConnected) return;
            let x = Phaser.Math.Between(100, 500);
            let enemy = enemies.create(x, -50, 'enemyTex');

            enemy.setDisplaySize(50, 100);
        },
        loop: true
    });

    // Collision detection
    this.physics.add.collider(car, enemies, handleCrash, null, this);

    // UI overlays
    if (!document.getElementById('gameover-overlay')) {
        let goDiv = document.createElement('div');
        goDiv.id = 'gameover-overlay';
        goDiv.innerHTML = '<h1 style="color:red; font-family:sans-serif; font-size:4rem;">CRASHED</h1><p style="color:white; font-family:sans-serif;">Tap RESTART on your phone</p>';
        goDiv.style.cssText = 'position:absolute; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); display:none; flex-direction:column; justify-content:center; align-items:center; z-index:20;';
        document.body.appendChild(goDiv);
    }
    document.getElementById('gameover-overlay').style.display = 'none';

    document.getElementById('qr-title').innerText = 'Scan to Play';
    document.getElementById('room-display').innerText = `Room: ${myRoomId}`;
    const controllerUrl = `${window.location.origin}/controller/?room=${myRoomId}`;
    document.getElementById('qrcode').innerHTML = '';
    new QRCode(document.getElementById('qrcode'), { text: controllerUrl, width: 200, height: 200 });

    // Close old socket if it exists to prevent ghost connections
    if (ws) ws.close();

    const connectGameSocket = () => {
        const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
        ws = new WebSocket(`${protocol}${location.host}`);
        
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'join', role: 'game', roomId: myRoomId }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Received from server:", data); //
            
            if (data.type === 'sensor' && !isGameOver) {
                if (!isConnected) {
                    document.getElementById('qr-overlay').style.display = 'none';
                    isConnected = true;
                }
                targetVelocityX = data.roll * 8; 
                let clampedPitch = Math.max(0, Math.min(data.pitch, 40));
                scrollSpeed = 3 + (clampedPitch / 40) * 7;

                targetY = 750 - (clampedPitch / 40) * 550;
            }

            if (data.type === 'restart') {
                this.scene.restart();
            }
            if (data.type === 'pong') {
                if (pingText) pingText.setText(`Ping: ${Date.now() - data.time} ms`);
            }
            if (data.type === 'calibrate') {
                isCalibrated = true;
                this.time.delayedCall(8000, () => {
                    policeActive = true;
                });
            }
        };

        ws.onclose = () => {
            isConnected = false;
            setTimeout(connectGameSocket, 3000);
        };
    };

    connectGameSocket();
}

function update() {
    if (isGameOver || !isConnected || !isCalibrated) return;

    road.tilePositionY -= scrollSpeed;
    car.body.velocity.x = Phaser.Math.Linear(car.body.velocity.x, targetVelocityX, 0.2);

    // Smoothly slide the car forward and backward on the screen
    car.y = Phaser.Math.Linear(car.y, targetY, 0.05);

    // Move traffic down the screen relative to the current speed
    Phaser.Actions.IncY(enemies.getChildren(), scrollSpeed * 0.8);

    score += (scrollSpeed / 10);
    scoreText.setText(`Score: ${Math.floor(score)}`);

    // Police Chase & Radar Logic
    if (policeActive) {
        let speedDifference = 6.3 - scrollSpeed; 
        police.y -= speedDifference;
        
        if (police.y > 950) police.y = 950;
        
        if (police.y < 900) {
            let targetX = car.x; 
            let dodging = false;

            enemies.getChildren().forEach(enemy => {
                if (enemy.y < police.y && enemy.y > police.y - 200 && Math.abs(enemy.x - police.x) < 55) {
                    dodging = true;
                    if (police.x <= enemy.x) {
                        targetX = enemy.x - 70; 
                    } else {
                        targetX = enemy.x + 70; 
                    }
                }
            });

            targetX = Phaser.Math.Clamp(targetX, 50, 550);
            let turnSpeed = dodging ? 0.06 : 0.02;
            police.x = Phaser.Math.Linear(police.x, targetX, turnSpeed);
        }
    } else {
        // Keep police safely off-screen until the 8 seconds are up
        police.y = 5000;
        police.x = car.x;
    }
}

function handleCrash() {

    // Ignore the crash if the game is over OR if the 8-second timer hasn't finished
    if (isGameOver || !policeActive) return;

    if (isGameOver) return;
    isGameOver = true;
    car.setTint(0xff0000); // Flash car red
    document.getElementById('gameover-overlay').style.display = 'flex';
    
    // Broadcast crash to the phone
    ws.send(JSON.stringify({ type: 'gameover', roomId: myRoomId }));
}