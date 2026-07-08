const fs = require('fs');
const lines = fs.readFileSync('ui.js', 'utf8').split('\n');

const core = [
  ...lines.slice(0, 139),
  ...lines.slice(2003, 2044),
  ...lines.slice(2226, 2242),
  ...lines.slice(2242)
];

const setup = lines.slice(139, 680);
const lobby = [
  ...lines.slice(680, 832),
  ...lines.slice(920, 1145)
];

const network = [
  ...lines.slice(832, 920),
  ...lines.slice(2044, 2226)
];

const game = lines.slice(1145, 2003);

fs.writeFileSync('js/ui/core.js', core.join('\n'));
fs.writeFileSync('js/ui/setup.js', setup.join('\n'));
fs.writeFileSync('js/ui/lobby.js', lobby.join('\n'));
fs.writeFileSync('js/ui/network_handler.js', network.join('\n'));
fs.writeFileSync('js/ui/game.js', game.join('\n'));

console.log('Split successful');
