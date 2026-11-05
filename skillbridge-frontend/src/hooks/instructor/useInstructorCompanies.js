import { useState } from 'react'
import { useApi } from '../useApi'

const EMPTY = []

export function useInstructorCompanies() {
  const { data, loading } = useApi('/api/instructor/companies/')
  const [search, setSearch] = useState('')
  const companies = data ?? EMPTY
  const term = search.trim().toLowerCase()
  return {
    companies: companies.filter(company => company.name.toLowerCase().includes(term)),
    allCompanies: companies,
    allCount: companies.length,
    loading,
    search,
    setSearch,
  }
}
