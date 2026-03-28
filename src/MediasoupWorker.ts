import * as mediasoup from 'mediasoup';
import { config } from './config';

let workers: mediasoup.types.Worker[] = [];
let workerIndex = 0;

export async function createWorkers(): Promise<void> {
    const { numWorkers, workerSettings } = config.mediasoup;

    for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker(workerSettings);

        worker.on('died', () => {
            console.error(`mediasoup Worker died [pid:${worker.pid}]`);
            process.exit(1);
        });

        workers.push(worker);
        console.log(`mediasoup Worker created [pid:${worker.pid}]`);
    }
}

export function getNextWorker(): mediasoup.types.Worker {
    if (workers.length === 0) {
        throw new Error('No mediasoup workers available');
    }
    const worker = workers[workerIndex];
    workerIndex = (workerIndex + 1) % workers.length;
    return worker;
}