import { Socket } from 'socket.io';
import * as mediasoup from 'mediasoup';

export type PeerRole = 'host' | 'viewer';

export class Peer {
    public readonly id: string;
    public readonly role: PeerRole;
    public readonly socket: Socket;

    // Transports
    public sendTransport: mediasoup.types.WebRtcTransport | null = null;
    public recvTransport: mediasoup.types.WebRtcTransport | null = null;

    // Host only — things the host sends
    public producers = new Map<string, mediasoup.types.Producer>();

    // Viewer only — things the viewer receives
    public consumers = new Map<string, mediasoup.types.Consumer>();

    constructor(socket: Socket, id: string, role: PeerRole) {
        this.socket = socket;
        this.id = id;
        this.role = role;
    }

    public isHost(): boolean {
        return this.role === 'host';
    }

    public addProducer(producer: mediasoup.types.Producer) {
        this.producers.set(producer.id, producer);
    }

    public removeProducer(producerId: string) {
        this.producers.delete(producerId);
    }

    public addConsumer(consumer: mediasoup.types.Consumer) {
        this.consumers.set(consumer.id, consumer);
    }

    public removeConsumer(consumerId: string) {
        this.consumers.delete(consumerId);
    }

    public close() {
        this.sendTransport?.close();
        this.recvTransport?.close();
        this.producers.forEach(p => p.close());
        this.consumers.forEach(c => c.close());
    }
}