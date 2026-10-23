// TailsConnect multiplayer transport. All multiplayer UI is owned by the GameScene
// under the menu label "TailsConnect".
class TailsConnectClient {
  constructor(scene) {
    this.scene = scene;
    this.socket = null;
    this.heartbeatTimer = null;
    this.disconnectTimer = null;
    this.lastPeerMessage = 0;
    this.onMessage = null;
    this.onStatus = null;
    this.requestCounter = 0;
    this.pendingAcks = new Map();
    this.clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  _status(text) { if (this.onStatus) this.onStatus(text); }

  connect(mode = "matchmake", room = "") {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
      this.socket = null;
    }
    this._status("Connecting to TailsConnect...");
    this.socket = new WebSocket("wss://tails1154.com:9842");
    const connectingSocket = this.socket;
    const connectTimeout = setTimeout(() => {
      if (this.socket === connectingSocket && connectingSocket.readyState === WebSocket.CONNECTING) {
        connectingSocket.close();
        this._status("TailsConnect timed out");
      }
    }, 10000);
    this.socket.onopen = () => {
      clearTimeout(connectTimeout);
      if (mode === "host") {
        this.role = "host";
        this._status("Hosting a TailsConnect room...");
        this.socket.send("HOST WebDashersVersus,2");
      } else if (mode === "join") {
        this.role = "join";
        this._status("Joining TailsConnect room...");
        this.socket.send(`JOIN WebDashersVersus,${room.trim().toUpperCase()}`);
      } else {
        this._status("Searching for an opponent...");
        this.socket.send("MATCHMAKE WebDashersVersus,2");
      }
    };
    this.socket.onmessage = event => {
      const message = String(event.data || "");
      if (message === "P2P") {
        this.lastPeerMessage = Date.now();
        this._status("Opponent connected");
        this._startHeartbeat();
        return;
      }
      if (message.startsWith("ROOM ")) {
        this.room = message.slice(5);
        this._status(this.role === "host" ? `Room code: ${this.room} — waiting for player 2` : `Connected to room ${this.room}`);
        return;
      }
      this.lastPeerMessage = Date.now();
      try {
        const payload = JSON.parse(message);
        if (payload.type === "ACK") {
          const pending = this.pendingAcks.get(payload.ack);
          if (pending) { clearTimeout(pending.timer); this.pendingAcks.delete(payload.ack); }
          return;
        }
        if (payload.requestId && payload.type !== "heartbeat") {
          this._sendRaw({ type: "ACK", ack: payload.requestId });
        }
        if (payload.type === "versus-hello") this.lastHello = payload;
        this.onMessage?.(payload);
      } catch (_) { /* non-game relay data */ }
    };
    this.socket.onerror = () => this._status("TailsConnect connection failed");
    this.socket.onclose = () => {
      this._stopHeartbeat();
      this._status("Opponent disconnected");
    };
  }

  send(payload) {
    if (this.socket?.readyState !== WebSocket.OPEN) return null;
    const requestId = `tc-${Date.now()}-${++this.requestCounter}`;
    const request = { ...payload, requestId };
    this._sendRaw(request);
    const timer = setTimeout(() => this.pendingAcks.delete(requestId), 5000);
    this.pendingAcks.set(requestId, { timer });
    return requestId;
  }

  _sendRaw(payload) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.lastPeerMessage = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: "heartbeat", at: Date.now() }));
      if (Date.now() - this.lastPeerMessage > 9000) {
        this._status("Opponent timed out");
        this.close();
      }
    }, 3000);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  close() {
    this._stopHeartbeat();
    if (this.socket) this.socket.close();
    this.socket = null;
  }
}
window.TailsConnectClient = TailsConnectClient;
window.getTailsConnectClient = function (scene) {
  if (!window._tailsConnectClient) window._tailsConnectClient = new TailsConnectClient(scene);
  window._tailsConnectClient.scene = scene;
  return window._tailsConnectClient;
};
