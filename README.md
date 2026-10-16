# Anything but a Game Controller 🚗💨

A real-time motion-controlled web game where an ordinary smartphone is transformed into a low-latency steering wheel using device orientation sensors and WebSockets.

## 🚀 Tech Stack
* **Frontend Game Engine:** Phaser.js 3 (Rendered via CDN)
* **Mobile Controller:** Vanilla HTML5, CSS3, and JavaScript (DeviceOrientation API)
* **Backend & Signaling:** Node.js, Express, and `ws` (WebSockets)
* **Pairing:** qrcode.js for automated local URL hand-off

## 📱 Features & Architecture
1. **Zero-Lag Local Network Routing:** Bypasses external cloud tunnels during local play to achieve sub-5ms WebSocket communication over a local Wi-Fi router.
2. **Seamless QR Auto-Pairing:** The laptop game dynamically generates a unique 4-digit room code and encodes it into a scannable QR code. Scanning it instantly populates the mobile controller and opens the session.
3. **Orientation Calibration:** Users tap the mobile screen to establish a neutral baseline for their phone's pitch and roll, filtering out hand drift.
4. **Dynamic Gameplay Loop:** Features real-time score tracking, an advancing police chase with obstacle-avoidance radar, haptic vibration feedback on crashes, and an automatic reconnection loop.

## 🛠️ Running Locally
1. Install dependencies:
   ```bash
   npm install