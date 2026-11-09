# MCMC ⛏️
### Minecraft Collaborative Modpack Creator

> **Project Pitch:**  
> For Minecraft players who want to create modpacks easily with friends in a way that makes finding new mods simple, the collaborative minecraft modpack maker that makes modpack creation quick, easy, and community focused. Unlike CurseForge and Modrinth, our product allows for easy natural language search, real time collaboration, and a robust recommendation feature.

---

## ✨ Key Features

- **🧠 Natural Language AI Search:** Ask in plain conversational English (e.g. *"I want lightweight performance mods and biome overhaul"* or *"magic tech adventure"*) — MCMC extracts concepts, categories, and targets high-signal mods across Modrinth and CurseForge.
- **✨ Smart Modpack Recommendations:** Dynamically analyzes active modpack categories, companion addons (e.g. Create addons, Farmer's Delight expansions), and universal staples.
- **📦 Prominent Active Modpack Workspace:** Full-featured modpack view with mod summaries, download counts, and direct links to Modrinth and CurseForge.
- **🗳️ Real-Time Mod Voting (Yes / No):** Collaborators can upvote or downvote proposed mods with instant approval rates synchronized via Socket.io.
- **💬 Mod Discussion & Peer Comments:** In-line comment feeds on every mod for discussing compatibility, balance, and companion libraries.
- **🔄 Live Multi-User Collaboration:** Presence tracking, team chat, and instant synchronized mod additions/removals.
- **🛡️ Dependency & Cycle Validation:** Directed graph resolution with `graphlib` to detect circular dependencies, missing libraries, and compute installation order.
- **📦 One-Click Zip Export:** Streams CurseForge `manifest.json` and Modrinth `.mrpack` compatible zips on the fly using `archiver`.

---

## 🛠️ Tech Stack Overview

| Layer | Technology | Purpose |
|---|---|---|
| **Front End** | React 19 + TypeScript + Vite | Blazing fast client UI & reactive state |
| **Styling** | Tailwind CSS | Modern, responsive dark-mode Minecraft aesthetic |
| **Back End** | Node.js + Express (TypeScript) | REST endpoints & background services |
| **Concurrency / Real-Time** | Socket.io | Real-time presence, voting, comments, mod sync & chat |
| **Mod Ecosystem APIs** | Modrinth & CurseForge | Aggregating mod files, metadata, downloads, and dependencies |
| **Database & Vector Search** | Supabase (PostgreSQL + `pgvector`) | Modpack storage and semantic natural language search |
| **LLM & Embeddings** | Hugging Face Inference API | Text embeddings (`all-MiniLM-L6-v2`) & query understanding |
| **Dependency Checking** | `graphlib` | Directed graph analysis, cycle detection & install order |
| **Exporting to Zip** | `archiver` | Dynamic CurseForge manifest & Modrinth archive generation |

---

## 🎮 Supported Mod Loader Versions

MCMC includes native support and filtering for all common Minecraft versions:

- **1.7.10**
- **1.8.9**
- **1.9.4**
- **1.10.2**
- **1.11.2**
- **1.12.2**
- **1.13.2**
- **1.14.4**
- **1.15.2**
- **1.16.5**
- **1.17.1**
- **1.18.2**
- **1.19.2**
- **1.19.4**
- **1.20.1**
- **1.20.4**
- **1.20.6**
- **1.21.1**
- **1.21.4**
- **1.21.11**
- **26.1**
- **26.2**
- **26.3**

---

## 📁 Repository Structure

```text
COMP7082-Group1/
├── client/                     # Front End (React + Tailwind + Vite + TS)
│   ├── src/
│   │   ├── components/         # Navbar, ActiveModpackView, NaturalLanguageSearch, ModCard, DependencyViewer, ExportModal
│   │   ├── services/           # Socket.io connection & REST API client
│   │   ├── types/              # Client TypeScript interfaces (ModComment, ModVotes, etc.)
│   │   ├── utils/              # Download formatter & project URL resolver
│   │   ├── App.tsx             # Main collaborative modpack workspace
│   │   └── main.tsx
│   ├── vite.config.ts          # Vite configuration with proxy to server (port 5001)
│   ├── package.json
│   └── tsconfig.json
├── server/                     # Back End (Node.js + Express + TS)
│   ├── src/
│   │   ├── config/             # Typed environment variable loader
│   │   ├── lib/                # Supabase & Hugging Face client initializers
│   │   ├── routes/             # REST endpoints (/search, /dependencies, /export, /recommendations)
│   │   ├── services/           # Modrinth, CurseForge, Dependency Graph, Zip Exporter, Vector Search
│   │   ├── sockets/            # Socket.io room, voting, commenting & multiplayer handlers
│   │   ├── types/              # Server TypeScript interfaces
│   │   └── index.ts            # HTTP & Socket.io server entry point
│   ├── package.json
│   └── tsconfig.json
├── supabase/
│   └── migrations/
│       └── 20261001000000_init_schema.sql  # Database schema, pgvector extension & match_mods RPC
├── .env.example                # Template for environment secrets
├── .gitignore                  # Git exclusions for Node, React, OS, and env files
├── package.json                # Root monorepo workspace configuration
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js**: v20 or higher (`node -v`)
- **npm**: v10 or higher (`npm -v`)

### 2. Installation
From the repository root:
```bash
npm install
```

### 3. Run Development Servers
```bash
npm run dev
```

- **Frontend Client:** [http://localhost:3000](http://localhost:3000)
- **Backend API & WebSockets:** [http://localhost:5001](http://localhost:5001)
- **Health Check:** [http://localhost:5001/api/health](http://localhost:5001/api/health)

### 4. Build for Production
```bash
npm run build
```
