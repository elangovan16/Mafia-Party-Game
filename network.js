/* ================================================================
   network.js – P2P Multiplayer via PeerJS
   Supports: hotspot play, online play via shared room code
   ================================================================ */

const Network = (function () {
  let peer = null;
  let connections = {}; // peerId -> DataConnection
  let roomCode = null;
  let isHost = false;
  let myPeerId = null;
  let onMessageCallback = null;

  const PEER_CONFIG = {
    // Uses PeerJS public cloud server for signaling
    // Works across internet AND on local hotspot networks
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function roomCodeToPeerId(code) {
    return `mafia-room-${code.toUpperCase()}`;
  }

  function init(onMessage) {
    onMessageCallback = onMessage;
  }

  function createRoom(callback) {
    isHost = true;
    roomCode = generateRoomCode();
    const peerId = roomCodeToPeerId(roomCode);

    peer = new Peer(peerId, PEER_CONFIG);

    peer.on('open', (id) => {
      myPeerId = id;
      console.log('[Network] Host peer opened:', id);
      callback({ success: true, roomCode });
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('[Network] Peer error:', err);
      if (err.type === 'unavailable-id') {
        // Room code taken, generate new one
        roomCode = generateRoomCode();
        peer.destroy();
        createRoom(callback);
      } else {
        callback({ success: false, error: err.message });
      }
    });

    peer.on('disconnected', () => {
      console.warn('[Network] Peer disconnected, attempting reconnect...');
      try { peer.reconnect(); } catch(e) {}
    });
  }

  function joinRoom(code, playerName, callback) {
    isHost = false;
    roomCode = code.toUpperCase();
    const hostPeerId = roomCodeToPeerId(roomCode);

    peer = new Peer(PEER_CONFIG);

    peer.on('open', (id) => {
      myPeerId = id;
      console.log('[Network] Client peer opened:', id);

      const conn = peer.connect(hostPeerId, {
        reliable: true,
        metadata: { name: playerName }
      });

      conn.on('open', () => {
        setupConnection(conn);
        callback({ success: true });
      });

      conn.on('error', (err) => {
        callback({ success: false, error: 'Could not connect to room.' });
      });
    });

    peer.on('error', (err) => {
      let msg = 'Connection error.';
      if (err.type === 'peer-unavailable') msg = 'Room not found. Check the code!';
      callback({ success: false, error: msg });
    });
  }

  function setupConnection(conn) {
    const peerId = conn.peer;
    connections[peerId] = conn;

    conn.on('data', (data) => {
      if (onMessageCallback) onMessageCallback(peerId, data);
    });

    conn.on('close', () => {
      delete connections[peerId];
      if (onMessageCallback) onMessageCallback(peerId, { type: 'player_left' });
    });

    conn.on('error', (err) => {
      console.error('[Network] Conn error:', err);
    });
  }

  function send(peerId, data) {
    const conn = connections[peerId];
    if (conn && conn.open) {
      conn.send(data);
    }
  }

  function broadcast(data, excludeId = null) {
    for (const [peerId, conn] of Object.entries(connections)) {
      if (peerId !== excludeId && conn.open) {
        conn.send(data);
      }
    }
  }

  function sendToHost(data) {
    // Client sends to host (first/only connection)
    const peers = Object.keys(connections);
    if (peers.length > 0) {
      send(peers[0], data);
    }
  }

  function getConnectedPeers() {
    return Object.keys(connections);
  }

  function getRoomCode() { return roomCode; }
  function getIsHost()   { return isHost; }
  function getMyPeerId() { return myPeerId; }

  function disconnect() {
    for (const conn of Object.values(connections)) {
      try { conn.close(); } catch(e) {}
    }
    connections = {};
    if (peer) {
      try { peer.destroy(); } catch(e) {}
      peer = null;
    }
    roomCode = null;
    isHost = false;
  }

  return {
    init, createRoom, joinRoom,
    send, broadcast, sendToHost,
    getConnectedPeers, getRoomCode,
    getIsHost, getMyPeerId, disconnect
  };
})();
