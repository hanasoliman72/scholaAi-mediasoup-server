# 🎥 ScholaAi — Mediasoup Session Server

> Real-time WebRTC media server powering live one-on-one tutoring sessions on the ScholaAi platform.

---

## 📋 Overview

This service is the **WebRTC signalling and media routing backbone** of ScholaAi. It uses [mediasoup](https://mediasoup.org/) — a powerful SFU (Selective Forwarding Unit) — combined with [Socket.IO](https://socket.io/) for signalling, enabling low-latency audio/video communication between teachers and students during live sessions.

---

## 🏗️ Architecture

```
Frontend (React)
     │
     │  Socket.IO (ws / wss)
     ▼
┌─────────────────────────────┐
│   Express + Socket.IO       │  ← Port 4443
│   server.ts                 │
│                             │
│   ┌─────────────────────┐   │
│   │  Room (per session) │   │
│   │  ┌────────────────┐ │   │
│   │  │  Peer (socket) │ │   │
│   │  └────────────────┘ │   │
│   └─────────────────────┘   │
│                             │
│   mediasoup Workers (SFU)   │  ← UDP/TCP 10000–59999
└─────────────────────────────┘
```

- **`server.ts`** — Entry point. Manages Socket.IO connections and Room lifecycle.
- **`Room.ts`** — Manages a single session room; creates mediasoup routers and transports.
- **`Peer.ts`** — Represents a connected participant (teacher or student).
- **`MediasoupWorker.ts`** — Bootstraps and round-robins across CPU workers.
- **`config.ts`** — All mediasoup configuration (codecs, ports, transport settings).

---

## ⚙️ Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18 | Runtime |
| TypeScript | ^5.9 | Language |
| mediasoup | ^3.19 | SFU / WebRTC media routing |
| Socket.IO | ^4.8 | Real-time signalling |
| Express | ^5.2 | HTTP server base |
| ts-node | ^10.9 | Dev runner |
| nodemon | ^3.1 | Hot reload in development |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python 3** and build tools (required by mediasoup's native addon)
  - Windows: install [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
ANNOUNCED_IP=<your-machine-LAN-IP>
```

> **Important:** `ANNOUNCED_IP` must be set to the host machine's LAN IP address (e.g. `192.168.1.10`) so that WebRTC ICE candidates are routable by other devices on the network. Leaving it unset defaults to `127.0.0.1` (localhost only).

### Running

**Development** (with hot reload):
```bash
npm run dev
```

**Production** (compile then start):
```bash
npm run build
npm start
```

The server will listen on **port 4443**.

---

## 🔌 Socket.IO Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `joinSession` | `{ sessionId, peerId, role, token }` | Join or create a session room |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `error` | `{ message }` | Emitted on failure (e.g. failed to join room) |
| *(mediasoup signalling events)* | varies | Router/transport/producer/consumer negotiation |

---

## 🌐 Network & Firewall

The server uses mediasoup WebRTC transports listening on:

- **Protocol:** UDP + TCP
- **Port range:** `10000 – 59999`
- **STUN servers:** `stun.l.google.com:19302` (fallback ICE gathering)

> Make sure these ports are open in your Windows Firewall for LAN connectivity. See the ScholaAi setup guide for the exact `netsh` commands.

---

## 📁 Project Structure

```
my-session-server/
├── src/
│   ├── server.ts            # Entry point — HTTP + Socket.IO server
│   ├── Room.ts              # Per-session room logic
│   ├── Peer.ts              # Per-participant peer state
│   ├── MediasoupWorker.ts   # Worker pool management
│   └── config.ts            # mediasoup codec & transport config
├── .env                     # Environment variables (not committed)
├── package.json
└── tsconfig.json
```

---

## 🔗 Related Services

| Service | Repo | Description |
|---|---|---|
| Frontend | `ScholaAi-Front-End` | React app consumed by teachers & students |
| Backend API | `ScholaAi` (.NET) | REST API, auth, session management |
| AI Model Hub | `ScholaAi-model-hub` | Focus detection & session summarization |

---

## 📄 License

ISC