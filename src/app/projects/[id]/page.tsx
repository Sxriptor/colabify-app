import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ProjectDetailContent } from '@/components/projects/ProjectDetailContent'

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  return (
    <ProtectedRoute>
      <ProjectDetailContent projectId={params.id} />
    </ProtectedRoute>
  )
}