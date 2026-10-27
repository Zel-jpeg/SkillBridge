export function matchesAccount(student, account) {
  return account === 'all' || (account === 'archived' ? student.archived : !student.archived)
}
