import { startWorker } from './worker.js';
import { logger } from './logger.js';
logger.info('Authify Functions Runtime starting...');
const worker = startWorker();
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing worker...');
    await worker.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing worker...');
    await worker.close();
    process.exit(0);
});
//# sourceMappingURL=index.js.map