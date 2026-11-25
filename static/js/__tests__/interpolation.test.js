import { interpolatePlayers } from '../interpolation.js';

const snap = (cells, id = 'a') => ({ players: [{ id, name: 'A', color: 'red', cells }] });

describe('interpolatePlayers', () => {
  test('returns current cells as objects when there is no previous snapshot', () => {
    const [player] = interpolatePlayers(null, snap([[10, 20, 100]]), 0.5);
    expect(player).toEqual({ id: 'a', name: 'A', color: 'red', cells: [{ x: 10, y: 20, score: 100 }] });
  });

  test('blends positions and scores between snapshots', () => {
    const [player] = interpolatePlayers(snap([[0, 0, 100]]), snap([[10, 20, 200]]), 0.5);
    expect(player.cells[0]).toEqual({ x: 5, y: 10, score: 150 });
  });

  test('clamps alpha to [0, 1]', () => {
    const prev = snap([[0, 0, 100]]);
    const curr = snap([[10, 0, 100]]);
    expect(interpolatePlayers(prev, curr, 5)[0].cells[0].x).toBe(10);
    expect(interpolatePlayers(prev, curr, -1)[0].cells[0].x).toBe(0);
  });

  test('uses current cells when the cell count changed', () => {
    const [player] = interpolatePlayers(snap([[0, 0, 100]]), snap([[10, 0, 50], [20, 0, 50]]), 0.5);
    expect(player.cells).toEqual([{ x: 10, y: 0, score: 50 }, { x: 20, y: 0, score: 50 }]);
  });

  test('new players appear at their current position', () => {
    const [player] = interpolatePlayers(snap([[0, 0, 100]], 'other'), snap([[10, 0, 100]]), 0.5);
    expect(player.cells[0].x).toBe(10);
  });
});
