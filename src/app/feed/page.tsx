import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { randomBytes } from 'crypto'
import NavBar from '@/components/NavBar'
import SwipeFeed from '@/components/SwipeFeed'

const SESSION_COOKIE = 'nyc_session'

export const metadata = {
  title: 'Discover – NYC Discovery',
}

export default async function FeedPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  // Ensure user exists
  let userId: string | null = null
  if (token) {
    const user = await prisma.user.findUnique({ where: { session_token: token } })
    userId = user?.id ?? null
  }

  if (!userId) {
    // Anonymous users can still browse — redirect to onboarding for better experience
    redirect('/onboarding')
  }

  const sessionId = randomBytes(8).toString('hex')

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 overflow-hidden">
        <SwipeFeed sessionId={sessionId} />
      </div>
    </div>
  )
}
