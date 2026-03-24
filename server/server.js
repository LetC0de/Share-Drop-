const http = require("http");
const WebSocket = require("ws");

// ── DEPLOY FEATURE: use http server so Render can inject PORT via env ── START
const PORT = process.env.PORT || 3000;
const server = http.createServer();

// ── NETWORK FEATURE: attach WebSocket to http server, works on all interfaces ── START
const wss = new WebSocket.Server({ server });
// ── NETWORK FEATURE: attach WebSocket to http server ── END

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
// ── DEPLOY FEATURE: http server setup ── END

let clients = [];

// Generate random ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

wss.on("connection", (ws) => {
  const clientId = generateId();

  console.log("New client:", clientId);

  const client = {
    id: clientId,
    ws: ws,
    name: "Unknown"
  };

  clients.push(client);

  ws.on("message", (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch (err) {
      console.log("Invalid JSON received");
      return;
    }

    // ✅ Introduce
    if (data.type === "introduce") {
      client.name = data.name;

      ws.send(JSON.stringify({
        type: "welcome",
        id: client.id
      }));

      broadcastClients();
    }

    // ✅ Send connection request
    else if (data.type === "connect-request") {
      console.log("Connect request from", client.id, "to", data.target);

      const targetClient = clients.find(c => c.id === data.target);

      if (targetClient) {
        targetClient.ws.send(JSON.stringify({
          type: "connect-request",
          from: client.id,
          name: client.name
        }));
      }
    }

    // ✅ Handle accept
    else if (data.type === "connect-accepted") {
      const targetClient = clients.find(c => c.id === data.target);

      if (targetClient) {
        targetClient.ws.send(JSON.stringify({
          type: "connect-accepted",
          from: client.id
        }));
      }
    }

    // 🔥 OFFER (WebRTC)
    else if (data.type === "offer") {
      const targetClient = clients.find(c => c.id === data.target);

      if (targetClient) {
        targetClient.ws.send(JSON.stringify({
          type: "offer",
          from: client.id,
          offer: data.offer
        }));
      }
    }

    // 🔥 ANSWER (WebRTC)
    else if (data.type === "answer") {
      const targetClient = clients.find(c => c.id === data.target);

      if (targetClient) {
        targetClient.ws.send(JSON.stringify({
          type: "answer",
          from: client.id,
          answer: data.answer
        }));
      }
    }

    // 🔥 ICE CANDIDATE (WebRTC)
    else if (data.type === "ice-candidate") {
      const targetClient = clients.find(c => c.id === data.target);

      if (targetClient) {
        targetClient.ws.send(JSON.stringify({
          type: "ice-candidate",
          from: client.id,
          candidate: data.candidate
        }));
      }
    }
  });

  ws.on("close", () => {
    console.log("Disconnected:", clientId);

    clients = clients.filter(c => c.id !== clientId);
    broadcastClients();
  });
});

// Broadcast clients
function broadcastClients() {
  const clientList = clients.map(c => ({
    id: c.id,
    name: c.name
  }));

  clients.forEach(c => {
    c.ws.send(JSON.stringify({
      type: "clients",
      clients: clientList
    }));
  });
}

console.log(`✅ WebSocket signaling server ready`);