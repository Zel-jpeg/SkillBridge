from django.urls import path
from . import views
from .sse import admin_events, instructor_events   # ← SSE views

urlpatterns = [
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
    path('student/results/review/',   views.student_results_review, name='student_results_review'),
    path('student/companies/',        views.student_companies,      name='student_companies'),

    # ── Skill Categories (shared) ─────────────────────────────────────────────
    path('categories/',               views.categories,              name='categories'),
    path('categories/suggest/',       views.suggest_category_view,   name='suggest_category'),

    # ── Instructor — Batches ──────────────────────────────────────────────────
    path('instructor/batches/',                           views.instructor_batches,         name='instructor_batches'),
    path('instructor/batches/<int:batch_id>/enroll/',     views.instructor_batch_enroll,    name='instructor_batch_enroll'),
    path('instructor/batches/<int:batch_id>/students/',   views.instructor_batch_students,  name='instructor_batch_students'),
    path('instructor/batches/<int:batch_id>/archive/',    views.instructor_batch_archive,   name='instructor_batch_archive'),
    path('instructor/students/<int:student_id>/retake/',  views.instructor_student_retake,  name='instructor_student_retake'),
    path('instructor/students/<int:student_id>/',         views.instructor_student_remove,  name='instructor_student_remove'),

    # ── Instructor — Assessments ──────────────────────────────────────────────
    path('instructor/assessments/',                                   views.instructor_assessments,           name='instructor_assessments'),
    path('instructor/assessments/<int:assessment_id>/',               views.instructor_assessment_detail,     name='instructor_assessment_detail'),
    path('instructor/assessments/<int:assessment_id>/questions/',     views.instructor_assessment_questions,  name='instructor_assessment_questions'),
    path('instructor/questions/<int:question_id>/', views.instructor_question_detail, name='instructor_question_detail'),

    # ── Instructor — Recommendations ──────────────────────────────────────────
    path('instructor/students/recommendations/', views.instructor_student_recommendations, name='instructor_student_recommendations'),

    # ── Instructor — Companies (view + edit) ──────────────────────────────────
    path('instructor/companies/',              views.instructor_companies,      name='instructor_companies'),
    path('instructor/companies/<int:co_id>/',  views.instructor_company_edit,   name='instructor_company_edit'),

    # ── Student — Assessment Flow ─────────────────────────────────────────────
    path('assessments/active/',                  views.assessment_active,  name='assessment_active'),
    path('assessments/<int:assessment_id>/start/',  views.assessment_start,   name='assessment_start'),
    path('assessments/<int:assessment_id>/submit/', views.assessment_submit,  name='assessment_submit'),
    path('instructor/assessments/<int:assessment_id>/questions/add/', views.instructor_assessment_add_questions, name='instructor_assessment_add_questions'),

    

    # ── Admin ─────────────────────────────────────────────────────────────────
    path('admin/stats/',                                  views.admin_stats,              name='admin_stats'),
    path('admin/users/',                                  views.admin_users,              name='admin_users'),
    path('admin/instructors/',                            views.admin_instructors,        name='admin_instructors'),
    path('admin/instructors/<int:user_id>/approve/',      views.admin_approve_instructor, name='admin_approve_instructor'),
    path('admin/companies/',                              views.admin_companies,          name='admin_companies'),
    path('admin/companies/<int:company_id>/',             views.admin_company_detail,     name='admin_company_detail'),
    path('admin/companies/<int:company_id>/positions/',   views.admin_company_positions,  name='admin_company_positions'),
    path('admin/positions/<int:position_id>/',            views.admin_position_detail,    name='admin_position_detail'),
    path('admin/students/recommendations/',               views.admin_student_recommendations, name='admin_student_recommendations'),
    path('admin/rerun-recommendations/',                   views.admin_rerun_recommendations,   name='admin_rerun_recommendations'),

    # ── Admin — Real-time SSE ─────────────────────────────────────────────────
    # EventSource connects here with ?token=<jwt>
    # Streams data-change events so the frontend re-fetches stale cache keys.
    path('admin/events/',                                 admin_events,                   name='admin_events'),

    # ── Instructor — Real-time SSE ────────────────────────────────────────────
    # Fires when students submit assessments or student roster changes.
    path('instructor/events/', instructor_events, name='instructor_events'),
]