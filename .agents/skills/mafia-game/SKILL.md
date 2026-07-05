---
name: mafia-game
description: >
  Deep knowledge of the Mafia Party Game project located at "D:\AI Test\Mafia Party Game".
  Activate this skill when the user asks to modify, extend, debug, or add features to this game.
  Covers architecture, file responsibilities, data flow, role system, multiplayer networking,
  game state machine, UI screen flow, and how to safely add new roles or features.
---

# Mafia Party Game — Agent Knowledge Base

## Project Location
```
D:\AI Test\Mafia Party Game\
```

## Technology Stack
- **Pure HTML + CSS + JavaScript** — No framework, no build step, no npm
- **PeerJS v1.5.1** — WebRTC peer-to-peer multiplayer (loaded from CDN)
- **QRCode.js** — QR code generation in lobby (loaded from CDN)
- **Google Fonts** — Cinzel (display), Inter (body), Playfair Display (accent)
- **PWA** — `manifest.json` enables "Add to Home Screen" on mobile

Opening `index.html` directly in any browser is all that's needed to run the game.
No server, no build, no install required.

---

## File Map & Responsibilities

### `index.html`
- Defines **all 11 game screens** as `<div class="screen">` elements
- Only one screen is visible at a time via the `.active` CSS class
- Screens (in order of game flow):
  1. `screen-loading` — splash/loading animation
  2. `screen-home` — main menu (Host, Join, Rules)
  3. `screen-setup` — host configures players, roles, and settings
  4. `screen-join` — join via room code
  5. `screen-lobby` — waiting room with room code + QR code
  6. `screen-role-reveal` — flip card per player to see role privately
  7. `screen-night` — night phase: action queue + action panel
  8. `screen-dawn` — transition: news of what happened overnight
  9. `screen-day` — discussion timer + nomination grid + vote tally
  10. `screen-vote` — full voting panel with candidates
  11. `screen-elimination` — shows eliminated player's role
  12. `screen-win` — winner announcement + confetti + all-roles reveal
  13. `screen-rules` — tabbed: How to Play | Roles | Winning | Tips

- Script load order matters:
  ```html
  <script src="roles.js">    <!-- must be first: ROLES, ROLE_ORDER, ROLE_PRESETS -->
  <script src="network.js">  <!-- second: Network object -->
  <script src="game.js">     <!-- third: Game engine (uses ROLES) -->
  <script src="ui.js">       <!-- last: UI controller (uses all above) -->
  ```

**Admin panel load order** (in `admin.html`):
  ```html
  <script src="roles.js">    <!-- same as above -->
  <script src="network.js">
  <script src="game.js">
  <script src="admin.js">    <!-- replaces ui.js; stubs window.UI -->
  ```

---

### `styles.css`
- **~1000 lines** of hand-crafted CSS with no framework
- CSS custom properties defined in `:root` — always use variables, never hardcode colors
- Key CSS variable names:
  ```css
  --bg-deep, --bg-dark, --bg-card, --bg-glass  /* backgrounds */
  --primary, --secondary                         /* pink-purple brand colors */
  --accent-red, --accent-gold, --accent-green    /* semantic accents */
  --text-primary, --text-secondary, --text-muted /* typography */
  --border, --border-bright                      /* borders */
  --radius-sm/md/lg/xl                           /* border radii */
  --font-display (Cinzel), --font-body (Inter)   /* typography */
  --transition                                   /* standard transition */
  ```
- Screen switching animation: `.screen` uses `opacity + transform`, `.screen.active` makes it visible
- Role team colors: `.team-town` (green), `.team-mafia` (red), `.team-neutral` (gold)
- Responsive breakpoints: `360px` (tiny phones), `600px` (tablets and up)

---

### `admin.html` + `admin.css` + `admin.js`
**Standalone developer/testing panel — open `admin.html` directly in a browser.**

Does NOT depend on `ui.js` or any DOM state from `index.html`.
On init, `admin.js` stubs `window.UI.appendLog` so `game.js` never crashes without the game DOM.

#### 6 Tabs:
| Tab ID | Purpose |
|--------|---------|
| `tab-setup` | Dummy player generator (name styles, counts, forced roles), manual add, role config grid, settings, launch |
| `tab-players` | Live player inspector: role, alive/dead, kill/revive/change-role per player, bulk actions |
| `tab-night` | Night action tester: submit any action type for any actor→target, view pending queue, resolve and see results |
| `tab-vote` | Vote tester: cast votes, view tally bars, resolve vote, direct elimination |
| `tab-roles` | Role browser: all roles with meta tags, filterable by team |
| `tab-log` | Timestamped event log, color-coded, exportable to .txt |

#### Key `Admin` API (public module returned from IIFE):
```js
// Tab & state
Admin.switchTab(id, btn)          // switches active tab
Admin.refreshState()              // updates sidebar state display

// Player queue (pre-game)
Admin.generatePlayers()           // reads gen-count/gen-style/gen-roles inputs, fills pendingPlayers[]
Admin.addPlayer()                 // reads add-name/add-role/add-ishost inputs
Admin.removePlayer(id)            // removes from pendingPlayers[]
Admin.clearPlayers()              // empties queue
Admin.launchGame()                // calls Game.initGame() with pendingPlayers + settings
Admin.quickStart(count)           // auto-generates N classic-name players and launches

// Phase controls
Admin.gotoNight()                 // sets state.phase = 'night'
Admin.gotoDay()                   // calls Game.startDay()
Admin.gotoVote()                  // sets state.phase = 'vote'
Admin.forceWin(team)              // shows win modal for 'town' or 'mafia'

// Live player manipulation
Admin.refreshPlayers()            // re-renders the player inspector grid
Admin.killPlayer(id)              // sets p.alive = false
Admin.revivePlayer(id)            // sets p.alive = true
Admin.changeRole(id, roleId)      // swaps p.role to ROLES[roleId]
Admin.killAll()                   // kills every player
Admin.reviveAll()                 // revives every player
Admin.shuffleRoles()              // Fisher-Yates shuffle of roles across players
Admin.inspectPlayer(id)           // shows modal with full player state
Admin.eliminatePlayer(id, cause)  // calls Game.eliminatePlayer()

// Night tester
Admin.submitNightAction()         // reads night-actor/night-action-type/night-target
Admin.resolveNight()              // calls Game.resolveNightActions(), renders results
Admin.clearNightActions()         // empties pendingNightActions[]

// Vote tester
Admin.castVote()                  // reads vote-voter/vote-target, calls Game.castVote()
Admin.resolveVote()               // calls Game.resolveVote()
Admin.clearVotes()                // empties adminVotes{}, resets voteCount on players

// Role browser
Admin.filterRoles(team, btn)      // shows/hides .role-card by data-team

// Log
Admin.clearLog()                  // empties event-log DOM + logEntries[]
Admin.exportLog()                 // downloads logEntries as .txt file
```

#### Name styles available:
```js
NAMES.classic   // Alice, Bob, Carol, Dave…
NAMES.medieval  // Arthur, Merlin, Lancelot…
NAMES.mystery   // Shadow, Ghost, Cipher…
NAMES.random    // Ajax, Blaze, Colt…
```

#### How to add a new admin feature:
1. Add the HTML element (select/button/div) to the relevant tab in `admin.html`
2. Add the handler function inside the `Admin` IIFE in `admin.js`
3. Return it from the public `return {}` at the bottom
4. Wire it via `onclick="Admin.myFunction()"` in the HTML

---

### `roles.js`
**This is the single source of truth for all game roles.**

#### Data Structure — each role object:
```js
ROLES.detective = {
  id:            'detective',   // unique string key — MUST match object key
  name:          'Detective',   // display name
  icon:          '🔍',          // emoji used everywhere
  team:          'town',        // 'town' | 'mafia' | 'neutral'
  color:         '#3b82f6',     // hex color for theming
  description:   '...',         // shown on role card back and rules screen
  ability:       '...',         // ability description (shown as gold text)
  nightAction:   'investigate', // string id of action, or null
  prompt:        '...',         // text shown to player during night action
  maxPerGame:    1,             // max copies of this role in one game
  minPlayers:    0,             // minimum players needed before this role is included
  priority:      3,             // lower = acts earlier in night queue
  canSelfTarget: false,         // can player target themselves?
  // Role-specific extras:
  note:          '...',         // optional footnote
  appearsInnocent: true,        // Godfather: shows as Town to Detective
  voteWeight:    2,             // Mayor: counts as 2 votes
  usesLeft:      1,             // Vigilante: limited uses
  immuneToRoleblock: true,      // Serial Killer: can't be blocked
  winCondition:  'last_standing', // Neutral roles: their win condition
  selfHealLimit: 1,             // Doctor: can self-heal once
  vests:         4,             // Survivor: bulletproof vest charges
}
```

#### Key exported globals (used by other files):
```js
ROLES         // Object map: roleId -> role object
ROLE_ORDER    // Array of roleIds in display order
ROLE_PRESETS  // Object map: playerCount -> { roleId: count }
```

#### Helper functions:
```js
getRoleById(id)           // returns role object or null
getRolesByTeam(team)      // returns array of roles for that team
buildRoleDeck(config)     // config = {roleId: count} -> shuffled array of role objects
shuffleDeck(deck)         // Fisher-Yates in-place shuffle
getPresetForCount(count)  // returns recommended role config for N players
```

#### How to add a new role:
1. Add the role object to the `ROLES` object in `roles.js`
2. Add its `id` to `ROLE_ORDER` array at the correct position
3. Add it to relevant player-count entries in `ROLE_PRESETS`
4. If it has a `nightAction`, handle it in `game.js` → `resolveNightActions()`
5. The setup screen and rules screen auto-populate from `ROLES` — no extra UI needed

---

### `game.js`
**The game engine — pure logic, no DOM manipulation.**

#### The `Game` module (IIFE, exposes public API):

**State object shape:**
```js
state = {
  phase: 'lobby',        // lobby|roleReveal|night|day|vote|elimination|win
  round: 0,
  dayCount: 0,
  nightCount: 0,
  players: [             // array of player objects
    {
      id,                // unique string
      name,              // display name
      peerId,            // PeerJS connection id (or 'host')
      role,              // full role object from roles.js
      alive,             // boolean
      eliminated,        // boolean
      lastWill,          // string (optional player message)
      voteCount,         // current day vote count
      selfHealUsed,      // Doctor flag
      vests,             // Survivor vest count
      vigilanteGuilt,    // Vigilante guilt flag
    }
  ],
  settings: {},          // from setup screen
  nightActions: {},      // { playerId: { targetId, actionType } }
  votes: {},             // { voterId: targetId }
  nominatedPlayers: [],  // playerIds nominated today
  nightActionQueue: [],  // ordered list of night actors
  nightQueueIndex: 0,
  winner: null,          // string or null
  winnerPlayers: [],
  log: [],               // { msg, important, time }
  executionerTarget: null,
}
```

**Game flow methods:**
```
initGame(players, settings, roleConfig)  → assigns roles, returns state
startNight()                             → builds nightActionQueue, returns it
getCurrentNightActor()                  → current entry in nightActionQueue
submitNightAction(actorId, targetId, actionType)
skipNightAction()
resolveNightActions()                   → applies all night actions, returns results object
startDay()                              → resets votes, increments dayCount
nominatePlayer(targetId)
castVote(voterId, targetId)             → handles voteWeight (Mayor = 2)
abstainVote(voterId)
resolveVote()                           → returns eliminated player or null
eliminatePlayer(playerId, cause)        → sets alive=false, checks Jester win
sheriffShoot(shooterId, targetId)       → handles innocence check
checkWinCondition()                     → returns winner string or null
```

**Night resolution order** (in `resolveNightActions`):
1. Roleblocks (Escort, Consort) — applied first, prevent other actions
2. Survivor vest activation
3. Mafia kill target locked in
4. Serial Killer kill target locked in
5. Vigilante kill target locked in
6. Doctor heal — cancels mafia kill if target matches
7. Bodyguard — intercepts mafia kill, bodyguard dies instead
8. All kills applied (casualties array)
9. Detective result computed (Godfather appears innocent)
10. Consigliere result computed (exact role)

---

### `network.js`
**P2P multiplayer layer — thin wrapper around PeerJS.**

```js
Network.init(onMessage)         // set message handler callback
Network.createRoom(callback)    // host: creates a peer with ID = `mafia-room-{CODE}`
Network.joinRoom(code, name, callback)  // client: connects to host peer
Network.send(peerId, data)      // send to specific peer
Network.broadcast(data, excludeId)     // send to all connected peers
Network.sendToHost(data)        // client sends to the host peer
Network.getRoomCode()           // returns the 6-char room code
Network.getIsHost()             // boolean
Network.disconnect()            // cleanup all connections
```

**Message types sent between host and clients:**
```
player_join          → client→host: new player joining lobby
lobby_update         → host→all: updated player list
game_start           → host→all: game beginning (no roles, just player list)
your_role            → host→individual: private role assignment
night_start          → host→all: night phase beginning
night_action_submitted → client→host: player submitted their night choice
day_start            → host→all: day phase beginning
nomination           → client→host: player nominated someone
nomination_update    → host→all: nominations so far
vote_cast            → client→host: player cast vote
vote_update          → host→all: updated vote tallies
elimination          → host→all: player eliminated
win                  → host→all: game over
```

**How room codes work:**
- Host creates a PeerJS peer with ID `mafia-room-ABCDEF`
- Clients connect to that peer ID using the 6-char code
- Codes are random uppercase alphanumeric (no ambiguous chars like 0/O, 1/I)
- If room code is already taken on PeerJS server, auto-regenerates

**Hotspot play:** Works because PeerJS uses STUN servers to establish WebRTC connections. On a local network, it works even without internet because the WebRTC ICE negotiation often succeeds locally.

---

### `ui.js`
**The UI controller — the "glue" that connects game logic to the DOM.**

#### Key global variables:
```js
currentScreen         // id of currently active screen
localPlayers          // array of players in lobby (host manages this)
gameRoleConfig        // { roleId: count } — the role setup chosen by host
gameSettings          // { dayTime, nightTime, sheriffBadge, lastWill, playerCount }
isOnlineMode          // boolean — true if PeerJS connected
myPlayerData          // { id, name, peerId, isHost } for this device's player
revealPlayers         // players queued for role reveal
revealIndex           // current index in role reveal sequence
nightActionQueue      // mirrors Game's nightActionQueue
nightQueueIdx         // current position in night action queue
selectedNightTarget   // currently selected target during night action
dayTimerInterval      // setInterval handle for day timer
nightTimerInterval    // setInterval handle for night timer
```

#### Key functions:
```js
showScreen(id)                // switches active screen with CSS transition
showToast(msg, type)          // bottom notification bubble (3s)
showModal({header, body, buttons})  // blocking modal dialog
beginRoleReveal(players)      // starts role card flip sequence
showCurrentReveal()           // shows card for revealPlayers[revealIndex]
startNightPhase()             // calls Game.startNight(), shows screen-night
processNextNightActor()       // advances through night action queue
showNightActionPanel(action, player)  // shows target selection UI
confirmNightAction()          // submits action and advances queue
finishNightPhase()            // calls Game.resolveNightActions(), shows dawn
showDawnScreen(results)       // parses night results into news items
showDayPhase()                // calls Game.startDay(), shows screen-day
triggerVote()                 // stops day timer, shows vote screen
showVoteScreen()              // populates candidates, waits for votes
showEliminationScreen(player, cause)
showWinScreen(winner)         // confetti + stats + all-roles reveal
launchConfetti(color)         // creates animated confetti pieces
buildSetupRoles()             // populates role toggle grid on setup screen
buildRulesRoles()             // populates role info cards on rules screen
filterRoles(team, btn)        // filters rules roles by team
handleNetworkMessage(peerId, data)  // routes incoming P2P messages
handleHostMessage(peerId, data)     // host-side message handling
handleClientMessage(peerId, data)   // client-side message handling
```

---

## Game State Machine

```
Loading
  ↓ (2.2s)
Home
  ├─→ Setup → createGame() → Lobby (host)
  ├─→ Join  → joinGame()  → Lobby (client)
  └─→ Rules (view only)

Lobby
  └─→ startGame() [host only]
        ↓
Role Reveal (each player flips card privately)
        ↓
Night Phase
  ├─ Night action queue processed one by one
  ├─ All actions resolved by host
  └─→ Dawn Screen (news of the night)
        ↓ (no win yet)
Day Phase (discussion timer)
  └─→ Vote Screen (call for vote)
        ↓
Elimination Screen (role revealed)
        ├─→ Win Screen (if game over)
        └─→ Night Phase (loop)
```

---

## Important Patterns & Gotchas

### Adding a new screen
1. Add `<div id="screen-xyz" class="screen">` in `index.html`
2. Call `showScreen('screen-xyz')` from `ui.js` at the right moment
3. Style it in `styles.css` with `#screen-xyz { background: ... }`

### Adding a new night action
1. Add `nightAction: 'my_action'` to the role in `roles.js`
2. In `game.js → resolveNightActions()`, handle `action.actionType === 'my_action'`
3. Add the role to the ordered array in `startNight()` so it gets queued

### Adding a new win condition
1. Add win condition check in `game.js → checkWinCondition()`
2. Add win display data to the `WIN_DATA` object in `ui.js`
3. Call `showWinScreen('myWinKey')` when condition triggers

### Role card color theming
Role cards automatically pick up the role's `color` property for border/background tint:
```js
roleBack.style.borderColor = role.color + '55';  // 33% opacity
roleBack.style.background  = `linear-gradient(135deg, #1a0f2e, ${role.color}22)`;
```

### Offline vs Online mode
- `isOnlineMode = false` → all game state lives on one device (pass-and-play)
- `isOnlineMode = true` → host is source of truth, clients send actions via PeerJS
- Most UI functions check `Network.getIsHost() || !isOnlineMode` before processing locally

### Night queue (offline mode)
In offline (pass-and-play) mode, ALL role actions are handled on one device.
The night queue shows each role's panel one by one, player passes device,
sees their role's action UI, submits, then passes back.

---

## Common Modifications

### Change default timer durations
Edit default `<option selected>` in `index.html` setup screen selects,
or change fallback values in `ui.js`: `gameSettings.dayTime || 120` and `gameSettings.nightTime || 30`.

### Change minimum players to start
In `ui.js → updateLobbyPlayers()`: `const canStart = count >= 5;`

### Add a role to the default preset for N players
Edit `ROLE_PRESETS` in `roles.js`.

### Change night action order
Edit the `roleActionOrder` array inside `game.js → startNight()`.

### Change the color palette
All colors are CSS variables in `:root` in `styles.css`. Change `--primary` and `--secondary` to retheme the whole game.

---

## External Dependencies (CDN, no install needed)
```html
PeerJS:    https://unpkg.com/peerjs@1.5.1/dist/peerjs.min.js
QRCode.js: https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
Fonts:     https://fonts.googleapis.com/css2?family=Cinzel...
```
All game features degrade gracefully if CDN fails (offline fonts, no QR code, no multiplayer → falls back to pass-and-play).

---

## Admin Panel Quick Reference

- **Entry point:** open `admin.html` directly in any browser
- **Access from game:** subtle `🛠️ Admin / Dev` link at bottom of home screen
- **No server / no build required** — same as the main game
- **Does NOT interfere** with `index.html` — completely separate HTML file
- The admin panel stubs `window.UI` on load so `game.js` never throws
- `pendingPlayers[]` = player queue before game starts; `Game.getPlayers()` = live players after launch
- `customRoleConfig = {}` means "use auto preset"; non-empty means exact role counts
- Night actions submitted via `Admin.submitNightAction()` are also forwarded to `Game.submitNightAction()` so `resolveNightActions()` sees them
- Votes submitted via `Admin.castVote()` are stored in both `adminVotes{}` (for tally UI) and `Game.castVote()` (for resolve)
- `Admin.eliminatePlayer(id, cause)` can be called from the Vote Tester tab dropdown OR directly from a player card button (passing the id argument)

