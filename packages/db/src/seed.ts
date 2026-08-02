import { PrismaClient } from '@prisma/client';

export const verifySeedConnection = async (): Promise<void> => {
  const client = new PrismaClient();
  try {
    await client.$queryRaw`SELECT 1`;
  } finally {
    await client.$disconnect();
  }
};
