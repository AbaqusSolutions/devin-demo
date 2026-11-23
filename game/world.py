import itertools
import math
import random
import time
import unicodedata
from dataclasses import dataclass, field

from .config import (
    BOT_NAMES,
    BOT_STARTING_SCORE,
    COLLISION_THRESHOLD,
    DEFAULT_NAME,
    EAT_BONUS,
    FOOD_COUNT,
    FOOD_SCORE,
    FOOD_SIZE,
    LEADERBOARD_SIZE,
    MAX_NAME_LENGTH,
    MAX_PLAYER_CELLS,
    MERGE_COOLDOWN,
    MERGE_DISTANCE,
    MERGE_FORCE,
    MERGE_START_FORCE,
    MIN_BOTS,
    MIN_SPLIT_SCORE,
    REPULSION_STRENGTH,
    SPLIT_COOLDOWN,
    SPLIT_VELOCITY,
    STARTING_SCORE,
    TARGET_POPULATION,
    WORLD_SIZE,
)


def get_size(score):
    return math.sqrt(score) + 20


def get_distance(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def clamp(value):
    return max(0.0, min(WORLD_SIZE, value))


def sanitize_name(name):
    if not isinstance(name, str):
        return DEFAULT_NAME
    cleaned = ''.join(ch for ch in name if not unicodedata.category(ch).startswith('C'))
    return cleaned.strip()[:MAX_NAME_LENGTH].strip() or DEFAULT_NAME


@dataclass
class Cell:
    x: float
    y: float
    score: float
    vx: float = 0.0
    vy: float = 0.0
    split_time: float = 0.0


@dataclass
class Player:
    id: str
    name: str
    color: str
    is_bot: bool = False
    cells: list = field(default_factory=list)
    direction: tuple = (0.0, 0.0)
    last_split: float = float('-inf')

    @property
    def score(self):
        return sum(c.score for c in self.cells)


class World:
    """Authoritative game state shared by every connected client."""

    def __init__(self, rng=None, clock=time.monotonic, spawn_bots=True):
        self.rng = rng or random.Random()
        self.clock = clock
        self.spawn_bots = spawn_bots
        self.players = {}
        self.food = []
        self._bot_ids = itertools.count()
        self._respawn()

    # Player lifecycle

    def add_player(self, player_id, name):
        player = Player(id=player_id, name=sanitize_name(name), color=self._random_color())
        player.cells = [self._new_cell(STARTING_SCORE)]
        self.players[player_id] = player
        return player

    def add_bot(self):
        used = {p.name for p in self.players.values() if p.is_bot}
        name = next((n for n in BOT_NAMES if n not in used), BOT_NAMES[0])
        bot = Player(id=f'bot-{next(self._bot_ids)}', name=name, color=self._random_color(), is_bot=True)
        bot.cells = [self._new_cell(BOT_STARTING_SCORE)]
        self._set_bot_direction(bot)
        self.players[bot.id] = bot
        return bot

    def remove_player(self, player_id):
        self.players.pop(player_id, None)

    # Input

    def set_input(self, player_id, dx, dy):
        player = self.players.get(player_id)
        if player is None:
            return
        try:
            dx, dy = float(dx), float(dy)
            length = math.hypot(dx, dy)
        except (TypeError, ValueError):
            length = float('nan')
        if not math.isfinite(length) or length < 1e-6:
            player.direction = (0.0, 0.0)
        else:
            player.direction = (dx / length, dy / length)

    def split(self, player_id):
        player = self.players.get(player_id)
        now = self.clock()
        if player is None or player.direction == (0.0, 0.0) or now - player.last_split < SPLIT_COOLDOWN:
            return
        player.last_split = now
        dx, dy = player.direction
        for cell in [c for c in player.cells if c.score >= MIN_SPLIT_SCORE]:
            if len(player.cells) >= MAX_PLAYER_CELLS:
                break
            cell.score /= 2
            cell.vx = -dx * SPLIT_VELOCITY * 0.5
            cell.vy = -dy * SPLIT_VELOCITY * 0.5
            cell.split_time = now
            player.cells.append(Cell(
                x=cell.x, y=cell.y, score=cell.score,
                vx=dx * SPLIT_VELOCITY, vy=dy * SPLIT_VELOCITY, split_time=now,
            ))

    # Simulation

    def tick(self):
        """Advance the world one step. Returns ids of humans eaten this tick."""
        for player in self.players.values():
            if player.is_bot and self.rng.random() < 0.02:
                self._set_bot_direction(player)
            self._move(player)
            self._merge(player)
        self._handle_food()
        died = self._handle_player_collisions()
        self._respawn()
        return died

    def _move(self, player):
        dx, dy = player.direction
        for cell in player.cells:
            speed = 5 / (get_size(cell.score) / 20)
            cell.vx = cell.vx * 0.9 + dx * speed * 0.1
            cell.vy = cell.vy * 0.9 + dy * speed * 0.1
            cell.x = clamp(cell.x + cell.vx)
            cell.y = clamp(cell.y + cell.vy)

    def _merge(self, player):
        cells = player.cells
        if len(cells) < 2:
            return
        now = self.clock()
        absorbed = set()
        for i, j in itertools.combinations(range(len(cells)), 2):
            if i in absorbed or j in absorbed:
                continue
            a, b = cells[i], cells[j]
            distance = get_distance(a, b)
            min_distance = get_size(a.score) + get_size(b.score)
            can_merge = now - a.split_time > MERGE_COOLDOWN and now - b.split_time > MERGE_COOLDOWN
            dx, dy = b.x - a.x, b.y - a.y

            if can_merge and distance < min_distance * 0.5:
                total = a.score + b.score
                a.x = (a.x * a.score + b.x * b.score) / total
                a.y = (a.y * a.score + b.y * b.score) / total
                a.vx = (a.vx * a.score + b.vx * b.score) / total
                a.vy = (a.vy * a.score + b.vy * b.score) / total
                a.score = total
                a.split_time = 0.0
                absorbed.add(j)
                continue

            if can_merge and distance < min_distance * MERGE_DISTANCE:
                factor = MERGE_FORCE / max(1.0, distance)
            elif distance < min_distance:
                factor = -(min_distance - distance) / min_distance * REPULSION_STRENGTH
            else:
                factor = (MERGE_FORCE if can_merge else MERGE_START_FORCE) / max(1.0, distance)
            a.vx += dx * factor
            a.vy += dy * factor
            b.vx -= dx * factor
            b.vy -= dy * factor

        if absorbed:
            player.cells = [c for idx, c in enumerate(cells) if idx not in absorbed]

    def _handle_food(self):
        for player in self.players.values():
            for cell in player.cells:
                reach = get_size(cell.score) + FOOD_SIZE
                remaining = []
                for food in self.food:
                    if math.hypot(cell.x - food['x'], cell.y - food['y']) < reach:
                        cell.score += FOOD_SCORE
                    else:
                        remaining.append(food)
                self.food = remaining

    def _handle_player_collisions(self):
        owned = [(p, c) for p in self.players.values() for c in p.cells]
        eaten = set()
        for (pa, a), (pb, b) in itertools.combinations(owned, 2):
            if pa is pb or id(a) in eaten or id(b) in eaten:
                continue
            if get_distance(a, b) >= get_size(a.score) + get_size(b.score):
                continue
            size_a, size_b = get_size(a.score), get_size(b.score)
            if size_a > size_b * COLLISION_THRESHOLD:
                a.score += b.score + EAT_BONUS
                eaten.add(id(b))
            elif size_b > size_a * COLLISION_THRESHOLD:
                b.score += a.score + EAT_BONUS
                eaten.add(id(a))

        died = []
        for player in list(self.players.values()):
            player.cells = [c for c in player.cells if id(c) not in eaten]
            if not player.cells:
                self.remove_player(player.id)
                if not player.is_bot:
                    died.append(player.id)
        return died

    def _respawn(self):
        while len(self.food) < FOOD_COUNT:
            self.food.append({
                'x': self.rng.uniform(0, WORLD_SIZE),
                'y': self.rng.uniform(0, WORLD_SIZE),
                'color': f'hsl({self.rng.randrange(360)}, 50%, 50%)',
            })
        if not self.spawn_bots:
            return
        humans = sum(not p.is_bot for p in self.players.values())
        bots = [p for p in self.players.values() if p.is_bot]
        target = max(MIN_BOTS, TARGET_POPULATION - humans)
        for _ in range(target - len(bots)):
            self.add_bot()
        for bot in sorted(bots, key=lambda b: b.score)[:max(0, len(bots) - target)]:
            self.remove_player(bot.id)

    # Spawning helpers

    def _new_cell(self, score):
        x, y = self._safe_spawn_position()
        return Cell(x=x, y=y, score=score)

    def _safe_spawn_position(self, margin=100):
        cells = [c for p in self.players.values() for c in p.cells]
        best, best_gap = None, -math.inf
        for _ in range(50):
            x, y = self.rng.uniform(0, WORLD_SIZE), self.rng.uniform(0, WORLD_SIZE)
            gap = min((math.hypot(x - c.x, y - c.y) - get_size(c.score) for c in cells), default=math.inf)
            if gap >= margin:
                return x, y
            if gap > best_gap:
                best, best_gap = (x, y), gap
        return best

    def _set_bot_direction(self, bot):
        angle = self.rng.uniform(0, 2 * math.pi)
        bot.direction = (math.cos(angle), math.sin(angle))

    def _random_color(self):
        return f'hsl({self.rng.randrange(360)}, 70%, 50%)'

    # Serialization

    def snapshot(self):
        players = list(self.players.values())
        leaderboard = sorted(players, key=lambda p: p.score, reverse=True)[:LEADERBOARD_SIZE]
        return {
            'players': [
                {
                    'id': p.id,
                    'name': p.name,
                    'color': p.color,
                    'cells': [[round(c.x, 1), round(c.y, 1), round(c.score)] for c in p.cells],
                }
                for p in players
            ],
            'food': [[round(f['x'], 1), round(f['y'], 1), f['color']] for f in self.food],
            'leaderboard': [{'id': p.id, 'name': p.name, 'score': round(p.score)} for p in leaderboard],
        }
