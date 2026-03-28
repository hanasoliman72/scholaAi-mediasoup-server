import { Socket } from 'socket.io';
import * as mediasoup from 'mediasoup';
import { config } from './config';
import { Peer, PeerRole } from './Peer';

export class Room {
    public readonly sessionId: string;
    private router: mediasoup.types.Router;
    private peers = new Map<string, Peer>();

    private constructor(sessionId: string, router: mediasoup.types.Router) {
        this.sessionId = sessionId;
        this.router = router;
    }

    public static async create(
        worker: mediasoup.types.Worker,
        sessionId: string
    ): Promise<Room> {
        const router = await worker.createRouter(config.mediasoup.routerOptions);
        return new Room(sessionId, router);
    }

    public async addPeer(socket: Socket, peerId: string, role: PeerRole): Promise<void> {
        const peer = new Peer(socket, peerId, role);
        this.peers.set(socket.id, peer);
        console.log(`Peer added [sessionId:${this.sessionId}, peerId:${peerId}, role:${role}]`);
        socket.emit('routerRtpCapabilities', { rtpCapabilities: this.router.rtpCapabilities });
        this.handlePeerEvents(socket, peer);
    }

    public removePeer(socketId: string): void {
        const peer = this.peers.get(socketId);
        if (!peer) return;
        peer.close();
        this.peers.delete(socketId);
        this.broadcast(socketId, 'peerLeft', { peerId: peer.id });
        console.log(`Peer removed [sessionId:${this.sessionId}, peerId:${peer.id}]`);
    }

    private handlePeerEvents(socket: Socket, peer: Peer): void {

        socket.on('createTransport', async ({ direction }, callback) => {
            try {
                const transport = await this.createWebRtcTransport();
                if (direction === 'send') peer.sendTransport = transport;
                else peer.recvTransport = transport;
                callback({
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                });
            } catch (error) {
                console.error('createTransport error:', error);
                callback({ error: 'Failed to create transport' });
            }
        });

        socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
            try {
                const transport =
                    peer.sendTransport?.id === transportId
                        ? peer.sendTransport
                        : peer.recvTransport;
                if (!transport) throw new Error('Transport not found');
                await transport.connect({ dtlsParameters });
                callback({});
            } catch (error) {
                console.error('connectTransport error:', error);
                callback({ error: 'Failed to connect transport' });
            }
        });

        socket.on('produce', async ({ kind, rtpParameters, appData }, callback) => {
            try {
                if (!peer.sendTransport) {
                    return callback({ error: 'Send transport not created' });
                }

                const producer = await peer.sendTransport.produce({ kind, rtpParameters, appData });
                peer.addProducer(producer);

                // When producer closes — notify ALL other peers immediately
                producer.on('transportclose', () => {
                    peer.removeProducer(producer.id);
                    this.broadcast(socket.id, 'producerClosed', {
                        producerId: producer.id,
                        peerId: peer.id,
                    });
                });

                // This fires when producer.close() is called directly
                producer.observer.on('close', () => {
                    peer.removeProducer(producer.id);
                    this.broadcast(socket.id, 'producerClosed', {
                        producerId: producer.id,
                        peerId: peer.id,
                    });
                });

                this.broadcast(socket.id, 'newProducer', {
                    producerId: producer.id,
                    kind: producer.kind,
                    peerId: peer.id,
                    role: peer.role,
                    appData: producer.appData,
                });

                callback({ id: producer.id });
                console.log(`Producer created [peerId:${peer.id}, kind:${kind}, source:${appData?.source}]`);
            } catch (error) {
                console.error('produce error:', error);
                callback({ error: 'Failed to produce' });
            }
        });

        // Client explicitly closes a producer (stop sharing)
        socket.on('closeProducer', ({ producerId }, callback) => {
            try {
                const producer = peer.producers.get(producerId);
                if (producer) {
                    producer.close();
                    peer.removeProducer(producerId);
                    // Notify all other peers
                    this.broadcast(socket.id, 'producerClosed', {
                        producerId,
                        peerId: peer.id,
                    });
                }
                callback({});
            } catch (error) {
                console.error('closeProducer error:', error);
                callback({ error: 'Failed to close producer' });
            }
        });

        socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
            try {
                if (!this.router.canConsume({ producerId, rtpCapabilities })) {
                    return callback({ error: 'Cannot consume' });
                }
                if (!peer.recvTransport) {
                    return callback({ error: 'Recv transport not created' });
                }

                const consumer = await peer.recvTransport.consume({
                    producerId,
                    rtpCapabilities,
                    paused: true,
                });

                peer.addConsumer(consumer);

                consumer.on('transportclose', () => {
                    peer.removeConsumer(consumer.id);
                });

                consumer.on('producerclose', () => {
                    peer.removeConsumer(consumer.id);
                    socket.emit('consumerClosed', { consumerId: consumer.id });
                });

                callback({
                    id: consumer.id,
                    producerId,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                });
            } catch (error) {
                console.error('consume error:', error);
                callback({ error: 'Failed to consume' });
            }
        });

        socket.on('resumeConsumer', async ({ consumerId }, callback) => {
            try {
                const consumer = peer.consumers.get(consumerId);
                if (!consumer) throw new Error('Consumer not found');
                await consumer.resume();
                callback({});
            } catch (error) {
                console.error('resumeConsumer error:', error);
                callback({ error: 'Failed to resume consumer' });
            }
        });

        socket.on('getProducers', (callback) => {
            const producers: {
                producerId: string;
                kind: string;
                peerId: string;
                role: string;
                appData: mediasoup.types.AppData;
            }[] = [];

            this.peers.forEach((p) => {
                if (p.socket.id !== socket.id) {
                    p.producers.forEach((producer) => {
                        producers.push({
                            producerId: producer.id,
                            kind: producer.kind,
                            peerId: p.id,
                            role: p.role,
                            appData: producer.appData,
                        });
                    });
                }
            });

            callback({ producers });
        });
    }

    private async createWebRtcTransport(): Promise<mediasoup.types.WebRtcTransport> {
        return this.router.createWebRtcTransport(config.mediasoup.webRtcTransportOptions);
    }

    private broadcast(excludeSocketId: string, event: string, data: unknown): void {
        this.peers.forEach((peer) => {
            if (peer.socket.id !== excludeSocketId) {
                peer.socket.emit(event, data);
            }
        });
    }

    public isEmpty(): boolean { return this.peers.size === 0; }
    public getPeerCount(): number { return this.peers.size; }
}