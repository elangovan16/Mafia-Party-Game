# 🎭 MAFIA — The Party Game

> A dark, beautiful, feature-rich party game built for the browser.  
> Play with friends online, over hotspot, or pass one device around the room.

![Game Banner](https://img.shields.io/badge/Platform-Web%20%7C%20Android%20%7C%20iOS%20%7C%20Windows%20%7C%20Linux-blueviolet?style=for-the-badge)
![No Install](https://img.shields.io/badge/No%20Install-Just%20Open%20index.html-success?style=for-the-badge)
![Multiplayer](https://img.shields.io/badge/Multiplayer-P2P%20WebRTC-orange?style=for-the-badge)
![Roles](https://img.shields.io/badge/Roles-17%20Unique-red?style=for-the-badge)

---

## 📖 What Is Mafia?

Mafia is a classic social deduction party game. Players are secretly assigned roles — some are innocent **Townspeople**, and some are **Mafia**. The game alternates between:

- 🌙 **Night** — the Mafia secretly eliminates a Townsperson (and other special roles act)
- ☀️ **Day** — everyone discusses, accuses, and votes to eliminate a suspect

The Town wins by eliminating all Mafia. The Mafia wins by gaining majority control. Neutral roles have their own secret win conditions.

---

## ✨ Features

- 🎭 **17 unique roles** across Town, Mafia, and Neutral factions
- 🌐 **Real-time multiplayer** — play online OR over a local WiFi/hotspot
- 📱 **Works on any device** — Android, iPhone, Windows, Linux, Mac — just open in a browser
- 🃏 **Private role reveal** — flip-card animation, pass device around
- ⏱️ **Day timer & night timer** — configurable per game
- 🗳️ **Voting system** — nominations, tally bar, Mayor double-vote
- 💀 **Role reveal on elimination** — see the truth when someone dies
- 🏆 **5 different win conditions** — Town, Mafia, Jester, Serial Killer, and more
- 🎆 **Confetti win screen** — full role reveal for all players at end
- 📜 **Rules & Roles** tab — in-game reference with filters
- 📋 **QR Code** in lobby — scan to join instantly
- 📲 **PWA ready** — can be installed on phones like a native app
- 🛠️ **Admin / Dev Panel** (`admin.html`) — dummy player generator, live game inspector, night/vote tester, role browser

---

## 🚀 How to Play

### Option 1 — One Device (Pass-and-Play)
> Best for: a group sitting together with one phone/laptop

1. Open `index.html` in any browser
2. Click **Host a Game**
3. Enter names for all players when prompted
4. Pass the device around — each player **taps to flip** their secret role card
5. Play using the on-screen prompts for Night and Day phases

---

### Option 2 — Hotspot / Local WiFi
> Best for: everyone in the same room, each with their own device

1. **Host:** Turn on Mobile Hotspot (or use your home WiFi)
2. **All players:** Connect to the same WiFi/hotspot
3. **Host:** Open `index.html` → click **Host a Game** → note the **6-digit Room Code**
4. **Other players:** Open `index.html` on their device → click **Join Game** → enter the code
5. Once everyone joins, host clicks **Start Game**
6. Each player sees their own role on their own screen — no passing needed!

---

### Option 3 — Online (Internet)
> Best for: playing with people in different locations

Same as Option 2, but players don't need to be on the same network.  
The game uses **WebRTC peer-to-peer** connections via PeerJS — no server costs, no account needed.

---

## 🎭 All 17 Roles

### 🏘️ Town (good guys)

| Role | Icon | Ability |
|------|------|---------|
| **Villager** | 🏘️ | No special power — but your vote matters! |
| **Detective** | 🔍 | Investigate one player each night — learn if they're Town or Mafia |
| **Doctor** | 🏥 | Protect one player each night from being killed (1 self-heal allowed) |
| **Sheriff** | ⭐ | Once per game: shoot a player. If Mafia → they die. If innocent → you both die |
| **Mayor** | 🎖️ | Your vote counts as 2 during day voting |
| **Bodyguard** | 🛡️ | Choose someone to guard — if they're attacked, you die instead |
| **Vigilante** | 🏹 | Shoot one player at night. If innocent, you die from guilt next night |
| **Escort** | 💃 | Roleblock a player — they cannot use their night ability |
| **Spy** | 🕵️ | See who the Mafia visits each night |

### 🔪 Mafia (bad guys)

| Role | Icon | Ability |
|------|------|---------|
| **Mafioso** | 🔪 | Votes with the team to kill a Town player each night |
| **Godfather** | 🎩 | Mafia leader — **appears innocent** to the Detective |
| **Consort** | 🌹 | Roleblocks a Town player at night |
| **Consigliere** | 📋 | Investigates a player and learns their **exact role** |

### ⚖️ Neutral (wildcard)

| Role | Icon | Win Condition |
|------|------|--------------|
| **Jester** | 🃏 | **Win by getting voted out** by the Town — fool them! |
| **Serial Killer** | 🗡️ | Kill one player each night — win by being the **last one standing** |
| **Executioner** | ⚔️ | Get your **assigned target lynched** — if they die another way, become a Jester |
| **Survivor** | 🧲 | Just **survive to the end** — has 4 bulletproof vests to block attacks |

---

## 🏆 Win Conditions

| Faction | Wins When... |
|---------|-------------|
| **Town** | All Mafia members and Serial Killers are eliminated |
| **Mafia** | Mafia equals or outnumbers the rest of the players |
| **Jester** | The Jester is voted out during the day |
| **Serial Killer** | The Serial Killer is the last player alive |
| **Executioner** | Their secret target is voted out by the Town |
| **Survivor** | They are still alive when the game ends |

---

## ⚙️ Game Settings

Configurable before each game:

| Setting | Options |
|---------|---------|
| Number of Players | 5 – 16 |
| Day Discussion Time | 1 min / 2 min / 3 min / 5 min / No limit |
| Night Action Time | 20s / 30s / 45s / 1 min |
| Sheriff's Badge | Enable/disable the Sheriff role's shoot ability |
| Last Will | Players can leave a final message shown upon elimination |

Roles are **auto-suggested** based on player count, but you can toggle any role on/off.

---

## 📁 Project Structure

```
Mafia Party Game/
│
├── index.html        ← All game screens (HTML structure only)
├── styles.css        ← Complete visual design (~1000 lines, no framework)
├── roles.js          ← All 17 role definitions + presets + deck builder
├── game.js           ← Game engine: state, night resolution, voting, win detection
├── network.js        ← P2P multiplayer layer (PeerJS/WebRTC wrapper)
├── ui.js             ← UI controller: screen switching, timers, events
│
├── admin.html        ← Admin / Developer testing panel
├── admin.css         ← Admin panel styles (dark purple theme)
├── admin.js          ← Admin panel logic (dummy players, game inspector, testers)
│
├── manifest.json     ← PWA manifest (install on phone like native app)
├── README.md         ← This file
│
└── .agents/
    └── skills/
        └── mafia-game/
            └── SKILL.md   ← AI agent knowledge base for this project
```

---

## 🧱 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│                                                             │
│  ┌─────────┐   reads    ┌──────────────────────────────┐   │
│  │ roles.js│──────────►│           game.js             │   │
│  │ (data)  │           │   (pure logic, no DOM)        │   │
│  └─────────┘           │   - state machine             │   │
│                         │   - night resolution          │   │
│  ┌──────────┐ calls    │   - vote resolution           │   │
│  │network.js│◄────────►│   - win detection             │   │
│  │ (PeerJS) │           └──────────────┬───────────────┘   │
│  └──────────┘                          │ updates            │
│                                         ▼                   │
│                         ┌──────────────────────────────┐   │
│  ┌──────────┐ modifies │           ui.js               │   │
│  │index.html│◄─────────│   (screen manager + events)  │   │
│  │ (screens)│          │   - showScreen()              │   │
│  └──────────┘          │   - night queue UI            │   │
│                         │   - timers + toasts + modal   │   │
│  ┌──────────┐ styles   └──────────────────────────────┘   │
│  │styles.css│──────────► all screens                       │
│  └──────────┘                                              │
└─────────────────────────────────────────────────────────────┘
```

### How Multiplayer Works

```
Host Device                            Client Devices
──────────                             ──────────────
createRoom()                           joinRoom(code)
  │                                         │
  │ PeerJS signaling server (cloud)         │
  │◄────────────────────────────────────────►│
  │                                         │
  │ WebRTC direct P2P connection            │
  │◄────────────────────────────────────────►│
  │                                         │
  │  ← player_join (name)                   │
  │  → lobby_update (player list)           │
  │  → game_start + your_role (private)     │
  │                                         │
  │  ← night_action_submitted               │
  │  → elimination, win, vote_update        │
```

- The **host is the game master** — holds all state, resolves all night actions
- **Clients receive only what they need** — their own role is sent privately
- Works on **local hotspot** (same WiFi) and **across the internet**

---

## 📱 Installing as an App (PWA)

On **Android (Chrome)**:
1. Open the game in Chrome
2. Tap the three-dot menu → **"Add to Home Screen"**
3. The game installs and opens like a native app

On **iPhone (Safari)**:
1. Open the game in Safari
2. Tap the **Share** button → **"Add to Home Screen"**
3. Done!

On **Windows (Chrome/Edge)**:
1. Open the game in the browser
2. Click the install icon (⊕) in the address bar

---

## 🧩 Extending the Game

### Adding a New Role
1. Add a new entry to the `ROLES` object in `roles.js`
2. Add the role's `id` to the `ROLE_ORDER` array
3. Add it to relevant entries in `ROLE_PRESETS`
4. If the role has a night action, handle it in `game.js → resolveNightActions()`
5. The UI auto-discovers it — no extra HTML or CSS needed

### Adding a New Screen
1. Add `<div id="screen-xyz" class="screen">` in `index.html`
2. Call `showScreen('screen-xyz')` from `ui.js`
3. Style it in `styles.css`

### Changing Colors
All colors are CSS variables in `styles.css` → `:root`:
```css
--primary:   #c62a88;  /* main pink */
--secondary: #7c3aed;  /* purple */
```
Change these two to completely retheme the game.

---

## 🛠️ Admin / Developer Panel

Open `admin.html` directly in a browser (or click **🛠️ Admin / Dev** on the home screen).

> **No server needed** — the admin panel uses the same `roles.js` / `game.js` / `network.js` files as the main game. It stubs out the DOM-dependent `UI.appendLog` so `game.js` runs cleanly in isolation.

### Features

| Tab | What it does |
|-----|--------------|
| **👥 Player Setup** | Generate 1–16 dummy players (Classic / Medieval / Mystery / Random names), add individual players with optional forced roles, configure exact role counts, set game settings (timers, badges), launch a full game |
| **🎭 Live Players** | Inspect every player's role, team, alive/dead status, kill/revive individuals, bulk kill/revive all, shuffle roles randomly, change a player's role mid-game via dropdown |
| **🌙 Night Tester** | Submit any night action (Mafia kill, Investigate, Heal, Roleblock, SK Kill, Guard, Consigliere, Vigilante) for any actor → target pair, view pending queue, resolve night and see results |
| **⚖️ Vote Tester** | Cast votes between any players, view live tally bars, resolve vote to eliminate, or directly eliminate any player with a custom cause |
| **📖 Role Browser** | All 17 roles with icon, description, ability, team badge, and meta tags (priority, night action, max count) — filterable by team |
| **📋 Event Log** | Timestamped, color-coded log of every admin action and game event — exportable to `.txt` |

### Sidebar Quick Actions
- **▶ 5 / 8 / 12-Player Game** — one-click game launch with auto-generated dummy players
- **Force Night / Day / Vote** — jump to any game phase instantly
- **Force Town Win / Mafia Win** — trigger end-game screen for testing
- **Live state display** — phase, round, day count, night count, alive/dead counts

---

## 🛠️ Tech Stack

| Technology | Why |
|-----------|-----|
| Vanilla HTML/CSS/JS | Zero build step — just open the file |
| PeerJS (WebRTC) | Real-time P2P without a backend server |
| CSS Custom Properties | Consistent, themeable design system |
| CSS Animations | Smooth transitions, confetti, flip cards |
| QRCode.js | Instant QR code for easy room joining |
| Google Fonts | Premium typography (Cinzel + Inter) |
| PWA Manifest | Installable on mobile like a native app |

---

## 🌐 Browser Compatibility

| Browser | Works? |
|---------|--------|
| Chrome (Android, Desktop) | ✅ Full support |
| Safari (iPhone, iPad, Mac) | ✅ Full support |
| Firefox | ✅ Full support |
| Edge | ✅ Full support |
| Samsung Internet | ✅ Full support |

> ⚠️ **Note:** Multiplayer requires internet access to connect via PeerJS signaling servers.  
> Once connected over the same hotspot, the game continues even if internet drops.

---

## 📝 License

Feel free to use, fork, and modify this project.  
If you build something cool on top of it, a credit would be appreciated! 🎭

---

## 🙏 Credits

- Game concept: **Mafia** (originally by Dmitry Davidoff, 1986)
- Built with ❤️ using Antigravity AI coding assistant
- PeerJS for making WebRTC accessible
- Google Fonts for beautiful typography
