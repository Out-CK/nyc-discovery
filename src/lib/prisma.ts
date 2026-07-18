import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrisma() {
  const rawUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  let libsqlUrl: string
  if (rawUrl.startsWith('file:')) {
    const filePart = rawUrl.slice(5)
    const absPath = path.isAbsolute(filePart) ? filePart : path.resolve(process.cwd(), filePart)
    libsqlUrl = `file:${absPath}`
  } else {
    libsqlUrl = rawUrl
  }
  const adapter = new PrismaLibSql({ url: libsqlUrl })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma || createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
