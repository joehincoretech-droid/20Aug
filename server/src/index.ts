import 'dotenv/config';
import { startServer } from './start.js';

startServer().catch((err: unknown) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
