import express from 'express';
import http from 'http';
import ws from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import authRouter from './routes/auth';
import { engine } from './simulation/engine';
import prisma from './db/prismaClient';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoints
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'GridShare Backend' });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routing
app.use('/api/simulation', apiRouter);
app.use('/api/auth', authRouter);

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket Server
const wss = new ws.Server({ noServer: true });

wss.on('connection', (socket: ws.WebSocket) => {
  engine.registerClient(socket);
});

// Upgrade HTTP connection to WebSocket
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (wsSocket) => {
      wss.emit('connection', wsSocket, request);
    });
  } else {
    socket.destroy();
  }
});

// Main Server Boot Function
async function startServer() {
  try {
    // Connect to prisma db and run initialization/start timer
    await prisma.$connect();
    console.log('Prisma Client connected.');

    // Initialize and boot simulation clock
    await engine.start();
    console.log('Simulation engine initialized.');

    server.listen(PORT, () => {
      console.log(`Backend server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle termination signals cleanly
const gracefulShutdown = async () => {
  console.log('Terminating backend process gracefully...');
  server.close(() => {
    console.log('HTTP Server closed.');
  });
  await prisma.$disconnect();
  console.log('Database connection disconnected.');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer();
