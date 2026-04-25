# ⚡ ShareDrop – Real-Time File Sharing & Chat App

A modern peer-to-peer (P2P) web application that enables real-time file sharing and chat between nearby devices using WebRTC and WebSockets — built with a clean, professional UI.

---

## 🚀 Live App Link

https://share-drop-rho.vercel.app/

## 📖 How to Use

1️⃣ Same Network
Connect both devices to the same Wi-Fi

2️⃣ Open App
Open ShareDrop in browser on both devices

3️⃣ Select Device
Choose a nearby device from the list

4️⃣ Connect
Send request → Accept on other device

5️⃣ Send Files / Chat

* Drag & drop files to send
* Use chat for messaging

---

⚠️ Note: Don’t refresh or change network during transfer


## 📌 Features

### 🔗 Real-Time Device Discovery

* Detects nearby devices dynamically
* Shows only users on the same network (subnet filtering)
* Unique auto-generated device names

### 🤝 Secure Peer Connection

* Connection request / accept / reject flow
* WebRTC signaling via WebSocket server
* Direct P2P communication (no server storage)

### 📁 File Sharing (Core Feature)

* Send files directly between devices
* Chunk-based transfer (16KB chunks)
* Real-time progress tracking
* Auto-download on receiver side
* Supports all file types

### 💬 Real-Time Chat

* Instant messaging between connected peers
* Clean and minimal chat UI
* Works alongside file transfers

### 🎨 Modern UI/UX

* Clean and responsive design
* Drag & drop file upload
* Live connection status indicators
* Animated feedback & notifications
* Device avatars & interactive cards

---

## 🧠 Tech Stack

### 🖥 Frontend

* HTML5, CSS3, JavaScript (Vanilla)
* WebRTC (P2P communication)
* Responsive UI design

### ⚙️ Backend

* Node.js
* WebSocket (`ws` library)
* HTTP server (deployment compatibility)

### 🌐 Networking

* WebRTC Data Channels
* STUN Server: `stun:stun.l.google.com:19302`
* WebSocket signaling server

### ☁️ Deployment

* Frontend → Vercel
* Backend → Render

---

## 🏗️ Project Architecture

```
Client A  ←→  WebSocket Server  ←→  Client B
   │                                  │
   └──────────── WebRTC P2P ──────────┘
         (Direct File + Chat)
```

* WebSocket → Used only for signaling
* WebRTC → Handles actual file + chat transfer

---

## ⚙️ How It Works

### 1️⃣ Device Discovery

* Client connects to WebSocket server
* Server groups devices using IP subnet filtering
* Only nearby devices are displayed

### 2️⃣ Connection Establishment

* User sends connection request
* Peer accepts → WebRTC handshake starts
* Exchange:

  * Offer
  * Answer
  * ICE Candidates

### 3️⃣ File Transfer

* Metadata sent first (name, size, type)
* File split into 16KB chunks
* Receiver reconstructs and downloads file

### 4️⃣ Chat

* Messages sent via WebRTC Data Channel
* No server storage → fully private

---

## 📂 Folder Structure

```
ShareDrop/
│── frontend/
│   ├── index.html
│   ├── style.css
│   ├── main.js
│   ├── webrtc.js
│
│── backend/
│   ├── server.js
│
│── README.md
```

---

## 🛠️ Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/LetC0de/Share-Drop-.git
cd sharedrop
```

### 2️⃣ Backend Setup

```bash
cd backend
npm install
node server.js
```

### 3️⃣ Frontend Setup

Simply open:

```
index.html
```

Or deploy it using Vercel.

---

📦 Requirements

To run this project locally, make sure you have the following installed:

Node.js (v14 or higher)
npm (comes with Node.js)
Modern Web Browser (Chrome, Edge, etc.)

⚙️ Installation
npm install ws

▶️ Run the App
node server.js



## 🔐 Security & Optimization

* ✅ No file storage on server (pure P2P)
* ✅ Subnet filtering for local network privacy
* ✅ WebSocket origin validation
* ✅ Chunk-based transfer prevents memory overload
* ✅ Backpressure handling for large file stability

---

## ⚡ Key Highlights

* 🚀 Real-time P2P communication
* 📡 Smart same-network filtering
* 📁 Large file transfer support
* 💬 Built-in chat system
* 🎯 Clean and professional UI
* ☁️ Fully deployed (Vercel + Render)

---

## 📸 UI Highlights

* Device discovery panel
* Drag & drop upload zone
* Live progress bar
* Chat interface
* Connection request modal


## 👨‍💻 Author

Abhishek Nishad

---

## ⭐ Support

If you like this project:

* Give it a ⭐ on GitHub
* Share it with others 🚀

---
