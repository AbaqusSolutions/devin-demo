export const gameState = {
    myId: null,
    alive: false,
    camera: {
        x: 0,
        y: 0
    },
    // Last two snapshots received from the server, used for interpolation
    prevSnapshot: null,
    currSnapshot: null,
    // Interpolated view for the current frame
    players: [],
    food: [],
    leaderboard: []
};

export const mouse = { x: 0, y: 0 };
