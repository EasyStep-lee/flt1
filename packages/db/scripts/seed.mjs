import { verifySeedConnection } from '../dist/seed.js';

await verifySeedConnection();
process.stdout.write('Prisma seed framework connected successfully; no business seed data was written.\n');
