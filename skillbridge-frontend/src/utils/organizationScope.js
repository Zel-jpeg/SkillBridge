export const ORGANIZATION_OPTIONS = '/api/management/organization-options/'
export const ALL_ORGANIZATIONS = { institute: '', program: '' }
export const SHARED_IC_SKILLS = 'shared-ic'

export function matchesOrganization(record, { institute, program }) {
  return (!institute || String(record?.institute_id) === institute)
    && (!program || String(record?.program_id) === program)
}

export function scopedPartners(companies, scope, options, { includeEmpty = true } = {}) {
  if (!scope.institute && !scope.program) return companies
  const programs = new Map((options?.programs || []).map(program => [program.id, program]))
  const legacyInstitute = options?.institutes?.find(institute => institute.code === 'IC' || institute.name.toLowerCase() === 'institute of computing')
  const matchesProgram = program => program && matchesOrganization({ ...program, program_id: program.id }, scope)

  return companies.flatMap(company => {
    const positions = company.positions.filter(position => {
      const eligible = position.eligible_programs || []
      if (eligible.length) return eligible.some(matchesProgram)
      if (position.management_program_id) return matchesProgram(programs.get(position.management_program_id))
      return !position.eligibility_configured && !scope.program && String(legacyInstitute?.id) === scope.institute
    })
    const ownPartner = includeEmpty && matchesProgram(programs.get(company.management_program_id))
    return positions.length || ownPartner ? [{ ...company, positions }] : []
  })
}
