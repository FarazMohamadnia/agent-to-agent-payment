import path from 'path';

const testDbPath = path.join(__dirname, '..', 'prisma', 'test.db');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.JWT_SECRET = 'test-jwt-secret-min-16-chars!!';
process.env.JWT_EXPIRES_IN = '2h';
process.env.BCRYPT_COST = '10';
process.env.CORS_ORIGINS = '*';
process.env.ORDER_EXPIRY_MINUTES = '60';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.RATE_LIMIT_ORDERS_MAX = '1000';
process.env.LOG_LEVEL = 'silent';
process.env.PORT = '0';
process.env.WEBHOOK_TIMEOUT_MS = '300';
process.env.WEBHOOK_MAX_ATTEMPTS = '2';
