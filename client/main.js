// ── DEVICE IDENTITY ──────────────────────────────────────────
function generateDeviceName() {
  const adjectives = ["Blue", "Red", "Green", "Fast", "Cool", "Dark", "Swift", "Brave"];
  const nouns = ["Tiger", "Laptop", "Phone", "Eagle", "Lion", "Falcon", "Wolf", "Panda"];
  return (
    adjectives[Math.floor(Math.random() * adjectives.length)] +
    " " +
    nouns[Math.floor(Math.random() * nouns.length)]
  );
}

const deviceName = generateDeviceName();
document.getElementById("deviceName").innerText = deviceName;
document.getElementById("myAvatarLetter").innerText = deviceName.charAt(0);

const socket = new WebSocket("wss://share-drop-7ifh.onrender.com");

// State
let myId = null;
let targetId = null;
let isInitiator = false;

// ── WEBSOCKET EVENTS ──────────────────────────────────────────
socket.onopen = () => {
  console.log("✅ Connected to server");
  socket.send(JSON.stringify({ type: "introduce", name: deviceName }));
  setStatus("Connected to server — waiting for peers");
};

socket.onclose = () => {
  setStatus("⚠️ Disconnected from server");
  updateConnectionStatus("disconnected");
};

socket.onerror = () => setStatus("❌ Server connection error");

socket.onmessage = async (event) => {
  let data;
  try { data = JSON.parse(event.data); } catch { return; }

  switch (data.type) {
    case "welcome":
      myId = data.id;
      break;

    case "clients":
      updateDeviceList(data.clients);
      break;

    case "connect-request":
      showConnectionPopup(data);
      break;

    case "connect-accepted":
      targetId = data.from;
      setStatus("Peer accepted — establishing P2P connection...");
      if (isInitiator) await startOffer();
      break;

    case "offer":
      targetId = data.from;
      await handleOffer(data.offer);
      break;

    case "answer":
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      break;

    case "ice-candidate":
      if (peerConnection) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)); }
        catch (err) { console.error("ICE error:", err); }
      }
      break;
  }
};

// ── DEVICE LIST UI ────────────────────────────────────────────
function updateDeviceList(clients) {
  const list = document.getElementById("devicesList");
  if (!myId) return;

  const others = clients.filter(c => c.id !== myId);

  if (others.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="radar-ring"></div>
        <p>Scanning for devices...</p>
      </div>`;
    return;
  }

  list.innerHTML = "";
  others.forEach(client => {
    const div = document.createElement("div");
    div.className = "device-item";
    div.innerHTML = `
      <div class="device-item-avatar">${client.name.charAt(0)}</div>
      <div>
        <div class="device-item-name">${client.name}</div>
        <div class="device-item-sub">Tap to connect</div>
      </div>
      <span class="device-item-arrow">›</span>`;
    div.onclick = () => sendConnectRequest(client);
    list.appendChild(div);
  });
}

function sendConnectRequest(client) {
  isInitiator = true;
  targetId = client.id;
  setStatus(`Requesting connection to ${client.name}...`);
  socket.send(JSON.stringify({ type: "connect-request", target: client.id }));
}

// ── CONNECTION POPUP ──────────────────────────────────────────
function showConnectionPopup(data) {
  const modal = document.getElementById("requestModal");
  document.getElementById("requestText").innerText = `${data.name} wants to connect with you`;
  modal.classList.add("active");

  document.getElementById("acceptBtn").onclick = () => {
    modal.classList.remove("active");
    targetId = data.from;
    isInitiator = false;
    socket.send(JSON.stringify({ type: "connect-accepted", target: data.from }));
    setStatus(`Accepted ${data.name} — establishing connection...`);
  };

  document.getElementById("rejectBtn").onclick = () => {
    modal.classList.remove("active");
    setStatus("Connection declined");
  };
}

// ── STATUS & PROGRESS UI ──────────────────────────────────────
function setStatus(msg) {
  document.getElementById("statusText").innerText = msg;
}

function updateConnectionStatus(state) {
  const dot = document.getElementById("connDot");
  const label = document.getElementById("connLabel");
  dot.className = "status-dot";

  if (state === "connected") {
    dot.classList.add("connected");
    label.innerText = "Connected";
  } else if (state === "connecting") {
    dot.classList.add("connecting");
    label.innerText = "Connecting...";
  } else {
    label.innerText = "Not connected";
  }
}

function showProgress(percent, filename) {
  const wrap = document.getElementById("progressWrap");
  wrap.classList.remove("hidden");
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("progressLabel").innerText = percent >= 100 ? "Done ✓" : percent + "%";
  if (filename) document.getElementById("progressFileName").innerText = filename;
}

// ── FILE TRANSFER FEATURE: file input & drag-drop wiring ─────── START
const dropArea = document.getElementById("dropArea");

dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropArea.classList.add("drag-over");
});

dropArea.addEventListener("dragleave", () => dropArea.classList.remove("drag-over"));

dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dropArea.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) sendFile(file);
});

document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) sendFile(file);
});
// ── FILE TRANSFER FEATURE: file input & drag-drop wiring ─────── END

// ── CHAT FEATURE: UI wiring & message rendering ───────────── START
document.getElementById("chatSendBtn").addEventListener("click", () => {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  sendChatMessage(text);
  input.value = "";
  input.focus();
});

document.getElementById("chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("chatSendBtn").click();
});

function appendChatMessage(text, from) {
  const box = document.getElementById("chatMessages");

  // Remove empty state placeholder if present
  const empty = box.querySelector(".chat-empty");
  if (empty) empty.remove();

  const msg = document.createElement("div");
  msg.className = "chat-msg " + (from === "me" ? "chat-me" : "chat-them");
  msg.innerText = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}
// ── CHAT FEATURE: UI wiring & message rendering ───────────── END
