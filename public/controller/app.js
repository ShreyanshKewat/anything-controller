const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
if (roomFromUrl) document.getElementById('roomCode').value = roomFromUrl;

let ws;
let roomId = '';
let baselineGamma = 0; 
let baselineBeta = 0;  
let isGameOver = false;

const statusText = document.getElementById('status');
const setupDiv = document.getElementById('setup');
const playArea = document.getElementById('play-area');
const touchArea = document.getElementById('touch-area');
const restartBtn = document.getElementById('restartBtn');

document.getElementById('connectBtn').addEventListener('click', async () => {
    roomId = document.getElementById('roomCode').value.trim();
    if (!roomId) return alert('Enter a room code');
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') return;
    }
    connectWebSocket();
});

function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    ws = new WebSocket(`${protocol}${location.host}`);

    ws.onopen = () => {
        statusText.innerText = `Connected: ${roomId}`;
        statusText.style.color = '#00e676';
        setupDiv.style.display = 'none';
        playArea.style.display = 'flex';
        ws.send(JSON.stringify({ type: 'join', role: 'controller', roomId }));
        window.addEventListener('deviceorientation', handleMotion);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'gameover') {
            isGameOver = true;
            restartBtn.style.display = 'block';
            touchArea.style.display = 'none';

            // Trigger a double-pulse vibration on crash (300ms on, 100ms off, 300ms on)
            if (navigator.vibrate) navigator.vibrate([300, 100, 300]);

        }

        if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', time: data.time, roomId: roomId }));
        }
    };
    ws.onclose = () => {
        statusText.innerText = 'Reconnecting...';
        statusText.style.color = '#ffaa00';
        setTimeout(connectWebSocket, 3000); 
    };
}

function handleMotion(event) {
    if (!ws || ws.readyState !== WebSocket.OPEN || isGameOver) return;
    ws.send(JSON.stringify({
        type: 'sensor',
        roll: Math.round((event.gamma || 0) - baselineGamma),
        pitch: Math.round((event.beta || 0) - baselineBeta)
    }));
}

touchArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    // Broadcast the calibration signal to start the game
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'calibrate', roomId }));
    }
    window.addEventListener('deviceorientation', function calibrate(ev) {
        baselineGamma = ev.gamma || 0;
        baselineBeta = ev.beta || 0;
        window.removeEventListener('deviceorientation', calibrate);
    });
    touchArea.innerText = 'CALIBRATED!';
    setTimeout(() => { touchArea.innerText = 'TAP TO CALIBRATE'; }, 1000);
});

restartBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    ws.send(JSON.stringify({ type: 'restart', roomId }));
    isGameOver = false;
    restartBtn.style.display = 'none';
    touchArea.style.display = 'block';
});