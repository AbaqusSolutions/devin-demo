import { gameState } from './gameState.js';
import { getSize, calculateCenterOfMass } from './utils.js';
import { WORLD_SIZE, COLORS, FOOD_SIZE } from './config.js';

let canvas, ctx, minimapCanvas, minimapCtx, scoreElement, leaderboardContent;

export function initRenderer(canvasElements) {
    canvas = canvasElements.gameCanvas;
    ctx = canvas.getContext('2d');
    minimapCanvas = canvasElements.minimapCanvas;
    minimapCtx = minimapCanvas.getContext('2d');
    scoreElement = canvasElements.scoreElement;
    leaderboardContent = canvasElements.leaderboardContent;

    // Initial canvas setup
    resizeCanvas();
}

export function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

const GRID_STEP = 50;
const GRID_MAJOR_STEP = 250;

function drawGrid() {
    const camX = gameState.camera.x;
    const camY = gameState.camera.y;
    const minX = Math.max(0, Math.floor(camX / GRID_STEP) * GRID_STEP);
    const maxX = Math.min(WORLD_SIZE, camX + canvas.width);
    const minY = Math.max(0, Math.floor(camY / GRID_STEP) * GRID_STEP);
    const maxY = Math.min(WORLD_SIZE, camY + canvas.height);
    const top = Math.max(0, camY) - camY;
    const bottom = maxY - camY;
    const left = Math.max(0, camX) - camX;
    const right = maxX - camX;

    ctx.lineWidth = 1;
    [[COLORS.GRID, false], [COLORS.GRID_MAJOR, true]].forEach(([color, major]) => {
        ctx.beginPath();
        for (let x = minX; x <= maxX; x += GRID_STEP) {
            if ((x % GRID_MAJOR_STEP === 0) !== major) continue;
            const sx = Math.round(x - camX) + 0.5;
            ctx.moveTo(sx, top);
            ctx.lineTo(sx, bottom);
        }
        for (let y = minY; y <= maxY; y += GRID_STEP) {
            if ((y % GRID_MAJOR_STEP === 0) !== major) continue;
            const sy = Math.round(y - camY) + 0.5;
            ctx.moveTo(left, sy);
            ctx.lineTo(right, sy);
        }
        ctx.strokeStyle = color;
        ctx.stroke();
    });

    ctx.save();
    ctx.strokeStyle = COLORS.WORLD_BORDER;
    ctx.shadowColor = COLORS.WORLD_BORDER;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3;
    ctx.strokeRect(-camX, -camY, WORLD_SIZE, WORLD_SIZE);
    ctx.restore();
}

function drawFood(x, y, color) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(x, y, FOOD_SIZE * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, FOOD_SIZE * 0.7, 0, Math.PI * 2);
    ctx.fill();
}

function drawCellWithName(x, y, score, color, name, isMe) {
    const size = getSize(score);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 1, 13, 0.65)';
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    if (isMe) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        const ringRadius = size + 8;
        for (let i = 0; i < 4; i++) {
            const start = i * Math.PI / 2 - Math.PI / 12;
            ctx.beginPath();
            ctx.arc(x, y, ringRadius, start, start + Math.PI / 6);
            ctx.stroke();
        }
        ctx.restore();
    }

    if (size > 20) {  // Only draw name if cell is big enough
        ctx.save();
        const fontSize = Math.max(12, Math.min(20, size / 2));
        ctx.font = `700 ${fontSize}px Orbitron, 'Share Tech Mono', monospace`;
        ctx.fillStyle = COLORS.TEXT;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.toUpperCase(), x, y);
        ctx.restore();
    }
}

function getMyPlayer() {
    return gameState.players.find(p => p.id === gameState.myId);
}

export function drawGame() {
    if (!ctx) return;

    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Follow own center of mass while alive; otherwise keep the last camera position
    const me = getMyPlayer();
    if (me && me.cells.length > 0) {
        const centerOfMass = calculateCenterOfMass(me.cells);
        gameState.camera.x = centerOfMass.x - canvas.width / 2;
        gameState.camera.y = centerOfMass.y - canvas.height / 2;
    }

    drawGrid();

    // Draw food
    gameState.food.forEach(([x, y, color]) => {
        const screenX = x - gameState.camera.x;
        const screenY = y - gameState.camera.y;
        
        if (screenX >= -FOOD_SIZE && screenX <= canvas.width + FOOD_SIZE &&
            screenY >= -FOOD_SIZE && screenY <= canvas.height + FOOD_SIZE) {
            drawFood(screenX, screenY, color);
        }
    });

    // Draw every player's cells, smallest first so bigger cells render on top
    const cells = gameState.players.flatMap(player => player.cells.map(cell => ({
        ...cell,
        name: player.name,
        isMe: player.id === gameState.myId,
        color: player.id === gameState.myId ? COLORS.PLAYER : player.color
    })));
    cells.sort((a, b) => a.score - b.score);

    cells.forEach(cell => {
        const screenX = cell.x - gameState.camera.x;
        const screenY = cell.y - gameState.camera.y;
        const size = getSize(cell.score);
        
        if (screenX >= -size && screenX <= canvas.width + size &&
            screenY >= -size && screenY <= canvas.height + size) {
            drawCellWithName(screenX, screenY, cell.score, cell.color, cell.name, cell.isMe);
        }
    });

    // Update score display
    const myScore = me ? me.cells.reduce((sum, cell) => sum + cell.score, 0) : 0;
    scoreElement.textContent = `CREDITS: ${Math.floor(myScore)}`;
}

export function drawMinimap() {
    if (!minimapCtx) return;

    const MINIMAP_SIZE = 150;
    const scale = MINIMAP_SIZE / WORLD_SIZE;
    
    minimapCtx.fillStyle = 'rgba(5, 1, 13, 0.85)';
    minimapCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    minimapCtx.strokeStyle = COLORS.MINIMAP.GRID;
    minimapCtx.lineWidth = 1;
    minimapCtx.beginPath();
    for (let i = 1; i < 4; i++) {
        const p = Math.round(i * MINIMAP_SIZE / 4) + 0.5;
        minimapCtx.moveTo(p, 0);
        minimapCtx.lineTo(p, MINIMAP_SIZE);
        minimapCtx.moveTo(0, p);
        minimapCtx.lineTo(MINIMAP_SIZE, p);
    }
    minimapCtx.stroke();
    
    const viewWidth = canvas.width * scale;
    const viewHeight = canvas.height * scale;
    const viewX = gameState.camera.x * scale;
    const viewY = gameState.camera.y * scale;
    minimapCtx.strokeStyle = COLORS.MINIMAP.VIEW;
    minimapCtx.strokeRect(viewX, viewY, viewWidth, viewHeight);

    const topPlayerId = gameState.leaderboard[0]?.id;

    gameState.players.forEach(player => {
        const isMe = player.id === gameState.myId;
        let color = COLORS.MINIMAP.OTHER;
        if (isMe) color = COLORS.MINIMAP.PLAYER;
        else if (player.id === topPlayerId) color = COLORS.MINIMAP.TOP_PLAYER;

        player.cells.forEach(cell => {
            minimapCtx.beginPath();
            minimapCtx.arc(cell.x * scale, cell.y * scale, isMe ? 3 : 2, 0, Math.PI * 2);
            minimapCtx.fillStyle = color;
            minimapCtx.fill();
        });
    });
}

export function updateLeaderboard() {
    if (!leaderboardContent) return;

    // Built with DOM nodes + textContent: player names are user input
    const rows = gameState.leaderboard.map((player, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-item';

        if (index === 0) row.classList.add('top-rank');

        const name = document.createElement('span');
        if (player.id === gameState.myId) name.className = 'player-name';
        name.textContent = `${String(index + 1).padStart(2, '0')} ${player.name}`;

        const score = document.createElement('span');
        score.textContent = Math.floor(player.score);

        row.append(name, score);
        return row;
    });

    leaderboardContent.replaceChildren(...rows);
}
