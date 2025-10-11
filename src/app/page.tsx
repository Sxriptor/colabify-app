import { HomePageWithAuthHandler } from '@/components/home/HomePageWithAuthHandler'
import { Suspense } from 'react'

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomePageWithAuthHandler />
    </Suspense>
  )
}
