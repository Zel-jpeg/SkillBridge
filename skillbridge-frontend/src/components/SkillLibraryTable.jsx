import DataSection from './DataSection'
import EmptyState from './EmptyState'
import SearchBar from './SearchBar'
export default function SkillLibraryTable({
  url, skills = [], total = skills.length, search = '', onSearch, renderActions, footer,
}) {
  return <section aria-label="Skill library" className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
      {onSearch && <SearchBar label="Search skills" type="search" maxLength={255} value={search}
        onChange={onSearch} placeholder="Search skills..." className="w-full sm:max-w-sm" />}
      {total != null && <p role="status" className="ml-auto whitespace-nowrap text-xs font-medium text-gray-600 dark:text-gray-400">
        {total} {total === 1 ? 'skill' : 'skills'}
      </p>}
    </div>
    <DataSection url={url} layout="table" columns={renderActions ? 3 : 2} label="Loading skill categories">
      {skills.length === 0 ? <EmptyState message={search.trim() ? 'No skills match this search.' : 'No skill categories found.'}
        onClear={search.trim() && onSearch ? () => onSearch('') : undefined} /> : <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
            <th scope="col" className="w-1/2 px-3 py-3 text-left sm:px-5">Skill</th>
            <th scope="col" className="px-3 py-3 text-left sm:px-5">Tags</th>
            {renderActions && <th scope="col" className="w-16 px-2 py-3 text-right sm:w-28 sm:px-5">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {skills.map(skill => <tr key={skill.id} className="border-b border-gray-100 transition-colors last:border-0 even:bg-gray-50/50 hover:bg-green-50/50 dark:border-gray-800 dark:even:bg-gray-800/25 dark:hover:bg-green-950/30">
            <td className="px-3 py-4 align-top sm:px-5 sm:align-middle">
              <h3 className="break-words font-medium text-gray-900 dark:text-white">{skill.name}</h3>
              {skill.description && <p className="mt-1 max-w-md whitespace-pre-wrap break-words text-xs leading-5 text-gray-600 dark:text-gray-300">{skill.description}</p>}
            </td>
            <td className="px-3 py-4 align-top sm:px-5 sm:align-middle">
              {skill.tags?.length ? <ul className="flex flex-wrap gap-1" aria-label={`Tags for ${skill.name}`}>
                {skill.tags.map((tag, index) => <li key={`${index}-${tag}`} className="max-w-full break-words rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-800 dark:bg-green-950 dark:text-green-300">{tag}</li>)}
              </ul> : <span className="text-xs text-gray-500 dark:text-gray-400">No tags</span>}
            </td>
            {renderActions && <td className="px-2 py-4 align-top sm:px-3 sm:align-middle">
              <div className="flex flex-wrap justify-end gap-1">{renderActions(skill)}</div>
            </td>}
          </tr>)}
        </tbody>
      </table>}
      {footer}
    </DataSection>
  </section>
}
