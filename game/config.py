WORLD_SIZE = 2000
FOOD_SIZE = 5
STARTING_SCORE = 100
BOT_STARTING_SCORE = 50
FOOD_SCORE = 10
FOOD_COUNT = 100
EAT_BONUS = 100
COLLISION_THRESHOLD = 1.0  # Any strictly larger radius can consume another player

# Bots fill the world so it never feels empty; they make room as humans join
TARGET_POPULATION = 10
MIN_BOTS = 3

# Split mechanics
MIN_SPLIT_SCORE = 40
SPLIT_VELOCITY = 12
MAX_PLAYER_CELLS = 16
SPLIT_COOLDOWN = 0.25  # Seconds between accepted split requests (rate limit)

# Merge mechanics
MERGE_COOLDOWN = 10.0  # Seconds before split cells can merge
MERGE_DISTANCE = 2
MERGE_FORCE = 0.3
MERGE_START_FORCE = 0.1
REPULSION_STRENGTH = 0.3

# Physics constants are tuned per tick at 60 Hz (the original client frame rate)
TICK_RATE = 60
BROADCAST_RATE = 20

MAX_NAME_LENGTH = 16
DEFAULT_NAME = 'Player'
LEADERBOARD_SIZE = 5

BOT_NAMES = [
    'Cursor',
    'Zed',
    'VSCode',
    'Visual Studio',
    'Eclipse',
    'JetBrains',
    'XCode',
    'Sublime',
    'Neovim',
    'Emacs',
]
