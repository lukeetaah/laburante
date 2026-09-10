type UserLike = {
  id?: string
  user_metadata?: { account_type?: string; accountType?: string }
} | null | undefined

type ProfileLike = {
  id?: string
  account_type?: string
} | null | undefined

export function isCompanyAccount(user: UserLike, profile?: ProfileLike) {
  const metadataType = user?.user_metadata?.account_type || user?.user_metadata?.accountType
  return metadataType === 'empresa' || (profile?.id === user?.id && profile?.account_type === 'empresa')
}
