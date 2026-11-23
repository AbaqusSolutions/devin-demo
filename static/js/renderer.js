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

function drawCircle(x, y, value, color, isFood) {
    const size = isFood ? value : getSize(value);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawCellWithName(x, y, score, color, name) {
    const size = getSize(score);
    
    // Draw cell
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Draw name
    if (size > 20) {  // Only draw name if cell is big enough
        ctx.save();
        
        // Calculate font size based on cell size
        const fontSize = Math.max(12, Math.min(20, size / 2));
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw text stroke (outline)
        ctx.strokeText(name, x, y);
        // Draw text fill
        ctx.fillText(name, x, y);
        
        ctx.restore();
    }
}

function getMyPlayer() {
    return gameState.players.find(p => p.id === gameState.myId);
}

export function drawGame() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Follow own center of mass while alive; otherwise keep the last camera position
    const me = getMyPlayer();
    if (me && me.cells.length > 0) {
        const centerOfMass = calculateCenterOfMass(me.cells);
        gameState.camera.x = centerOfMass.x - canvas.width / 2;
        gameState.camera.y = centerOfMass.y - canvas.height / 2;
    }

    // Draw food
    gameState.food.forEach(([x, y, color]) => {
        const screenX = x - gameState.camera.x;
        const screenY = y - gameState.camera.y;
        
        if (screenX >= -FOOD_SIZE && screenX <= canvas.width + FOOD_SIZE &&
            screenY >= -FOOD_SIZE && screenY <= canvas.height + FOOD_SIZE) {
            drawCircle(screenX, screenY, FOOD_SIZE, color, true);
        }
    });

    // Draw every player's cells, smallest first so bigger cells render on top
    const cells = gameState.players.flatMap(player => player.cells.map(cell => ({
        ...cell,
        name: player.name,
        color: player.id === gameState.myId ? COLORS.PLAYER : player.color
    })));
    cells.sort((a, b) => a.score - b.score);

    cells.forEach(cell => {
        const screenX = cell.x - gameState.camera.x;
        const screenY = cell.y - gameState.camera.y;
        const size = getSize(cell.score);
        
        if (screenX >= -size && screenX <= canvas.width + size &&
            screenY >= -size && screenY <= canvas.height + size) {
            drawCellWithName(screenX, screenY, cell.score, cell.color, cell.name);
        }
    });

    // Update score display
    const myScore = me ? me.cells.reduce((sum, cell) => sum + cell.score, 0) : 0;
    scoreElement.textContent = `Score: ${Math.floor(myScore)}`;
}

export function drawMinimap() {
    if (!minimapCtx) return;

    const MINIMAP_SIZE = 150;
    const scale = MINIMAP_SIZE / WORLD_SIZE;
    
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    minimapCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    
    const viewWidth = canvas.width * scale;
    const viewHeight = canvas.height * scale;
    const viewX = gameState.camera.x * scale;
    const viewY = gameState.camera.y * scale;
    minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
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

        const name = document.createElement('span');
        if (player.id === gameState.myId) name.className = 'player-name';
        name.textContent = `${index + 1}. ${player.name}`;

        const score = document.createElement('span');
        score.textContent = Math.floor(player.score);

        row.append(name, score);
        return row;
    });

    leaderboardContent.replaceChildren(...rows);
}
