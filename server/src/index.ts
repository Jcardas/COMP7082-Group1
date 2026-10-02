import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import { apiRouter } from './routes/api.js';
import { setupCollaborationSockets } from './sockets/collabHandler.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: [config.clientUrl, 'http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
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
app.use(express.json());

// Routes
app.use('/api', apiRouter);

// Set up WebSocket collaboration listeners
setupCollaborationSockets(io);

// Server startup
server.listen(config.port, () => {
  console.log(`
  🚀 Minecraft Collaborative Modpack Maker Server
  ------------------------------------------------
  📡 Port:        ${config.port}
  🌐 Client URL:  ${config.clientUrl}
  📦 Database:    ${config.supabase.url ? 'Connected (Supabase)' : 'Fallback in-memory'}
  🧠 Vector/NLP:  ${config.huggingface.apiKey ? 'Enabled (Hugging Face)' : 'Keyword fallback'}
  🕹️  CurseForge:  ${config.curseforge.apiKey ? 'Enabled' : 'Disabled (Key missing)'}
  ✨ Modrinth:    Enabled
  ------------------------------------------------
  Ready for real-time collaborative modpack crafting!
  `);
});

export { app, io, server };
