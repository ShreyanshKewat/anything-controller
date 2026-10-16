const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '../public')));

const rooms = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'join') {
                ws.roomId = data.roomId;
                if (!rooms.has(data.roomId)) {
                    rooms.set(data.roomId, new Set());
                }
                rooms.get(data.roomId).add(ws);
                console.log(`Device joined room: ${data.roomId}`);
            }

            if (['sensor', 'gameover', 'restart', 'ping', 'pong', 'calibrate'].includes(data.type) && ws.roomId && rooms.has(ws.roomId)) {
                rooms.get(ws.roomId).forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data)); 
                    }
                });
            }
        } catch (error) {
            console.error('WebSocket parse error:', error);
        }
    });

    ws.on('close', () => {
        if (ws.roomId && rooms.has(ws.roomId)) {
            rooms.get(ws.roomId).delete(ws);
            if (rooms.get(ws.roomId).size === 0) rooms.delete(ws.roomId);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Relay server live on port ${PORT}`);
});