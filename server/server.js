const http = require("http");
const WebSocket = require("ws");

const ALLOWED_ORIGIN = "https://share-drop-rho.vercel.app";

// ── DEPLOY FEATURE: use http server so Render can inject PORT via env ── START
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.writeHead(200);
  res.end();
});
// ── DEPLOY FEATURE: http server setup ── END

// ── NETWORK FEATURE: attach WebSocket to http server, works on all interfaces ── START
const wss = new WebSocket.Server({
  server,
  verifyClient: ({ origin }, cb) => {
    if (!origin || origin === ALLOWED_ORIGIN) {
      cb(true);
    } else {
      cb(false, 403, "Forbidden");
    }
  }
});
// ── NETWORK FEATURE: attach WebSocket to http server ── END

server.listen(PORT, "0.0.0.0");

let clients = [];

// ── UTILITY: generate random short ID ── START
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}
// ── UTILITY: generate random short ID ── END

// ── SAME-NETWORK FILTER FEATURE: extract real client IP from request headers ── START
// Render (and most proxies) forward the real IP via x-forwarded-for header.
// We take the FIRST IP in the chain — that's the original client IP.
function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    // x-forwarded-for can be "clientIP, proxy1, proxy2" — take first
    return forwarded.split(",")[0].trim();
  }
  // Fallback to direct socket address
  return req.socket.remoteAddress || "unknown";
}
// ── SAME-NETWORK FILTER FEATURE: extract real client IP ── END

// ── SAME-NETWORK FILTER FEATURE: derive subnet key from IP ── START
// For IPv4: use first 3 octets as subnet key → "192.168.1" groups all 192.168.1.x devices
// For IPv6 or unknown: fall back to full IP so at least the same device matches itself
function getSubnetKey(ip) {
  // Strip IPv6-mapped IPv4 prefix (e.g. "::ffff:192.168.1.5" → "192.168.1.5")
  const cleaned = ip.replace(/^::ffff:/, "");

  const ipv4Match = cleaned.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (ipv4Match) {
    // Use /24 subnet: first 3 octets
    return `${ipv4Match[1]}.${ipv4Match[2]}.${ipv4Match[3]}`;
  }

  // IPv6: use first 4 groups as subnet key (covers typical /64 prefix)
  const ipv6Parts = cleaned.split(":");
  if (ipv6Parts.length >= 4) {
    return ipv6Parts.slice(0, 4).join(":");
  }

  return cleaned; // fallback: exact IP
}
// ── SAME-NETWORK FILTER FEATURE: derive subnet key from IP ── END

// ── SAME-NETWORK FILTER FEATURE: broadcast only to clients on same subnet ── START
// Instead of sending the full client list to everyone, each client only
// receives the list of other clients that share the same subnet key.
function broadcastClientsToSubnet(subnetKey) {
  // All clients on this subnet
  const subnetClients = clients.filter(c => c.subnetKey === subnetKey);

  const clientList = subnetClients.map(c => ({ id: c.id, name: c.name }));

  subnetClients.forEach(c => {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(JSON.stringify({
        type: "clients",
        clients: clientList
      }));
    }
  });
}
// ── SAME-NETWORK FILTER FEATURE: broadcast only to clients on same subnet ── END

wss.on("connection", (ws, req) => {
  const clientId = generateId();

  // ── SAME-NETWORK FILTER FEATURE: capture IP and subnet on connect ── START
  const clientIP = getClientIP(req);
  const subnetKey = getSubnetKey(clientIP);
  // ── SAME-NETWORK FILTER FEATURE: capture IP and subnet on connect ── END

  const client = {
    id: clientId,
    ws: ws,
    name: "Unknown",
    ip: clientIP,
    subnetKey: subnetKey   // ← used for same-network grouping
  };

  clients.push(client);

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      return;
    }

    // ── INTRODUCE FEATURE: register device name and welcome ── START
    if (data.type === "introduce") {
      client.name = data.name;

      ws.send(JSON.stringify({
        type: "welcome",
        id: client.id
      }));

      // Only broadcast to same-subnet peers
      broadcastClientsToSubnet(client.subnetKey);
    }
    // ── INTRODUCE FEATURE ── END

    // ── SIGNALING FEATURE: forward connect-request to target only ── START
    else if (data.type === "connect-request") {
      const targetClient = clients.find(c => c.id === data.target);
      if (targetClient) {
        targetClient.ws.send(JSON.stringify({
          type: "connect-request",
          from: client.id,
          name: client.name
        }));
      }
    }

    else if (data.type === "connect-accepted") {
      const targetClient = clients.find(c => c.id === data.target);
      if (targetClient) {
        targetClient.ws.send(JSON.stringify({
          type: "connect-accepted",
          from: client.id
        }));
      }
    }
    // ── SIGNALING FEATURE: connect-request/accepted ── END

    // ── WEBRTC SIGNALING FEATURE: offer / answer / ice-candidate ── START
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
    // ── WEBRTC SIGNALING FEATURE: offer / answer / ice-candidate ── END
  });

  ws.on("close", () => {
    const subnet = client.subnetKey;
    clients = clients.filter(c => c.id !== clientId);
    // ── SAME-NETWORK FILTER FEATURE: re-broadcast subnet after disconnect ── START
    broadcastClientsToSubnet(subnet);
    // ── SAME-NETWORK FILTER FEATURE: re-broadcast subnet after disconnect ── END
  });
});

