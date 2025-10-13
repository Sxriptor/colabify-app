import { Suspense } from 'react'
import { TabbedSettingsContent } from '@/components/settings/TabbedSettingsContent'

function SettingsContent() {
  return <TabbedSettingsContent />
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  )
}