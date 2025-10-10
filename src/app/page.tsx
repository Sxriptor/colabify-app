import { HomePage } from '@/components/home/HomePage'
import { ElectronAuthHandler } from '@/components/auth/ElectronAuthHandler'
import { Suspense } from 'react'

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <ElectronAuthHandler />
      </Suspense>
      <HomePage />
    </>
  )
}
