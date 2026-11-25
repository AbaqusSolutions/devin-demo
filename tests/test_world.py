import random

import pytest

from game import World, sanitize_name
from game.config import (
    EAT_BONUS,
    FOOD_COUNT,
    FOOD_SCORE,
    MAX_PLAYER_CELLS,
    MERGE_COOLDOWN,
    MIN_SPLIT_SCORE,
    SPLIT_COOLDOWN,
    STARTING_SCORE,
    TARGET_POPULATION,
    WORLD_SIZE,
)
from game.world import Cell


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


@pytest.fixture
def clock():
    return FakeClock()


@pytest.fixture
def world(clock):
    w = World(rng=random.Random(42), clock=clock, spawn_bots=False)
    w.food = []
    return w


def place(world, player_id, cells):
    world.players[player_id].cells = [Cell(x=x, y=y, score=s) for x, y, s in cells]


class TestSanitizeName:
    def test_trims_and_truncates(self):
        assert sanitize_name('  ' + 'a' * 30 + '  ') == 'a' * 16

    def test_strips_control_characters(self):
        assert sanitize_name('ev\x00il\nname') == 'evilname'

    def test_defaults_when_empty_or_invalid(self):
        assert sanitize_name('   ') == 'Player'
        assert sanitize_name(None) == 'Player'
        assert sanitize_name(123) == 'Player'


class TestPlayers:
    def test_add_player_spawns_one_cell_inside_world(self, world):
        player = world.add_player('a', 'Alice')
        assert player.name == 'Alice'
        assert len(player.cells) == 1
        cell = player.cells[0]
        assert cell.score == STARTING_SCORE
        assert 0 <= cell.x <= WORLD_SIZE and 0 <= cell.y <= WORLD_SIZE

    def test_remove_player(self, world):
        world.add_player('a', 'Alice')
        world.remove_player('a')
        assert 'a' not in world.players

    def test_remove_unknown_player_is_noop(self, world):
        world.remove_player('nope')

    def test_bots_fill_world_and_make_room_for_humans(self, clock):
        w = World(rng=random.Random(1), clock=clock)
        assert sum(p.is_bot for p in w.players.values()) == TARGET_POPULATION
        for i in range(4):
            w.add_player(f'h{i}', f'H{i}')
        w.tick()
        assert sum(p.is_bot for p in w.players.values()) == TARGET_POPULATION - 4


class TestInput:
    def test_direction_is_normalized(self, world):
        world.add_player('a', 'Alice')
        world.set_input('a', 30, 40)
        assert world.players['a'].direction == pytest.approx((0.6, 0.8))

    @pytest.mark.parametrize('dx,dy', [(float('nan'), 1), (float('inf'), 0), ('x', 1), (None, None)])
    def test_invalid_input_stops_player(self, world, dx, dy):
        world.add_player('a', 'Alice')
        world.set_input('a', 1, 0)
        world.set_input('a', dx, dy)
        assert world.players['a'].direction == (0.0, 0.0)

    def test_input_for_unknown_player_is_ignored(self, world):
        world.set_input('ghost', 1, 0)

    def test_player_moves_towards_direction(self, world):
        world.add_player('a', 'Alice')
        place(world, 'a', [(500, 500, 100)])
        world.set_input('a', 1, 0)
        world.tick()
        cell = world.players['a'].cells[0]
        assert cell.x > 500
        assert cell.y == pytest.approx(500)

    def test_position_is_clamped_to_world(self, world):
        world.add_player('a', 'Alice')
        place(world, 'a', [(WORLD_SIZE, 10, 100)])
        world.players['a'].cells[0].vx = 50
        world.set_input('a', 1, 0)
        world.tick()
        assert world.players['a'].cells[0].x == WORLD_SIZE


class TestSplit:
    def test_does_not_split_below_minimum_score(self, world):
        world.add_player('a', 'Alice')
        place(world, 'a', [(100, 100, MIN_SPLIT_SCORE - 1)])
        world.set_input('a', 1, 0)
        world.split('a')
        assert len(world.players['a'].cells) == 1

    def test_splits_cell_in_half(self, world):
        world.add_player('a', 'Alice')
        place(world, 'a', [(100, 100, 100)])
        world.set_input('a', 1, 0)
        world.split('a')
        assert [c.score for c in world.players['a'].cells] == [50, 50]

    def test_does_not_split_without_direction(self, world):
        world.add_player('a', 'Alice')
        place(world, 'a', [(100, 100, 100)])
        world.split('a')
        assert len(world.players['a'].cells) == 1

    def test_does_not_exceed_max_cells(self, world):
        world.add_player('a', 'Alice')
        place(world, 'a', [(100, 100, 100)] * MAX_PLAYER_CELLS)
        world.set_input('a', 1, 0)
        world.split('a')
        assert len(world.players['a'].cells) == MAX_PLAYER_CELLS

    def test_split_is_rate_limited(self, world, clock):
        world.add_player('a', 'Alice')
        place(world, 'a', [(100, 100, 400)])
        world.set_input('a', 1, 0)
        world.split('a')
        world.split('a')
        assert len(world.players['a'].cells) == 2
        clock.now += SPLIT_COOLDOWN
        world.split('a')
        assert len(world.players['a'].cells) == 4


class TestMerge:
    def test_cells_merge_after_cooldown(self, world, clock):
        world.add_player('a', 'Alice')
        place(world, 'a', [(500, 500, 100), (501, 500, 100)])
        for cell in world.players['a'].cells:
            cell.split_time = clock.now
        world.tick()
        assert len(world.players['a'].cells) == 2
        clock.now += MERGE_COOLDOWN + 1
        world.tick()
        cells = world.players['a'].cells
        assert len(cells) == 1
        assert cells[0].score == 200


class TestFood:
    def test_cell_eats_overlapping_food(self, world):
        world.add_player('a', 'Alice')
        place(world, 'a', [(100, 100, 100)])
        world.food = [{'x': 100, 'y': 100, 'color': 'red'}]
        world._handle_food()
        assert world.food == []
        assert world.players['a'].cells[0].score == 100 + FOOD_SCORE

    def test_food_remains_when_far(self, world):
        world.add_player('a', 'Alice')
        place(world, 'a', [(100, 100, 100)])
        world.food = [{'x': 500, 'y': 500, 'color': 'red'}]
        world._handle_food()
        assert len(world.food) == 1

    def test_food_respawns_on_tick(self, world):
        world.tick()
        assert len(world.food) == FOOD_COUNT


class TestPlayerCollisions:
    def test_split_cell_eats_slightly_smaller_human(self, world):
        world.add_player('a', 'Alice')
        world.add_player('b', 'Bob')
        place(world, 'a', [(500, 500, 100)])
        place(world, 'b', [(500, 500, 49)])
        world.set_input('a', 1, 0)

        world.split('a')
        assert [cell.score for cell in world.players['a'].cells] == [50, 50]
        assert world.tick() == ['b']
        assert len(world.players['a'].cells) == 2
        assert world.players['a'].score == 100 + 49 + EAT_BONUS

    def test_slightly_bigger_human_eats_without_splitting(self, world):
        world.add_player('a', 'Alice')
        world.add_player('b', 'Bob')
        place(world, 'a', [(500, 500, 100)])
        place(world, 'b', [(500, 500, 99)])

        assert world.tick() == ['b']
        assert world.players['a'].score == 100 + 99 + EAT_BONUS

    def test_bigger_human_eats_smaller_human(self, world):
        world.add_player('a', 'Alice')
        world.add_player('b', 'Bob')
        place(world, 'a', [(100, 100, 400)])
        place(world, 'b', [(100, 100, 100)])
        died = world._handle_player_collisions()
        assert died == ['b']
        assert 'b' not in world.players
        assert world.players['a'].cells[0].score == 400 + 100 + EAT_BONUS

    def test_equal_sizes_do_not_eat(self, world):
        world.add_player('a', 'Alice')
        world.add_player('b', 'Bob')
        place(world, 'a', [(100, 100, 100)])
        place(world, 'b', [(100, 100, 100)])
        assert world._handle_player_collisions() == []
        assert len(world.players) == 2

    def test_slightly_bigger_human_does_not_eat_when_apart(self, world):
        world.add_player('a', 'Alice')
        world.add_player('b', 'Bob')
        place(world, 'a', [(500, 500, 100)])
        place(world, 'b', [(900, 500, 99)])

        assert world.tick() == []
        assert len(world.players) == 2

    def test_own_cells_do_not_eat_each_other(self, world):
        world.add_player('a', 'Alice')
        place(world, 'a', [(100, 100, 400), (100, 100, 50)])
        world._handle_player_collisions()
        assert len(world.players['a'].cells) == 2

    def test_losing_one_of_several_cells_keeps_player_alive(self, world):
        world.add_player('a', 'Alice')
        world.add_player('b', 'Bob')
        place(world, 'a', [(100, 100, 400)])
        place(world, 'b', [(100, 100, 50), (1500, 1500, 50)])
        assert world._handle_player_collisions() == []
        assert len(world.players['b'].cells) == 1

    def test_tick_reports_dead_humans_but_not_bots(self, clock):
        w = World(rng=random.Random(3), clock=clock, spawn_bots=False)
        w.add_player('a', 'Alice')
        w.add_bot()
        bot_id = next(pid for pid, p in w.players.items() if p.is_bot)
        place(w, 'a', [(100, 100, 100)])
        place(w, bot_id, [(100, 100, 1000)])
        assert w.tick() == ['a']


class TestSnapshot:
    def test_snapshot_contains_players_food_and_leaderboard(self, world):
        world.add_player('a', 'Alice')
        world.add_player('b', 'Bob')
        place(world, 'a', [(100, 100, 300)])
        place(world, 'b', [(900, 900, 100), (950, 900, 100)])
        world.food = [{'x': 1, 'y': 2, 'color': 'red'}]
        snap = world.snapshot()
        assert {p['id'] for p in snap['players']} == {'a', 'b'}
        bob = next(p for p in snap['players'] if p['id'] == 'b')
        assert bob['cells'] == [[900, 900, 100], [950, 900, 100]]
        assert snap['food'] == [[1, 2, 'red']]
        assert snap['leaderboard'][0] == {'id': 'a', 'name': 'Alice', 'score': 300}
