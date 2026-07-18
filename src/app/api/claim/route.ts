import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

const SESSION_COOKIE = 'nyc_session'

async function getUserId() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const user = await prisma.user.findUnique({ where: { session_token: token } })
  return user?.id ?? null
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const body = await req.json()
  const {
    entity_id,
    submitter_name,
    submitter_email,
    submitter_role,
    relationship,
    verification_method = 'email_domain',
  } = body

  if (!entity_id || !submitter_name || !submitter_email || !relationship) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const entity = await prisma.entity.findUnique({ where: { id: entity_id } })
  if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

  const code = randomBytes(4).toString('hex').toUpperCase()

  const claim = await prisma.claimRequest.create({
    data: {
      entity_id,
      user_id: userId,
      submitter_name,
      submitter_email,
      submitter_role: submitter_role ?? 'unknown',
      relationship,
      verification_method,
      verification_code: code,
      verification_sent_at: new Date(),
    },
  })

  // Update entity claim status
  await prisma.entity.update({
    where: { id: entity_id },
    data: { claim_status: 'pending' },
  })

  return NextResponse.json({
    ok: true,
    claim_id: claim.id,
    verification_code: code,
    message: `A verification code (${code}) would be sent to ${submitter_email} in production.`,
  })
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const { claim_id, code } = await req.json()
  const claim = await prisma.claimRequest.findUnique({ where: { id: claim_id } })

  if (!claim || claim.user_id !== userId) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  }

  if (claim.verification_code !== code) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  await prisma.claimRequest.update({
    where: { id: claim_id },
    data: { status: 'verified', verified_at: new Date() },
  })
  await prisma.entity.update({
    where: { id: claim.entity_id },
    data: { claim_status: 'verified' },
  })

  return NextResponse.json({ ok: true, message: 'Business verified!' })
}
