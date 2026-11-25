// Gameplay constants live on the server (game/config.py); these are only for rendering.
export const WORLD_SIZE = 2000;
export const FOOD_SIZE = 5;

export const COLORS = {
    PLAYER: '#00f0ff',
    BACKGROUND: '#05010d',
    GRID: 'rgba(0, 240, 255, 0.07)',
    GRID_MAJOR: 'rgba(0, 240, 255, 0.16)',
    WORLD_BORDER: '#ff2bd6',
    TEXT: '#e8faff',
    TOP_PLAYER: '#fcee0a',
    MINIMAP: {
        PLAYER: '#00f0ff',
        TOP_PLAYER: '#fcee0a',
        OTHER: 'rgba(255, 43, 214, 0.45)',
        VIEW: 'rgba(0, 240, 255, 0.6)',
        GRID: 'rgba(0, 240, 255, 0.12)'
    }
};
