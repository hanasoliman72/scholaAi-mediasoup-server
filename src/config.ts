import os from 'os';

export const config = {
    httpPort: 4443,
    mediasoup: {
        numWorkers: os.cpus().length,
        workerSettings: {
            logLevel: 'warn' as const,
            rtcMinPort: 10000,
            rtcMaxPort: 59999,
        },
        routerOptions: {
            mediaCodecs: [
                {
                    kind: 'audio' as const,
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                },
                {
                    kind: 'video' as const,
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                    parameters: { 'x-google-start-bitrate': 1000 },
                },
                {
                    kind: 'video' as const,
                    mimeType: 'video/H264',
                    clockRate: 90000,
                    parameters: {
                        'packetization-mode': 1,
                        'profile-level-id': '42e01f',
                        'level-asymmetry-allowed': 1,
                        'x-google-start-bitrate': 1000,
                    },
                },
            ],
        },
        webRtcTransportOptions: {
            listenInfos: [
                {
                    protocol: 'udp' as const,
                    ip: '0.0.0.0',
                    announcedAddress: process.env.ANNOUNCED_IP || '127.0.0.1',
                },
                {
                    protocol: 'tcp' as const,
                    ip: '0.0.0.0',
                    announcedAddress: process.env.ANNOUNCED_IP || '127.0.0.1',
                },
            ],
            initialAvailableOutgoingBitrate: 1000000,
        },
    },
};