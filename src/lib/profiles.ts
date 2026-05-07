export type ProfileRecord = {
  id: string
  email?: string | null
  full_name?: string | null
  avatar_url?: string | null
  github_username?: string | null
  notification_preference?: 'instant' | 'digest' | null
}

export type NormalizedProfile = ProfileRecord & {
  name?: string
}

export function normalizeProfile<T extends ProfileRecord | null | undefined>(profile: T): NormalizedProfile | T {
  if (!profile) return profile
  return {
    ...profile,
    name: profile.full_name || undefined,
  }
}

export async function fetchProfilesMap(supabase: any, ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))

  if (uniqueIds.length === 0) {
    return new Map<string, NormalizedProfile>()
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, github_username, notification_preference')
    .in('id', uniqueIds)

  if (error) {
    throw error
  }

  return new Map<string, NormalizedProfile>(
    (data || []).map((profile: ProfileRecord) => [profile.id, normalizeProfile(profile)])
  )
}
