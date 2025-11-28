import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { TimeCardContent } from '@/components/timecard/TimeCardContent'

export default function TimeCardPage() {
  return (
    <ProtectedRoute>
      <TimeCardContent />
    </ProtectedRoute>
  )
}


