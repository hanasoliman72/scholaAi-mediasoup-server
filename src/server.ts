import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createWorkers, getNextWorker } from './MediasoupWorker';
import { Room } from './Room';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

const rooms = new Map<string, Room>();

async function getOrCreateRoom(sessionId: string): Promise<Room> {
    let room = rooms.get(sessionId);
    if (!room) {
        const worker = getNextWorker();
        room = await Room.create(worker, sessionId);
        rooms.set(sessionId, room);
        console.log(`Room created [sessionId:${sessionId}]`);
    }
    return room;
}

io.on('connection', (socket) => {
    console.log(`Peer connected [socketId:${socket.id}]`);

    socket.on('joinSession', async ({ sessionId, peerId, role, token }) => {
        try {
            const room = await getOrCreateRoom(sessionId);
            await room.addPeer(socket, peerId, role);
        } catch (error) {
            console.error('joinSession error:', error);
            socket.emit('error', { message: 'Failed to join session' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Peer disconnected [socketId:${socket.id}]`);
        rooms.forEach((room) => room.removePeer(socket.id));
    });
});

async function start() {
    await createWorkers();
    httpServer.listen(4443, () => {
        console.log('Server listening on port 4443');
    });
}
console.log('[Config] ANNOUNCED_IP =', process.env.ANNOUNCED_IP);
//console.log('[Config] mediasoup transport ip config:', JSON.stringify(config.mediasoup.webRtcTransportOptions.listenInfos));
start().catch(console.error);