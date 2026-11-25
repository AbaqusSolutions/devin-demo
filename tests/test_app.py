import pytest

import app as server


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(server, 'ensure_game_loop', lambda: None)
    client = server.socketio.test_client(server.app)
    yield client
    if client.is_connected():
        client.disconnect()


def test_index_serves_game_page():
    response = server.app.test_client().get('/')
    assert response.status_code == 200
    assert b'gameCanvas' in response.data


def test_join_creates_player_with_sanitized_name(client):
    client.emit('join', {'name': '  <b>Alice</b>\n  '})
    welcome = next(e for e in client.get_received() if e['name'] == 'welcome')['args'][0]
    assert welcome['name'] == '<b>Alice</b>'
    assert welcome['id'] in server.world.players


def test_input_and_split_are_applied(client):
    client.emit('join', {'name': 'Bob'})
    player_id = client.get_received()[-1]['args'][0]['id']
    server.last_input.pop(player_id, None)
    client.emit('input', {'dx': 0, 'dy': 5})
    assert server.world.players[player_id].direction == (0.0, 1.0)
    client.emit('split')
    assert len(server.world.players[player_id].cells) == 2


def test_malformed_payloads_are_ignored(client):
    client.emit('join', 'not-a-dict')
    player_id = client.get_received()[-1]['args'][0]['id']
    server.last_input.pop(player_id, None)
    client.emit('input', ['garbage'])
    assert server.world.players[player_id].direction == (0.0, 0.0)


def test_disconnect_removes_player(client):
    client.emit('join', {'name': 'Carol'})
    player_id = client.get_received()[-1]['args'][0]['id']
    client.disconnect()
    assert player_id not in server.world.players
