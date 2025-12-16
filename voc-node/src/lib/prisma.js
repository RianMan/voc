// src/lib/prisma.js
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

// 避免在开发环境下热重载导致连接数过多
export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;