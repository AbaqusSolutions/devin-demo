import os
import secrets
import threading
import time

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

from game import World
from game.config import BROADCAST_RATE, TICK_RATE, WORLD_SIZE

MIN_INPUT_INTERVAL = 1 / 60  # Drop input events arriving faster than this per client

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or secrets.token_hex(32)

# Comma-separated list of allowed origins; defaults to same-origin only
allowed_origins = os.environ.get('CORS_ALLOWED_ORIGINS')
socketio = SocketIO(
    app,
    async_mode='threading',
    cors_allowed_origins=allowed_origins.split(',') if allowed_origins else None,
)

world = World()
world_lock = threading.Lock()
last_input = {}
loop_started = False
loop_lock = threading.Lock()


def game_loop():
    tick_interval = 1 / TICK_RATE
    broadcast_interval = 1 / BROADCAST_RATE
    next_tick = time.monotonic()
    next_broadcast = next_tick
    while True:
        with world_lock:
            died = world.tick()
            snapshot = world.snapshot() if time.monotonic() >= next_broadcast else None
        for player_id in died:
            socketio.emit('died', to=player_id)
        if snapshot is not None:
            socketio.emit('state', snapshot)
            next_broadcast += broadcast_interval
        next_tick += tick_interval
        socketio.sleep(max(0.0, next_tick - time.monotonic()))


def ensure_game_loop():
    global loop_started
    with loop_lock:
        if not loop_started:
            socketio.start_background_task(game_loop)
            loop_started = True


@app.route('/')
def index():
    return render_template('game.html')


@socketio.on('connect')
def on_connect():
    ensure_game_loop()


@socketio.on('join')
def on_join(data):
    name = data.get('name') if isinstance(data, dict) else None
    with world_lock:
        player = world.add_player(request.sid, name)
    emit('welcome', {'id': player.id, 'name': player.name, 'worldSize': WORLD_SIZE})


@socketio.on('input')
def on_input(data):
    now = time.monotonic()
    if not isinstance(data, dict) or now - last_input.get(request.sid, 0) < MIN_INPUT_INTERVAL:
        return
    last_input[request.sid] = now
    with world_lock:
        world.set_input(request.sid, data.get('dx'), data.get('dy'))


@socketio.on('split')
def on_split():
    with world_lock:
        world.split(request.sid)


@socketio.on('disconnect')
def on_disconnect(*_):
    last_input.pop(request.sid, None)
    with world_lock:
        world.remove_player(request.sid)


if __name__ == '__main__':
    socketio.run(
        app,
        host=os.environ.get('HOST', '127.0.0.1'),
        port=int(os.environ.get('PORT', 5000)),
        debug=os.environ.get('FLASK_DEBUG') == '1',
        allow_unsafe_werkzeug=True,
    )
