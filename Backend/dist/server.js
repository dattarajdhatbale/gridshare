"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_1 = __importDefault(require("./routes/api"));
const auth_1 = __importDefault(require("./routes/auth"));
const engine_1 = require("./simulation/engine");
const prismaClient_1 = __importDefault(require("./db/prismaClient"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check endpoints
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'GridShare Backend' });
});
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// API routing
app.use('/api/simulation', api_1.default);
app.use('/api/auth', auth_1.default);
// Create HTTP server
const server = http_1.default.createServer(app);
// Setup WebSocket Server
const wss = new ws_1.default.Server({ noServer: true });
wss.on('connection', (socket) => {
    engine_1.engine.registerClient(socket);
});
// Upgrade HTTP connection to WebSocket
server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    if (pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (wsSocket) => {
            wss.emit('connection', wsSocket, request);
        });
    }
    else {
        socket.destroy();
    }
});
// Main Server Boot Function
async function startServer() {
    try {
        // Connect to prisma db and run initialization/start timer
        await prismaClient_1.default.$connect();
        console.log('Prisma Client connected.');
        // Initialize and boot simulation clock
        await engine_1.engine.start();
        console.log('Simulation engine initialized.');
        server.listen(PORT, () => {
            console.log(`Backend server listening on port ${PORT}`);
        });
    }
    catch (error) {
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
    await prismaClient_1.default.$disconnect();
    console.log('Database connection disconnected.');
    process.exit(0);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
startServer();
