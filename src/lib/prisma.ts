import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrisma() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  // Tables live in the nyc_discovery schema (shared Supabase Postgres),
  // passed via a ?schema= param on DATABASE_URL.
  const parsed = new URL(url)
  const schema = parsed.searchParams.get('schema') ?? 'nyc_discovery'
  parsed.searchParams.delete('schema')
  const adapter = new PrismaPg({ connectionString: parsed.toString() }, { schema })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma || createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
