# Devin Desktop Demo App

A demo application and tasks to demonstrate the power of [Devin Desktop](https://windsurf.com/).

The application comes pre-loaded with a variety of workflows that will give you hands-on experience with Devin Desktop basics.

Topics covered include: 
- Intro to Cascade
- Model Selection
- Cascade Modes (Code, Ask, and Plan Mode)
- Managing Conversations
- Editing with Cascade
- Adding Context
- Codemaps
- Deepwiki
- Terminal Usage
- Rules
- Workflows
- Use Case: Bug Fixing
- Use Case: Feature Development
- Advanced: Arena Mode *(optional)*
- Advanced: Cascade Hooks *(optional)*
- Advanced: CLI Tools *(optional)*
- Advanced: Git Worktrees *(optional)*

**To get started, simply clone the repo, open it in Devin Desktop, and type '/intro' into the Cascade input box!**

## Prerequisites

- Python 3.7 or higher
- Node.js and npm

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd devin-demo
```

2. Create and activate a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip3 install -r requirements.txt
```

4. Start the Flask server:
```bash
python3 app.py
```

5. Open your web browser and navigate to:
```
http://localhost:5000
```

6. Enter a name and play the game!

## Multiplayer

The game runs on a single shared world hosted by the Flask server (Flask-SocketIO over WebSockets). The server simulates everything (movement, splitting, collisions, bots) and broadcasts snapshots to every connected browser; the browser only renders and sends mouse direction / split input.

- **Play locally with friends:** open `http://localhost:5000` in several tabs, each with its own name.
- **Play over your LAN:** start the server with `HOST=0.0.0.0 python3 app.py` and have others open `http://<your-ip>:5000`.
- Bots fill the world when few humans are connected and make room as more people join.

Optional environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST` | `127.0.0.1` | Interface the server binds to |
| `PORT` | `5000` | Server port |
| `SECRET_KEY` | random per run | Flask secret key |
| `CORS_ALLOWED_ORIGINS` | same origin only | Comma-separated origins allowed to open a WebSocket |
| `FLASK_DEBUG` | off | Set to `1` for debug mode |

## Running Tests

```bash
pip3 install -r requirements-dev.txt
python3 -m pytest        # server game logic + socket events
npm test                 # client utilities and interpolation
```

### Browser regression test

The Playwright test opens a **visible Chromium window** (not headless) and
replays a left-click split against a local, deterministic multiplayer world.
Alice starts at 100 points; after splitting, a 50-point cell must eat a
49-point player named Bob. The test checks that Bob disappears and Alice
finishes with 249 points. It needs a desktop session with a graphical display.

```bash
pip3 install -r requirements-dev.txt
npm install
npx playwright install chromium
npm run test:e2e
```

Playwright starts and stops its own test server on `127.0.0.1:51237`. If your
Python environment is not in `venv/`, set `E2E_PYTHON` to its interpreter.
On failure, see `test-results/` for a screenshot and trace; inspect the trace
with `npx playwright show-trace <path-to-trace.zip>`. The test reproduces the
old bug when the server collision threshold is 1.1 and passes with the
strictly-greater-size rule.

## FAQ / Troubleshooting

**Q: I can't trigger a workflow like `/intro`**  
A: You may be in "Ask" mode instead of "Code" mode. Workflows can only be triggered in Code mode. Click the mode selector button at the bottom left of the Cascade input box and select "Code" mode, then try again.

**Q: I see "Model provider unreachable" error in Cascade**  
A: Close Devin Desktop completely and reopen it. You should be able to pick up where you left off in your training.
