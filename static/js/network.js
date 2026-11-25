import { io } from './vendor/socket.io-4.8.4.esm.min.js';

const INPUT_INTERVAL_MS = 50;

let socket;
let lastInputSent = 0;
let lastInput = { dx: 0, dy: 0 };

export function initNetwork({ onWelcome, onState, onDied, onDisconnect }) {
    socket = io();
    socket.on('welcome', onWelcome);
    socket.on('state', onState);
    socket.on('died', onDied);
    socket.on('disconnect', onDisconnect);
}

export function join(name) {
    socket.emit('join', { name });
}

export function sendInput(dx, dy) {
    const now = performance.now();
    const changed = dx !== lastInput.dx || dy !== lastInput.dy;
    if (!changed || now - lastInputSent < INPUT_INTERVAL_MS) return;
    lastInputSent = now;
    lastInput = { dx, dy };
    socket.emit('input', { dx, dy });
}

export function sendSplit() {
    socket.emit('split');
}
