function toCells(rawCells) {
    return rawCells.map(([x, y, score]) => ({ x, y, score }));
}

// Blend two server snapshots so movement looks smooth between 20 Hz updates.
// Cells are matched by index; if a player's cell count changed (split/merge/eaten)
// the latest cells are used as-is.
export function interpolatePlayers(prev, curr, alpha) {
    const t = Math.max(0, Math.min(1, alpha));
    const prevById = new Map((prev?.players || []).map(p => [p.id, p]));

    return curr.players.map(player => {
        const before = prevById.get(player.id);
        const cells = toCells(player.cells);
        if (before && before.cells.length === player.cells.length) {
            before.cells.forEach(([x, y, score], i) => {
                cells[i].x = x + (cells[i].x - x) * t;
                cells[i].y = y + (cells[i].y - y) * t;
                cells[i].score = score + (cells[i].score - score) * t;
            });
        }
        return { id: player.id, name: player.name, color: player.color, cells };
    });
}
