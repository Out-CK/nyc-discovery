import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const SESSION_COOKIE = 'nyc_session'

export default async function HomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    const user = await prisma.user.findUnique({
      where: { session_token: token },
      include: { preferences: true },
    })
    if (user?.preferences?.onboarding_completed) {
      redirect('/feed')
    }
  }

  redirect('/onboarding')
}
