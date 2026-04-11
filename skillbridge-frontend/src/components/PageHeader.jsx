// src/components/PageHeader.jsx
//
// Page title row: h1 + subtitle + optional action area.
// Used in: AdminDashboard, InstructorDashboard, AdminCompanies, AdminUsers, EnrolledStudents
//
// Props:
//   title    — string (rendered as <h1>)
//   subtitle — string or React node
//   action   — optional React node (button, link, etc.) displayed on the right

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {action}
        </div>
      )}
    </div>
  )
}
