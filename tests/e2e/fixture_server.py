"""Local-only multiplayer fixture for the Playwright collision regression."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import app as server
from game.world import Cell, Player, World


class CollisionWorld(World):
    def _respawn(self):
        pass

    def add_player(self, player_id, name):
        player = super().add_player(player_id, name)
        if player.name == 'Alice':
            player.cells = [Cell(x=500, y=500, score=100)]
        return player

    def set_input(self, player_id, dx, dy):
        player = self.players.get(player_id)
        if (player is not None and player.name == 'Alice' and
                isinstance(dx, (int, float)) and dx <= 0):
            return
        super().set_input(player_id, dx, dy)

    def _move(self, player):
        if player.name == 'Bob' or (player.name == 'Alice' and player.last_split == float('-inf')):
            return
        super()._move(player)


server.world = CollisionWorld(spawn_bots=False)
server.world.players['bob-fixture'] = Player(
    id='bob-fixture', name='Bob', color='red',
    cells=[Cell(x=580, y=500, score=49)],
)

if __name__ == '__main__':
    server.socketio.run(
        server.app, host='127.0.0.1', port=51237,
        debug=False, allow_unsafe_werkzeug=True,
    )
