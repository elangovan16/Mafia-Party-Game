/* ================================================================
   game.js – Core Game Engine
   Manages: state, phase transitions, night actions, voting, win detection
   ================================================================ */

const Game = (function () {
  // ── State ──────────────────────────────────────────────────────
  let state = {
    phase: 'lobby',         // lobby | roleReveal | night | day | vote | elimination | win
    round: 0,
    dayCount: 0,
    nightCount: 0,
    players: [],            // { id, name, peerId, role, alive, eliminated, lastWill, voteCount }
    settings: {},
    nightActions: {},       // { playerId: { type, target } }
    pendingNightResults: [], // results resolved after all actions
    votes: {},              // { voterId: targetId }
    nominatedPlayers: [],   // players with nominations
    mafiaTeamIds: [],       // peerId list of mafia players (only host knows)
    executionerTarget: null,
    vigilanteGuilt: false,
    selfHealUsed: false,
    survivorVests: 4,
    log: [],                // game event log
    winner: null,           // 'town' | 'mafia' | 'jester' | 'serialKiller' | 'executioner' | 'survivor'
    winnerPlayers: [],
    eliminatedThisNight: null,
    savedThisNight: null,
    roleRevealQueue: [],    // for passing device role reveal
    roleRevealIndex: 0,
    nightActionQueue: [],   // ordered queue of night actors
    nightQueueIndex: 0,
    currentNightActor: null,
  };

  // ── Helpers ────────────────────────────────────────────────────
  function getPlayer(id) {
    return state.players.find(p => p.id === id);
  }

  function getAlivePlayers() {
    return state.players.filter(p => p.alive);
  }

  function getMafiaPlayers() {
    return state.players.filter(p => ['mafioso', 'godfather', 'consort', 'consigliere'].includes(p.role.id) && p.alive);
  }

  function getTownPlayers() {
    return state.players.filter(p => p.role.team === 'town' && p.alive);
  }

  function getNeutralPlayers() {
    return state.players.filter(p => p.role.team === 'neutral' && p.alive);
  }

  function addLog(msg, important = false) {
    state.log.push({ msg, important, time: Date.now() });
    UI.appendLog(msg, important);
  }

  // ── Game Initialization ────────────────────────────────────────
  function initGame(players, settings, roleConfig) {
    // Build and shuffle role deck
    const deck = buildRoleDeck(roleConfig);
    shuffleDeck(deck);

    if (deck.length !== players.length) {
      console.error('Deck size mismatch', deck.length, players.length);
    }

    // Assign roles
    state.players = players.map((p, i) => ({
      ...p,
      role: deck[i] || ROLES.villager,
      alive: true,
      eliminated: false,
      lastWill: '',
      voteCount: 0,
      selfHealUsed: false,
      vests: deck[i]?.id === 'survivor' ? 4 : 0,
      vigilanteGuilt: false,
    }));

    // Find executioner target (must be a town player)
    const executioner = state.players.find(p => p.role.id === 'executioner');
    if (executioner) {
      const townPlayers = state.players.filter(p => p.role.team === 'town' && p.id !== executioner.id);
      if (townPlayers.length > 0) {
        state.executionerTarget = townPlayers[Math.floor(Math.random() * townPlayers.length)].id;
      }
    }

    state.settings = settings;
    state.phase = 'roleReveal';
    state.round = 0;
    state.dayCount = 0;
    state.nightCount = 0;
    state.log = [];
    state.roleRevealQueue = [...state.players];
    state.roleRevealIndex = 0;
    state.winner = null;
    state.winnerPlayers = [];

    console.log('[Game] Game initialized with', state.players.length, 'players');
    return state;
  }

  // ── Role Reveal Phase ──────────────────────────────────────────
  function getCurrentRevealPlayer() {
    return state.roleRevealQueue[state.roleRevealIndex] || null;
  }

  function nextRevealPlayer() {
    state.roleRevealIndex++;
    if (state.roleRevealIndex >= state.roleRevealQueue.length) {
      return null; // done
    }
    return state.roleRevealQueue[state.roleRevealIndex];
  }

  // ── Night Phase ────────────────────────────────────────────────
  function startNight() {
    state.phase = 'night';
    state.nightCount++;
    state.nightActions = {};
    state.pendingNightResults = [];
    state.eliminatedThisNight = null;
    state.savedThisNight = null;

    // Build night action queue from alive players with night actions
    state.nightActionQueue = [];

    // Group mafia kills as one team action
    const mafiaAll = state.players.filter(p => p.role.team === 'mafia');
    const mafiaAlive = getMafiaPlayers();
    if (mafiaAll.length > 0) {
      // Add godfather or first mafioso as representative
      const mafiaRep = mafiaAlive.find(p => p.role.id === 'godfather') || mafiaAlive[0] || mafiaAll[0];
      state.nightActionQueue.push({
        playerId: mafiaRep.id,
        actionType: 'mafia_kill',
        isTeamAction: true,
        teamMembers: mafiaAlive.map(p => p.id)
      });
    }

    // Individual roles with night actions (by priority)
    const roleActionOrder = ['escort', 'consort', 'framer', 'consigliere', 'serialKiller', 'arsonist', 'doctor', 'bodyguard', 'vigilante', 'rambo', 'detective', 'spy', 'survivor'];

    for (const roleId of roleActionOrder) {
      const player = state.players.find(p => p.role.id === roleId);
      if (player && player.role.nightAction) {
        state.nightActionQueue.push({
          playerId: player.id,
          actionType: player.role.nightAction,
          isTeamAction: false
        });
      }
    }

    state.nightQueueIndex = 0;
    state.currentNightActor = null;

    return state.nightActionQueue;
  }

  function getCurrentNightActor() {
    if (state.nightQueueIndex >= state.nightActionQueue.length) return null;
    return state.nightActionQueue[state.nightQueueIndex];
  }

  function submitNightAction(actorId, targetId, actionType, note = null) {
    state.nightActions[actorId] = { targetId, actionType, note };
    state.nightQueueIndex++;
  }

  function skipNightAction() {
    state.nightQueueIndex++;
  }

  function resolveNightActions() {
    const actions = state.nightActions;
    const results = {
      killed: null,
      saved: null,
      investigated: {},
      roleblocked: [],
      guarded: null,
      guardianDied: null,
      vigilanteKill: null,
      skKill: null,
      deathNotes: {}, // { playerId: "note text" }
    };

    // Step 1: Roleblocks (escort, consort)
    const roleblocked = new Set();
    for (const [actorId, action] of Object.entries(actions)) {
      if (action.actionType === 'roleblock') {
        const target = getPlayer(action.targetId);
        if (target && target.alive && !target.role.immuneToRoleblock) {
          roleblocked.add(action.targetId);
          results.roleblocked.push(action.targetId);
          addLog(`${getPlayer(actorId)?.name} roleblocked ${target.name}`, false);
        }
      }
    }

    // Step 2: Process Survivor vests
    const survivorPlayer = state.players.find(p => p.role.id === 'survivor' && p.alive);
    let survivorVested = false;
    if (survivorPlayer && actions[survivorPlayer.id]?.actionType === 'vest' && survivorPlayer.vests > 0) {
      survivorVested = true;
      survivorPlayer.vests--;
    }

    // Step 3: Mafia kill
    let mafiaKillTarget = null;
    let mafiaKillNote = null;
    for (const [actorId, action] of Object.entries(actions)) {
      if (action.actionType === 'mafia_kill' && !roleblocked.has(actorId)) {
        mafiaKillTarget = action.targetId;
        mafiaKillNote = action.note;
        break;
      }
    }

    // Step 4: Serial Killer
    let skKillTarget = null;
    let skKillNote = null;
    const skPlayer = state.players.find(p => p.role.id === 'serialKiller' && p.alive);
    if (skPlayer && actions[skPlayer.id]?.actionType === 'sk_kill') {
      skKillTarget = actions[skPlayer.id].targetId;
      skKillNote = actions[skPlayer.id].note;
    }

    // Step 5: Vigilante
    let vigilanteKillTarget = null;
    const vigPlayer = state.players.find(p => p.role.id === 'vigilante' && p.alive);
    if (vigPlayer && actions[vigPlayer.id]?.actionType === 'vigilante_kill' && !roleblocked.has(vigPlayer.id) && vigPlayer.role.usesLeft > 0) {
      vigilanteKillTarget = actions[vigPlayer.id].targetId;
      vigPlayer.role.usesLeft--;
    }

    // Step 5.5: Rambo
    let ramboKillTarget = null;
    const ramboPlayer = state.players.find(p => p.role.id === 'rambo' && p.alive);
    if (ramboPlayer && actions[ramboPlayer.id]?.actionType === 'rambo_kill' && !roleblocked.has(ramboPlayer.id) && ramboPlayer.role.usesLeft > 0) {
      ramboKillTarget = actions[ramboPlayer.id].targetId;
      ramboPlayer.role.usesLeft--;
    }
    
    // Step 5.6: Arsonist douse/ignite intention
    let arsonistIgnite = false;
    const arsonistPlayer = state.players.find(p => p.role.id === 'arsonist' && p.alive && !roleblocked.has(p.id));
    if (arsonistPlayer && actions[arsonistPlayer.id]?.actionType === 'arsonist_action') {
      if (actions[arsonistPlayer.id].targetId === arsonistPlayer.id) {
        arsonistIgnite = true;
      } else {
        const target = getPlayer(actions[arsonistPlayer.id].targetId);
        if (target && target.alive) target.doused = true;
      }
    }
    
    // Step 5.7: Framer intention
    const framedPlayers = new Set();
    const framerPlayer = state.players.find(p => p.role.id === 'framer' && p.alive && !roleblocked.has(p.id));
    if (framerPlayer && actions[framerPlayer.id]?.actionType === 'frame') {
      framedPlayers.add(actions[framerPlayer.id].targetId);
    }

    // Step 6: Doctor heal
    let healedTarget = null;
    const doctorPlayer = state.players.find(p => p.role.id === 'doctor' && p.alive);
    if (doctorPlayer && !roleblocked.has(doctorPlayer.id)) {
      const healAction = actions[doctorPlayer.id];
      if (healAction) {
        if (healAction.targetId === doctorPlayer.id) {
          if (!doctorPlayer.selfHealUsed) {
            healedTarget = doctorPlayer.id;
            doctorPlayer.selfHealUsed = true;
          }
        } else {
          healedTarget = healAction.targetId;
        }
      }
    }

    // Step 7: Bodyguard
    let guardedTarget = null;
    const bgPlayer = state.players.find(p => p.role.id === 'bodyguard' && p.alive);
    if (bgPlayer && !roleblocked.has(bgPlayer.id)) {
      const guardAction = actions[bgPlayer.id];
      if (guardAction) guardedTarget = guardAction.targetId;
    }

    // Step 8: Apply kills
    const casualties = [];

    // Mafia kill
    if (mafiaKillTarget) {
      const target = getPlayer(mafiaKillTarget);
      if (target && target.alive) {
        if (mafiaKillTarget === healedTarget) {
          results.saved = mafiaKillTarget;
          addLog(`🏥 ${target.name} was attacked but saved by the Doctor!`, true);
        } else if (mafiaKillTarget === guardedTarget) {
          results.guarded = mafiaKillTarget;
          if (bgPlayer) {
            bgPlayer.alive = false;
            bgPlayer.eliminated = true;
            results.guardianDied = bgPlayer.id;
            addLog(`🛡️ ${bgPlayer.name} (Bodyguard) died protecting ${target.name}!`, true);
          }
        } else if (mafiaKillTarget === survivorPlayer?.id && survivorVested) {
          addLog(`🧲 ${target.name} survived an attack with their bulletproof vest!`, true);
        } else {
          casualties.push({ playerId: mafiaKillTarget, cause: 'mafia_kill' });
          results.killed = mafiaKillTarget;
          if (mafiaKillNote) results.deathNotes[mafiaKillTarget] = mafiaKillNote;
        }
      }
    }

    // SK kill
    if (skKillTarget) {
      const target = getPlayer(skKillTarget);
      if (target && target.alive) {
        if (skKillTarget === healedTarget) {
          addLog(`🏥 ${target.name} was attacked by the Serial Killer but saved!`, true);
        } else {
          casualties.push({ playerId: skKillTarget, cause: 'sk_kill' });
          results.skKill = skKillTarget;
          if (skKillNote) results.deathNotes[skKillTarget] = skKillNote;
        }
      }
    }

    // Vigilante kill
    if (vigilanteKillTarget) {
      const target = getPlayer(vigilanteKillTarget);
      if (target && target.alive) {
        const isInnocent = target.role.team === 'town';
        casualties.push({ playerId: vigilanteKillTarget, cause: 'vigilante_kill' });
        results.vigilanteKill = vigilanteKillTarget;
        if (isInnocent && vigPlayer) {
          vigPlayer.vigilanteGuilt = true; // dies next night
          addLog(`⚠️ Vigilante shot an innocent – will die of guilt!`, true);
        }
      }
    }

    // Vigilante guilt death
    if (vigPlayer && vigPlayer.vigilanteGuilt) {
      casualties.push({ playerId: vigPlayer.id, cause: 'vigilante_guilt' });
      vigPlayer.vigilanteGuilt = false;
    }
    
    // Rambo kill
    if (ramboKillTarget) {
      const target = getPlayer(ramboKillTarget);
      if (target && target.alive) {
        casualties.push({ playerId: ramboKillTarget, cause: 'rambo_kill' });
        results.ramboKill = ramboKillTarget;
      }
    }
    
    // Arsonist ignite
    if (arsonistIgnite) {
      for (const p of state.players) {
        if (p.doused && p.alive && p.id !== arsonistPlayer?.id) {
           casualties.push({ playerId: p.id, cause: 'arsonist_ignite' });
           p.doused = false;
        }
      }
    }

    // Apply all casualties
    for (const c of casualties) {
      const p = getPlayer(c.playerId);
      if (p && p.alive) {
        p.alive = false;
        p.eliminated = true;
        p.eliminationCause = c.cause;
        addLog(`💀 ${p.name} was killed during the night.`, true);
      }
    }

    // Detective investigation
    const detPlayer = state.players.find(p => p.role.id === 'detective' && p.alive && !roleblocked.has(p.id));
    if (detPlayer && actions[detPlayer.id]) {
      const targetId = actions[detPlayer.id].targetId;
      const target = getPlayer(targetId);
      if (target) {
        let result = target.role.team;
        if (target.role.id === 'godfather') result = 'town'; // appears innocent
        if (target.role.id === 'serialKiller') result = 'mafia'; // appears suspicious
        if (framedPlayers.has(targetId)) result = 'mafia'; // framed
        results.investigated[detPlayer.id] = { targetId, result, targetName: target.name };
      }
    }

    // Consigliere check
    const consPlayer = state.players.find(p => p.role.id === 'consigliere' && p.alive && !roleblocked.has(p.id));
    if (consPlayer && actions[consPlayer.id]) {
      const targetId = actions[consPlayer.id].targetId;
      const target = getPlayer(targetId);
      if (target) {
        results.investigated[consPlayer.id] = { targetId, exactRole: target.role.name, targetName: target.name };
      }
    }

    state.pendingNightResults = results;
    return results;
  }

  // ── Day Phase ──────────────────────────────────────────────────
  function startDay() {
    state.phase = 'day';
    state.dayCount++;
    state.votes = {};
    state.nominatedPlayers = [];

    // Reset vote counts
    state.players.forEach(p => p.voteCount = 0);
  }

  function nominatePlayer(targetId) {
    if (!state.nominatedPlayers.includes(targetId)) {
      state.nominatedPlayers.push(targetId);
      const target = getPlayer(targetId);
      addLog(`${target?.name} has been nominated`, true);
    }
  }

  function castVote(voterId, targetId) {
    // Remove previous vote
    const prevVote = state.votes[voterId];
    if (prevVote) {
      const prevTarget = getPlayer(prevVote);
      if (prevTarget) prevTarget.voteCount--;
    }

    state.votes[voterId] = targetId;

    const voter = getPlayer(voterId);
    const target = getPlayer(targetId);

    // Mayor gets double vote
    const voteWeight = voter?.role.id === 'mayor' ? 2 : 1;
    if (target) {
      target.voteCount += voteWeight;
      addLog(`${voter?.name} voted for ${target.name}`, false);
    }

    return state.votes;
  }

  function abstainVote(voterId) {
    const prev = state.votes[voterId];
    if (prev) {
      const prevTarget = getPlayer(prev);
      if (prevTarget) prevTarget.voteCount--;
    }
    delete state.votes[voterId];
  }

  function resolveVote() {
    const alive = getAlivePlayers();
    let maxVotes = 0;
    let candidates = [];

    for (const p of alive) {
      if (p.voteCount > maxVotes) {
        maxVotes = p.voteCount;
        candidates = [p];
      } else if (p.voteCount === maxVotes && maxVotes > 0) {
        candidates.push(p);
      }
    }

    if (candidates.length === 0 || maxVotes === 0) {
      addLog('No consensus – no one is eliminated today.', true);
      return null;
    }

    if (candidates.length > 1) {
      addLog('It\'s a tie – no one is eliminated.', true);
      return null;
    }

    return candidates[0]; // eliminated player
  }

  function eliminatePlayer(playerId, cause = 'voted_out') {
    const player = getPlayer(playerId);
    if (!player || !player.alive) return;

    player.alive = false;
    player.eliminated = true;
    player.eliminationCause = cause;

    const causeMsgs = {
      voted_out: `⚖️ ${player.name} was voted out by the town.`,
      mafia_kill: `🔪 ${player.name} was killed by the Mafia.`,
      sk_kill: `🗡️ ${player.name} was killed by the Serial Killer.`,
      vigilante_kill: `🏹 ${player.name} was shot by the Vigilante.`,
      vigilante_guilt: `😔 ${player.name} (Vigilante) died of guilt.`,
      sheriff_shot: `⭐ ${player.name} was shot by the Sheriff.`,
      heartbreak: `💔 ${player.name} died of a broken heart.`,
      arsonist_ignite: `🔥 ${player.name} was incinerated by the Arsonist.`,
      rambo_kill: `💥 ${player.name} was blown away by Rambo.`,
      saint_retribution: `⚡ ${player.name} was struck down by divine retribution.`,
    };

    addLog(causeMsgs[cause] || `${player.name} was eliminated.`, true);

    // Trigger Lover death (Heartbreak)
    if (player.role.id === 'lover') {
      const otherLovers = state.players.filter(p => p.role.id === 'lover' && p.alive);
      for (const lover of otherLovers) {
        eliminatePlayer(lover.id, 'heartbreak');
      }
    }

    // Trigger Saint retribution
    if (player.role.id === 'saint' && cause === 'voted_out') {
      const voters = Object.entries(state.votes).filter(([voterId, targetId]) => targetId === playerId).map(([voterId]) => voterId);
      for (const voterId of voters) {
        eliminatePlayer(voterId, 'saint_retribution');
      }
    }

    // Jester win condition
    if (player.role.id === 'jester' && cause === 'voted_out') {
      state.winner = 'jester';
      state.winnerPlayers = [player];
    }

    // Executioner win condition
    if (state.executionerTarget === playerId && cause === 'voted_out') {
      const exec = state.players.find(p => p.role.id === 'executioner');
      if (exec && exec.alive) {
        state.winner = 'executioner';
        state.winnerPlayers = [exec];
      }
    }

    return player;
  }

  function sheriffShoot(shooterId, targetId) {
    const shooter = getPlayer(shooterId);
    const target  = getPlayer(targetId);
    if (!shooter || !target) return;

    if (target.role.team === 'mafia' || target.role.id === 'serialKiller') {
      eliminatePlayer(targetId, 'sheriff_shot');
      addLog(`⭐ Sheriff ${shooter.name} shot ${target.name} – it was the ${target.role.name}!`, true);
    } else {
      eliminatePlayer(targetId, 'sheriff_shot');
      eliminatePlayer(shooterId, 'sheriff_shot');
      addLog(`❌ ${target.name} was innocent! The Sheriff died too.`, true);
    }
  }

  // ── Win Detection ──────────────────────────────────────────────
  function checkWinCondition() {
    if (state.winner) return state.winner; // already won (jester, executioner)

    const alive = getAlivePlayers();
    const mafiaAlive = getMafiaPlayers().filter(p => p.alive);
    const townAlive  = alive.filter(p => p.role.team === 'town');
    const skAlive    = alive.filter(p => p.role.id === 'serialKiller');
    const neutralAlive = alive.filter(p => p.role.team === 'neutral' && p.role.id !== 'jester' && p.role.id !== 'executioner');

    // Serial Killer wins
    if (skAlive.length > 0 && mafiaAlive.length === 0 && townAlive.length === 0) {
      state.winner = 'serialKiller';
      state.winnerPlayers = skAlive;
      return 'serialKiller';
    }

    // Mafia wins (equal or outnumber town + neutral)
    const threat = mafiaAlive.length;
    const nonMafia = alive.filter(p => p.role.team !== 'mafia').length;
    if (threat >= nonMafia && alive.length > 0) {
      state.winner = 'mafia';
      state.winnerPlayers = mafiaAlive;
      return 'mafia';
    }

    // Town wins
    if (mafiaAlive.length === 0 && skAlive.length === 0) {
      // Check survivor
      const survivorWinner = alive.find(p => p.role.id === 'survivor');
      if (survivorWinner) {
        state.winner = 'survivor';
        state.winnerPlayers = [survivorWinner];
      } else {
        state.winner = 'town';
        state.winnerPlayers = townAlive;
      }
      return state.winner;
    }

    return null; // game continues
  }

  // ── Getters ────────────────────────────────────────────────────
  function getState()           { return state; }
  function getPlayers()         { return state.players; }
  function getPhase()           { return state.phase; }
  function getSettings()        { return state.settings; }
  function getNightResults()    { return state.pendingNightResults; }
  function getDayCount()        { return state.dayCount; }
  function getNightCount()      { return state.nightCount; }
  function getWinner()          { return state.winner; }
  function getWinnerPlayers()   { return state.winnerPlayers; }
  function getLog()             { return state.log; }

  function setPhase(p) { state.phase = p; }

  return {
    initGame,
    startNight, getCurrentNightActor, submitNightAction, skipNightAction, resolveNightActions,
    startDay, nominatePlayer, castVote, abstainVote, resolveVote,
    eliminatePlayer, sheriffShoot,
    checkWinCondition,
    getCurrentRevealPlayer, nextRevealPlayer,
    getPlayer, getAlivePlayers, getMafiaPlayers, getTownPlayers,
    getState, getPlayers, getPhase, getSettings, getNightResults,
    getDayCount, getNightCount, getWinner, getWinnerPlayers, getLog,
    setPhase, addLog
  };
})();
