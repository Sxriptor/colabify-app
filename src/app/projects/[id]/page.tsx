import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ProjectDetailContent } from '@/components/projects/ProjectDetailContent'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <ProtectedRoute>
      <ProjectDetailContent projectId={id} />
    </ProtectedRoute>
  )
}