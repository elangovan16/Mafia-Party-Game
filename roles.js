/* ================================================================
   roles.js – All game roles definitions
   ================================================================ */

const ROLES = {
  // ── TOWN ROLES ──────────────────────────────────────────────────
  villager: {
    id: 'villager',
    name: 'Villager',
    icon: '🏘️',
    team: 'town',
    color: '#10b981',
    description: 'An ordinary citizen trying to survive and identify the Mafia.',
    ability: 'No special ability. Vote during the day to eliminate suspects.',
    nightAction: null,
    maxPerGame: 8,
    minPlayers: 0,
    priority: 10,
    canSelfTarget: false,
  },

  detective: {
    id: 'detective',
    name: 'Detective',
    icon: '🔍',
    team: 'town',
    color: '#3b82f6',
    description: 'A skilled investigator who can uncover the truth each night.',
    ability: '🔍 Each night, investigate one player to learn if they are Town or Mafia.',
    nightAction: 'investigate',
    prompt: 'Choose a player to investigate',
    maxPerGame: 1,
    minPlayers: 0,
    priority: 3,
    canSelfTarget: false,
    note: 'Godfather appears innocent to you.',
  },

  doctor: {
    id: 'doctor',
    name: 'Doctor',
    icon: '🏥',
    team: 'town',
    color: '#14b8a6',
    description: 'A medic who can protect players from being killed at night.',
    ability: '💉 Each night, choose one player to protect. If they are attacked, they survive.',
    nightAction: 'heal',
    prompt: 'Choose a player to protect tonight',
    maxPerGame: 1,
    minPlayers: 0,
    priority: 4,
    canSelfTarget: true,
    selfHealLimit: 1,
    note: 'You can self-heal once per game.',
  },

  sheriff: {
    id: 'sheriff',
    name: 'Sheriff',
    icon: '⭐',
    team: 'town',
    color: '#f59e0b',
    description: 'A law officer with a gun who can shoot players during the day.',
    ability: '🔫 Once per game, shoot a player during the day. If they are Mafia, they die. If innocent, you die too.',
    nightAction: null,
    dayAction: 'shoot',
    maxPerGame: 1,
    minPlayers: 6,
    priority: 5,
    canSelfTarget: false,
  },

  mayor: {
    id: 'mayor',
    name: 'Mayor',
    icon: '🎖️',
    team: 'town',
    color: '#8b5cf6',
    description: 'The town leader whose vote carries extra weight.',
    ability: '📊 Your vote counts as 2 during day voting. Can reveal identity to gain +1 extra vote.',
    nightAction: null,
    maxPerGame: 1,
    minPlayers: 7,
    priority: 6,
    canSelfTarget: false,
    voteWeight: 2,
  },

  bodyguard: {
    id: 'bodyguard',
    name: 'Bodyguard',
    icon: '🛡️',
    team: 'town',
    color: '#64748b',
    description: 'A protector who will die to save someone else.',
    ability: '🛡️ Each night, protect one player. If they are attacked, you die instead of them.',
    nightAction: 'guard',
    prompt: 'Choose a player to guard tonight',
    maxPerGame: 1,
    minPlayers: 6,
    priority: 5,
    canSelfTarget: false,
  },

  vigilante: {
    id: 'vigilante',
    name: 'Vigilante',
    icon: '🏹',
    team: 'town',
    color: '#22d3ee',
    description: 'A town member who takes justice into their own hands.',
    ability: '🏹 Once per game, kill a player at night. If you kill an innocent, you die from guilt the next night.',
    nightAction: 'vigilante_kill',
    prompt: 'Choose a player to eliminate tonight',
    maxPerGame: 1,
    minPlayers: 7,
    priority: 7,
    canSelfTarget: false,
    usesLeft: 1,
  },

  escort: {
    id: 'escort',
    name: 'Escort',
    icon: '💃',
    team: 'town',
    color: '#ec4899',
    description: 'A charming distractor who can block someone\'s night action.',
    ability: '🚫 Each night, roleblock a player – they cannot use their ability that night.',
    nightAction: 'roleblock',
    prompt: 'Choose a player to roleblock tonight',
    maxPerGame: 1,
    minPlayers: 7,
    priority: 2,
    canSelfTarget: false,
  },

  spy: {
    id: 'spy',
    name: 'Spy',
    icon: '🕵️',
    team: 'town',
    color: '#a78bfa',
    description: 'A secret agent who watches the Mafia\'s moves.',
    ability: '👁️ Each night, see who the Mafia visited (but not what happened). Also learns who visited a bugged target.',
    nightAction: 'spy_watch',
    prompt: 'Choose a player to bug tonight',
    maxPerGame: 1,
    minPlayers: 8,
    priority: 3,
    canSelfTarget: false,
  },

  // ── MAFIA ROLES ─────────────────────────────────────────────────
  mafioso: {
    id: 'mafioso',
    name: 'Mafioso',
    icon: '🔪',
    team: 'mafia',
    color: '#ef4444',
    description: 'A Mafia soldier who carries out kills.',
    ability: '🌙 Each night, vote with your team to kill a Town member.',
    nightAction: 'mafia_kill',
    prompt: 'Choose a target to kill tonight',
    maxPerGame: 4,
    minPlayers: 0,
    priority: 8,
    canSelfTarget: false,
  },

  godfather: {
    id: 'godfather',
    name: 'Godfather',
    icon: '🎩',
    team: 'mafia',
    color: '#dc2626',
    description: 'The leader of the Mafia. Appears innocent to investigators.',
    ability: '🎩 Leads the Mafia. Appears as Town to the Detective. If the Mafioso dies, the Godfather takes the kill.',
    nightAction: 'mafia_kill',
    prompt: 'Choose a target to kill tonight',
    maxPerGame: 1,
    minPlayers: 0,
    priority: 9,
    canSelfTarget: false,
    appearsInnocent: true,
  },

  consort: {
    id: 'consort',
    name: 'Consort',
    icon: '🌹',
    team: 'mafia',
    color: '#f43f5e',
    description: 'A Mafia agent who roleblocks Town members at night.',
    ability: '🚫 Each night, roleblock a player – preventing their night action.',
    nightAction: 'roleblock',
    prompt: 'Choose a player to roleblock tonight',
    maxPerGame: 1,
    minPlayers: 7,
    priority: 2,
    canSelfTarget: false,
  },

  consigliere: {
    id: 'consigliere',
    name: 'Consigliere',
    icon: '📋',
    team: 'mafia',
    color: '#b91c1c',
    description: 'The Mafia\'s information gatherer – sees exact roles.',
    ability: '🔎 Each night, investigate a player and learn their exact role.',
    nightAction: 'consigliere_check',
    prompt: 'Choose a player to investigate',
    maxPerGame: 1,
    minPlayers: 8,
    priority: 3,
    canSelfTarget: false,
  },

  // ── NEUTRAL ROLES ───────────────────────────────────────────────
  jester: {
    id: 'jester',
    name: 'Jester',
    icon: '🃏',
    team: 'neutral',
    color: '#f6c90e',
    description: 'A fool who wins by getting the Town to vote them out.',
    ability: '🎭 Win by being voted out during the day. You lose if you survive until the end.',
    nightAction: null,
    maxPerGame: 1,
    minPlayers: 6,
    priority: 10,
    canSelfTarget: false,
    winCondition: 'voted_out',
  },

  serialKiller: {
    id: 'serialKiller',
    name: 'Serial Killer',
    icon: '🗡️',
    team: 'neutral',
    color: '#a855f7',
    description: 'A lone killer who must eliminate everyone else to win.',
    ability: '🗡️ Each night, kill one player. Win by being the last one standing. Immune to roleblocking.',
    nightAction: 'sk_kill',
    prompt: 'Choose a target to kill tonight',
    maxPerGame: 1,
    minPlayers: 8,
    priority: 7,
    canSelfTarget: false,
    winCondition: 'last_standing',
    immuneToRoleblock: true,
    immuneToKill: false,
  },

  executioner: {
    id: 'executioner',
    name: 'Executioner',
    icon: '⚔️',
    team: 'neutral',
    color: '#6366f1',
    description: 'Obsessed with getting a specific Town member lynched.',
    ability: '⚔️ Win by getting your assigned target voted out. If your target dies another way, you become a Jester.',
    nightAction: null,
    maxPerGame: 1,
    minPlayers: 7,
    priority: 10,
    canSelfTarget: false,
    winCondition: 'target_lynched',
  },

  survivor: {
    id: 'survivor',
    name: 'Survivor',
    icon: '🧲',
    team: 'neutral',
    color: '#84cc16',
    description: 'Just wants to survive until the end, whatever it takes.',
    ability: '🛡️ You have 4 bulletproof vests. Once per night, activate a vest to survive an attack.',
    nightAction: 'vest',
    prompt: 'Use bulletproof vest tonight? (Protects from one attack)',
    maxPerGame: 1,
    minPlayers: 0,
    priority: 10,
    canSelfTarget: true,
    winCondition: 'survive',
    vests: 4,
  },
};

// Role display order for UI
const ROLE_ORDER = [
  'villager', 'detective', 'doctor', 'sheriff', 'mayor',
  'bodyguard', 'vigilante', 'escort', 'spy',
  'mafioso', 'godfather', 'consort', 'consigliere',
  'jester', 'serialKiller', 'executioner', 'survivor'
];

// Recommended role presets by player count
const ROLE_PRESETS = {
  5:  { villager: 2, mafioso: 2, detective: 1 },
  6:  { villager: 2, mafioso: 2, detective: 1, doctor: 1 },
  7:  { villager: 2, mafioso: 2, detective: 1, doctor: 1, jester: 1 },
  8:  { villager: 2, mafioso: 3, detective: 1, doctor: 1, sheriff: 1 },
  9:  { villager: 2, mafioso: 3, detective: 1, doctor: 1, bodyguard: 1, jester: 1 },
  10: { villager: 2, mafioso: 3, detective: 1, doctor: 1, escort: 1, mayor: 1, jester: 1 },
  11: { villager: 2, mafioso: 3, consigliere: 1, detective: 1, doctor: 1, vigilante: 1, mayor: 1, jester: 1 },
  12: { villager: 2, mafioso: 3, consigliere: 1, detective: 1, doctor: 1, vigilante: 1, bodyguard: 1, mayor: 1, jester: 1 },
  13: { villager: 2, mafioso: 3, consort: 1, consigliere: 1, detective: 1, doctor: 1, vigilante: 1, escort: 1, sheriff: 1, jester: 1 },
  14: { villager: 3, mafioso: 3, consort: 1, consigliere: 1, detective: 1, doctor: 1, vigilante: 1, escort: 1, sheriff: 1, jester: 1 },
  15: { villager: 3, mafioso: 4, consigliere: 1, detective: 1, doctor: 1, vigilante: 1, bodyguard: 1, escort: 1, mayor: 1, serialKiller: 1, jester: 1 },
  16: { villager: 3, mafioso: 4, consigliere: 1, detective: 1, spy: 1, doctor: 1, vigilante: 1, bodyguard: 1, escort: 1, mayor: 1, serialKiller: 1, jester: 1 },
};

// Night action order (lower = acts earlier)
const NIGHT_ORDER = [
  'escort',      // roleblock first
  'consort',     // mafia roleblock
  'spy_watch',   // spy watches
  'godfather',   // mafia kill
  'mafioso',
  'consigliere_check',
  'serialKiller',
  'sk_kill',
  'doctor',      // heal
  'bodyguard',   // guard
  'vigilante_kill',
  'detective',   // investigate
  'investigate',
  'survivor',    // vest
  'vest',
];

function getRoleById(id) {
  return ROLES[id] || null;
}

function getRolesByTeam(team) {
  return Object.values(ROLES).filter(r => r.team === team);
}

function buildRoleDeck(config) {
  // config = { roleId: count, ... }
  const deck = [];
  for (const [roleId, count] of Object.entries(config)) {
    const role = ROLES[roleId];
    if (!role) continue;
    for (let i = 0; i < count; i++) {
      deck.push({ ...role });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getPresetForCount(count) {
  return ROLE_PRESETS[count] || ROLE_PRESETS[5];
}

// Game Settings Configuration
const SETTINGS_CONFIG = {
  dayTime: {
    id: 'day-time',
    label: 'Day Discussion Time',
    desc: 'Voting starts automatically when the timer ends (unless \'No limit\' is selected).',
    type: 'select',
    default: '120',
    options: [
      { value: '60', label: '1 min' },
      { value: '120', label: '2 min' },
      { value: '180', label: '3 min' },
      { value: '300', label: '5 min' },
      { value: '0', label: 'No limit' }
    ]
  },
  nightTime: {
    id: 'night-time',
    label: 'Night Action Time',
    desc: 'Actions are skipped automatically when the timer ends (unless \'No limit\' is selected).',
    type: 'select',
    default: '30',
    options: [
      { value: '20', label: '20 sec' },
      { value: '30', label: '30 sec' },
      { value: '45', label: '45 sec' },
      { value: '60', label: '1 min' },
      { value: '0', label: 'No limit' }
    ]
  },
  sheriffBadge: {
    id: 'sheriff-badge',
    label: 'Sheriff\'s Badge',
    desc: 'If enabled, Sheriff dies of guilt if they execute an innocent player.',
    type: 'toggle',
    default: true
  },
  lastWill: {
    id: 'last-will',
    label: 'Last Will',
    desc: 'Allows players to write a final note revealed upon their elimination.',
    type: 'toggle',
    default: false
  }
};

