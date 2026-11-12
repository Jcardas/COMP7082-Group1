// Server setup for MCMC using Express and Socket.IO.
//
// This script sets up all the routing and middleware for the server.
// It also initializes Socket.IO for real-time communication.
//
// Generated with help from Google Antigravity, with comments and tweaks by Group 1 - Justin C

import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import { apiRouter } from './routes/api.js';
import { seedPopularModEmbeddings } from './services/modSeeder.js';
import { setupCollaborationSockets } from './sockets/collabHandler.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS configuration on localhost and client URL
// Note: This is a basic setup and would be adjusted for production environments.
const io = new Server(server, {
  cors: {
    origin: [config.clientUrl, 'http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

// Middlewares
app.use(
  cors({
    origin: [config.clientUrl, 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api', apiRouter);

// Set up WebSocket collaboration listeners
setupCollaborationSockets(io);

// Server startup with nice looking startup message :)
server.listen(config.port, () => {
  console.log(`
  🚀 MCMC Server
  ------------------------------------------------
  📡 Port:        ${config.port}
  🌐 Client URL:  ${config.clientUrl}
  📦 Database:    ${config.supabase.url ? '🔌 Connected (Supabase)' : '🚫 Fallback in-memory'}
  🧠 Vector/NLP:  Enabled (Local all-MiniLM-L6-v2)
  🕹️  CurseForge:  ${config.curseforge.apiKey ? 'Enabled' : 'Disabled (Key missing)'}
  ✨ Modrinth:    Enabled
  ------------------------------------------------
  Ready!
  `);

  // Asynchronously seed popular mod embeddings into Supabase pgvector
  // This will run in the background and not block the server startup.
  seedPopularModEmbeddings().catch((err) => {
    console.warn('Mod seeder background warning:', err?.message || err);
  });
});

export { app, io, server };
