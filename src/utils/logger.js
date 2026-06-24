// Lightweight logger that respects NODE_ENV
const isDev = process.env.NODE_ENV !== 'production';

const logger = {
    info: (...args) => isDev && console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    debug: (...args) => isDev && console.log('[DEBUG]', ...args),
};

export default logger;
