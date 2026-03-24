// WebRTC state
let peerConnection = null;
let dataChannel = null;

const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// File receive buffer
let receiveBuffer = [];
let receivedSize = 0;
let incomingFileInfo = null;

// Create RTCPeerConnection and wire up events
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(RTC_CONFIG);

  // Send ICE candidates to peer via signaling server
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({
        type: "ice-candidate",
        target: targetId,
        candidate: event.candidate
      }));
    }
  };

  // Connection state changes
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    console.log("Connection state:", state);
    updateConnectionStatus(state);
  };

  // Receiver side: data channel arrives here
  peerConnection.ondatachannel = (event) => {
    setupDataChannel(event.channel);
  };
}

// Setup data channel handlers (used by both sides)
function setupDataChannel(channel) {
  dataChannel = channel;
  dataChannel.binaryType = "arraybuffer";

  dataChannel.onopen = () => {
    console.log("✅ Data channel open");
    updateConnectionStatus("connected");
    setStatus("Connected — ready to send files");
  };

  dataChannel.onclose = () => {
    console.log("Data channel closed");
    updateConnectionStatus("disconnected");
    setStatus("Disconnected");
  };

  dataChannel.onerror = (err) => {
    console.error("Data channel error:", err);
  };

  // Receive file metadata, binary chunks, or chat messages
  dataChannel.onmessage = (event) => {
    if (typeof event.data === "string") {
      // JSON metadata
      const msg = JSON.parse(event.data);

      // ── CHAT FEATURE: receive chat message ────────────────── START
      if (msg.type === "chat") {
        appendChatMessage(msg.text, "them");
        return;
      }
      // ── CHAT FEATURE: receive chat message ────────────────── END

      // ── FILE TRANSFER FEATURE: receive file metadata ─────── START
      if (msg.type === "file-info") {
        incomingFileInfo = msg;
        receiveBuffer = [];
        receivedSize = 0;
        console.log("📥 Receiving file:", msg.name, formatSize(msg.size));
        setStatus(`Receiving: ${msg.name} (${formatSize(msg.size)})`);
        showProgress(0, msg.name);
      }
      // ── FILE TRANSFER FEATURE: receive file metadata ─────── END
    } else {
      // ── FILE TRANSFER FEATURE: receive binary chunk & reassemble ── START
      // Each chunk is pushed into buffer; when all bytes received → build Blob → auto download
      receiveBuffer.push(event.data);
      receivedSize += event.data.byteLength;

      const progress = Math.round((receivedSize / incomingFileInfo.size) * 100);
      showProgress(progress);

      if (receivedSize === incomingFileInfo.size) {
        // All chunks received — assemble Blob and trigger download
        const blob = new Blob(receiveBuffer, { type: incomingFileInfo.fileType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = incomingFileInfo.name;
        a.click();
        URL.revokeObjectURL(url);

        console.log("✅ File received:", incomingFileInfo.name);
        receiveBuffer = [];
        receivedSize = 0;
        setStatus(`✅ Received: ${incomingFileInfo.name}`);
        showProgress(100);
        incomingFileInfo = null;
      }
      // ── FILE TRANSFER FEATURE: receive binary chunk & reassemble ── END
    }
  };
}

// Initiator: create offer
async function startOffer() {
  createPeerConnection();

  // ── FILE TRANSFER FEATURE: create data channel (initiator side) ── START
  const channel = peerConnection.createDataChannel("fileTransfer");
  setupDataChannel(channel);
  // ── FILE TRANSFER FEATURE: create data channel (initiator side) ── END

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.send(JSON.stringify({
    type: "offer",
    target: targetId,
    offer: offer
  }));

  setStatus("Connecting to peer...");
}

// Receiver: handle incoming offer
async function handleOffer(offer) {
  createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.send(JSON.stringify({
    type: "answer",
    target: targetId,
    answer: answer
  }));
}

// ── FILE TRANSFER FEATURE: send file in chunks over data channel ── START
// Flow: file → metadata JSON → binary chunks (16KB each) → peer reassembles → auto download
const CHUNK_SIZE = 16 * 1024; // 16KB per chunk

function sendFile(file) {
  if (!dataChannel || dataChannel.readyState !== "open") {
    setStatus("❌ Not connected to a peer");
    return;
  }

  console.log("📁 Sending file:", file.name, formatSize(file.size));

  // Step 1: send metadata so receiver knows filename, size, type
  dataChannel.send(JSON.stringify({
    type: "file-info",
    name: file.name,
    size: file.size,
    fileType: file.type || "application/octet-stream"
  }));

  // Step 2: read and send binary chunks one at a time
  let offset = 0;
  const reader = new FileReader();

  reader.onload = (e) => {
    // Backpressure guard — wait if buffer is getting full (> 1MB)
    if (dataChannel.bufferedAmount > 1024 * 1024) {
      setTimeout(() => sendChunk(), 50);
    } else {
      dataChannel.send(e.target.result);
      offset += e.target.result.byteLength;

      const progress = Math.round((offset / file.size) * 100);
      showProgress(progress);

      if (offset < file.size) {
        sendChunk();
      } else {
        console.log("✅ File sent:", file.name);
        setStatus(`✅ Sent: ${file.name}`);
      }
    }
  };

  function sendChunk() {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    reader.readAsArrayBuffer(slice);
  }

  sendChunk();
  setStatus(`Sending: ${file.name} (${formatSize(file.size)})`);
  showProgress(0, file.name);
}
// ── FILE TRANSFER FEATURE: send file in chunks over data channel ── END

// ── CHAT FEATURE: send chat message over data channel ─────── START
function sendChatMessage(text) {
  if (!dataChannel || dataChannel.readyState !== "open") {
    setStatus("❌ Not connected — can't send message");
    return;
  }
  dataChannel.send(JSON.stringify({ type: "chat", text }));
  appendChatMessage(text, "me");
}
// ── CHAT FEATURE: send chat message over data channel ─────── END

// Helpers
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
