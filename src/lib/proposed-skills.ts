export type ProposedSkillQueryError = {
  code?: string | null
}

export type ProposedSkillsClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => PromiseLike<{ error: ProposedSkillQueryError | null }>
  }
}

export type ProposedSkillRegistrationResult = {
  attempted: number
  inserted: number
  failed: number
}

type ProposedSkillHandlers = {
  onQueryError?: (error: ProposedSkillQueryError) => void
  onException?: (error: unknown) => void
}

/**
 * Registers optional custom skills after the profile has already been saved.
 * A failure here is intentionally reported to the caller but never rejects
 * the profile creation flow.
 */
export async function registerCustomProposedSkills(
  client: ProposedSkillsClient,
  skillNames: string[],
  profileId: string,
  handlers: ProposedSkillHandlers = {},
): Promise<ProposedSkillRegistrationResult> {
  const result: ProposedSkillRegistrationResult = { attempted: skillNames.length, inserted: 0, failed: 0 }

  for (const skillName of skillNames) {
    try {
      const { error } = await client.from('proposed_skills').insert({
        skill_name: skillName,
        proposed_by_profile_id: profileId,
        status: 'pendiente',
      })

      if (error) {
        result.failed += 1
        handlers.onQueryError?.(error)
      } else {
        result.inserted += 1
      }
    } catch (error) {
      result.failed += 1
      handlers.onException?.(error)
    }
  }

  return result
}
