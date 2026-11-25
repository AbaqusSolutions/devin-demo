import { gameState, mouse } from './gameState.js';
import { initRenderer, resizeCanvas, drawGame, drawMinimap, updateLeaderboard } from './renderer.js';
import { interpolatePlayers } from './interpolation.js';
import { initNetwork, join, sendInput, sendSplit } from './network.js';
import { initUI } from './ui.js';

const NAME_STORAGE_KEY = 'playerName';

let joinScreen, joinForm, nameInput, joinTitle;

function setupInputHandlers() {
    const canvas = document.getElementById('gameCanvas');
    
    // Mouse movement
    canvas.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Mouse click for splitting
    canvas.addEventListener('click', () => {
        if (gameState.alive) sendSplit();
    });

    // Window resize
    window.addEventListener('resize', () => {
        resizeCanvas();
    });
}

function showJoinScreen(title) {
    gameState.alive = false;
    joinTitle.textContent = title;
    joinTitle.dataset.text = title;
    joinScreen.classList.add('visible');
    nameInput.focus();
}

function setupJoinScreen() {
    joinScreen = document.getElementById('join-screen');
    joinForm = document.getElementById('join-form');
    nameInput = document.getElementById('name-input');
    joinTitle = document.getElementById('join-title');

    nameInput.value = localStorage.getItem(NAME_STORAGE_KEY) || '';
    joinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        localStorage.setItem(NAME_STORAGE_KEY, name);
        join(name);
    });
}

function setupNetwork() {
    initNetwork({
        onWelcome: ({ id }) => {
            gameState.myId = id;
            gameState.alive = true;
            joinScreen.classList.remove('visible');
        },
        onState: (snapshot) => {
            gameState.prevSnapshot = gameState.currSnapshot;
            gameState.currSnapshot = { ...snapshot, receivedAt: performance.now() };
        },
        onDied: () => showJoinScreen('FLATLINED // JACK IN AGAIN?'),
        onDisconnect: () => showJoinScreen('SIGNAL LOST // RECONNECTING...')
    });
}

function updateView() {
    const { prevSnapshot: prev, currSnapshot: curr } = gameState;
    if (!curr) return;

    const interval = prev ? curr.receivedAt - prev.receivedAt : 0;
    const alpha = interval > 0 ? (performance.now() - curr.receivedAt) / interval : 1;

    gameState.players = interpolatePlayers(prev, curr, alpha);
    gameState.food = curr.food;
    gameState.leaderboard = curr.leaderboard;
}

function sendMouseDirection() {
    if (!gameState.alive) return;
    sendInput(mouse.x - window.innerWidth / 2, mouse.y - window.innerHeight / 2);
}

function gameLoop() {
    sendMouseDirection();
    updateView();
    updateLeaderboard();
    drawGame();
    drawMinimap();
    requestAnimationFrame(gameLoop);
}

async function initGame() {
    try {
        console.log('Initializing game...');
        
        // Get DOM elements
        const elements = {
            gameCanvas: document.getElementById('gameCanvas'),
            minimapCanvas: document.getElementById('minimap'),
            scoreElement: document.getElementById('score'),
            leaderboardContent: document.getElementById('leaderboard-content')
        };

        // Verify all elements are found
        Object.entries(elements).forEach(([key, element]) => {
            if (!element) {
                throw new Error(`Could not find element: ${key}`);
            }
        });

        console.log('DOM elements found');

        // Initialize game components in order
        initRenderer(elements);
        console.log('Renderer initialized');
        
        setupInputHandlers();
        console.log('Input handlers set up');

        setupJoinScreen();
        setupNetwork();
        console.log('Connected to server');

        initUI();
        console.log('UI initialized');

        // Start game loop
        console.log('Starting game loop');
        showJoinScreen('JACK IN TO THE GRID');
        gameLoop();
    } catch (error) {
        console.error('Error initializing game:', error);
    }
}

// Start the game when the DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
