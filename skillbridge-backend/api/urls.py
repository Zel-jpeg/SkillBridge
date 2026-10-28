from django.urls import path
from .placement_drafts import placement_draft
from .admin_accounts import admin_account_detail
from .student_records import previously_unenrolled, archived_student_history
from .analytics import management_analytics
from .management_views import admin_batch_detail, admin_batch_instructors, admin_management_actions
from .evaluation_views import admin_nlp_model_comparison
from .nlp_diagnostic_views import taxonomy_quality, student_nlp_text, position_nlp_text
from . import views
from .assessment_archives import assessment_archive
from .assessment_lifecycle import assessment_duplicate, assessment_attempt_timing, assessment_extra_time
from .assessment_interruptions import assessment_interruption
from .retake_requests import student_request, request_queue, review_request, evidence
from .sse import admin_events, instructor_events, student_events
from .health import health
from .email_views import enrollment_emails, email_progress, brevo_event

urlpatterns = [
    path('instructor/batches/<int:batch_id>/emails/', enrollment_emails, name='enrollment_emails'),
    path('instructor/batches/<int:batch_id>/email-progress/', email_progress, name='email_progress'),
    path('email/brevo-events/', brevo_event, name='brevo_event'),
    path('instructor/batches/<int:batch_id>/unenrolled/', previously_unenrolled, name='previously_unenrolled'),
    path('admin/users/<int:student_id>/history/', archived_student_history, name='archived_student_history'),
    path('assessments/<int:assessment_id>/interruption/', assessment_interruption, name='assessment_interruption'),
    path('assessments/<int:assessment_id>/retake-request/', student_request, name='student_retake_request'),
    path('retake-requests/', request_queue, name='retake_request_queue'),
    path('assessments/<int:assessment_id>/retake-requests/<int:student_id>/review/', review_request, name='review_retake_request'),
    path('assessments/<int:assessment_id>/retake-requests/<int:student_id>/evidence/', evidence, name='retake_request_evidence'),
    path('admin/batch-instructors/', admin_batch_instructors, name='admin_batch_instructors'),
    path('admin/batches/<int:batch_id>/', admin_batch_detail, name='admin_batch_detail'),
    path('admin/management-actions/', admin_management_actions, name='admin_management_actions'),
    path('health/', health, name='health'),
    path('admin/taxonomy-quality/', taxonomy_quality, name='taxonomy_quality'),
    path('nlp/students/<int:student_id>/text/', student_nlp_text, name='student_nlp_text'),
    path('nlp/positions/<int:position_id>/text/', position_nlp_text, name='position_nlp_text'),
    path('admin/nlp-model-comparison/', admin_nlp_model_comparison, name='admin_nlp_model_comparison'),
    # ── Auth ─────────────────────────────────────────────────────────────────
    path('auth/login/',          views.login,           name='login'),
    path('auth/refresh/',        views.refresh,         name='refresh'),
    path('auth/me/',             views.me,              name='me'),
    path('auth/google/',         views.google_login,    name='google_login'),
    path('auth/register-role/',  views.register_role,   name='register_role'),

    # ── Student ───────────────────────────────────────────────────────────────
    path('students/me/',              views.student_me,             name='student_me'),
    path('students/me/profile/',      views.student_profile,        name='student_profile'),
    path('student/results/',          views.student_results,        name='student_results'),
    path('student/results/combined/', views.student_combined_results, name='student_combined_results'),
    path('student/results/review/',   views.student_results_review, name='student_results_review'),
    path('student/companies/',        views.student_companies,      name='student_companies'),

    # ── Skill Categories (shared) ─────────────────────────────────────────────
    path('categories/',               views.categories,              name='categories'),
    path('categories/suggest/',       views.suggest_category_view,   name='suggest_category'),
    path('tags/suggest/',             views.suggest_tags_view,       name='suggest_tags'),

    # ── Instructor — Batches ──────────────────────────────────────────────────
    path('instructor/batches/',                           views.instructor_batches,         name='instructor_batches'),
    path('instructor/batches/<int:batch_id>/enroll/preview/', views.instructor_batch_enroll_preview, name='instructor_batch_enroll_preview'),
    path('instructor/batches/<int:batch_id>/enroll/',     views.instructor_batch_enroll,    name='instructor_batch_enroll'),
    path('instructor/batches/<int:batch_id>/students/',   views.instructor_batch_students,  name='instructor_batch_students'),
    path('instructor/batches/<int:batch_id>/archive/',    views.instructor_batch_archive,   name='instructor_batch_archive'),
    path('instructor/batches/<int:batch_id>/unarchive/',  views.instructor_batch_unarchive, name='instructor_batch_unarchive'),
    path('instructor/students/<int:student_id>/retake/',  views.instructor_student_retake,  name='instructor_student_retake'),
    path('management/assessment-reports/', views.management_assessment_reports, name='management_assessment_reports'),
    path('management/analytics/', management_analytics, name='management_analytics'),
    path('instructor/students/<int:student_id>/',         views.instructor_student_remove,  name='instructor_student_remove'),

    # ── Instructor — Assessments ──────────────────────────────────────────────
    path('instructor/assessments/',                                   views.instructor_assessments,           name='instructor_assessments'),
    path('instructor/assessments/<int:assessment_id>/',               views.instructor_assessment_detail,     name='instructor_assessment_detail'),
    path('instructor/assessments/<int:assessment_id>/archive/', assessment_archive, name='assessment_archive'),
    path('instructor/assessments/<int:assessment_id>/restore/', assessment_archive, {'restore': True}, name='assessment_restore'),
    path('instructor/assessments/<int:assessment_id>/duplicate/', assessment_duplicate, name='assessment_duplicate'),
    path('instructor/assessments/<int:assessment_id>/students/<int:student_id>/extra-time/', assessment_extra_time, name='assessment_extra_time'),
    path('assessments/<int:assessment_id>/timing/', assessment_attempt_timing, name='assessment_attempt_timing'),
    path('instructor/assessments/<int:assessment_id>/questions/',     views.instructor_assessment_questions,  name='instructor_assessment_questions'),
    path('instructor/questions/<int:question_id>/', views.instructor_question_detail, name='instructor_question_detail'),

    # ── Instructor — Recommendations ──────────────────────────────────────────
    path('instructor/students/recommendations/', views.instructor_student_recommendations, name='instructor_student_recommendations'),

    # ── Instructor — Companies (view + edit) ──────────────────────────────────
    path('instructor/companies/',              views.instructor_companies,      name='instructor_companies'),
    path('instructor/companies/<int:co_id>/',  views.instructor_company_edit,   name='instructor_company_edit'),

    # ── Student — Assessment Flow ─────────────────────────────────────────────
    path('assessments/',                         views.assessment_list,    name='assessment_list'),
    path('assessments/active/',                  views.assessment_active,  name='assessment_active'),
    path('assessments/<int:assessment_id>/start/',  views.assessment_start,   name='assessment_start'),
    path('assessments/<int:assessment_id>/submit/', views.assessment_submit,  name='assessment_submit'),
    path('assessments/<int:assessment_id>/stop/',   views.assessment_stop,    name='assessment_stop'),
    path('instructor/assessments/<int:assessment_id>/questions/add/', views.instructor_assessment_add_questions, name='instructor_assessment_add_questions'),

    

    # ── Admin ─────────────────────────────────────────────────────────────────
    path('admin/stats/',                                  views.admin_stats,              name='admin_stats'),
    path('admin/users/',                                  views.admin_users,              name='admin_users'),
    path('admin/users/<int:user_id>/',                     admin_account_detail,          name='admin_account_detail'),
    path('admin/instructors/',                            views.admin_instructors,        name='admin_instructors'),
    path('admin/instructors/<int:user_id>/approve/',      views.admin_approve_instructor, name='admin_approve_instructor'),
    path('admin/companies/',                              views.admin_companies,          name='admin_companies'),
    path('admin/companies/<int:company_id>/',             views.admin_company_detail,     name='admin_company_detail'),
    path('admin/companies/<int:company_id>/positions/',   views.admin_company_positions,  name='admin_company_positions'),
    path('admin/positions/<int:position_id>/',            views.admin_position_detail,    name='admin_position_detail'),
    path('admin/skills/',                                 views.admin_skills,             name='admin_skills'),
    path('admin/skills/<int:skill_id>/',                  views.admin_skill_detail,       name='admin_skill_detail'),
    path('admin/reports/',                                views.admin_reports,            name='admin_reports'),
    path('admin/placement-analytics/',                    views.placement_analytics,      name='placement_analytics'),
    path('admin/students/recommendations/',               views.admin_student_recommendations, name='admin_student_recommendations'),
    path('admin/rerun-recommendations/',                   views.admin_rerun_recommendations,   name='admin_rerun_recommendations'),
    path('admin/nlp-configuration/',                       views.admin_nlp_configuration,       name='admin_nlp_configuration'),

    # OJT Placements (admin system-wide; instructors scoped to their batches)
    path('placements/suggestions/',   views.placement_suggestions,   name='placement_suggestions'),
    path('placements/reports/',       views.placement_reports,       name='placement_reports'),
    path('placements/',               views.placement_history,       name='placement_history'),
    path('placements/draft/',         placement_draft, name='placement_draft'),
    path('placements/approve/',       views.placement_approve,       name='placement_approve'),
    path('placements/remove/',        views.placement_remove,        name='placement_remove'),
    path('placements/reject/',        views.placement_reject,        name='placement_reject'),
    path('placements/manual-assign/', views.placement_manual_assign, name='placement_manual_assign'),

    # ── Admin — Real-time SSE ─────────────────────────────────────────────────
    # EventSource connects here with ?token=<jwt>
    # Streams data-change events so the frontend re-fetches stale cache keys.
    path('admin/events/',                                 admin_events,                   name='admin_events'),

    # ── Instructor — Real-time SSE ────────────────────────────────────────────
    # Fires when students submit assessments or student roster changes.
    path('instructor/events/', instructor_events, name='instructor_events'),
    path('student/events/', student_events, name='student_events'),
]
