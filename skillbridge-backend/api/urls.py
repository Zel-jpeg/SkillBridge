from django.urls import path
from . import views

urlpatterns = [
    # ── Auth ─────────────────────────────────────────────────────────────────
    path('auth/login/',          views.login,           name='login'),
    path('auth/refresh/',        views.refresh,         name='refresh'),
    path('auth/me/',             views.me,              name='me'),
    path('auth/google/',         views.google_login,    name='google_login'),
    path('auth/register-role/',  views.register_role,   name='register_role'),

    # ── Student ───────────────────────────────────────────────────────────────
    path('students/me/',              views.student_me,      name='student_me'),
    path('students/me/profile/',      views.student_profile, name='student_profile'),
    path('student/results/',          views.student_results, name='student_results'),

    # ── Skill Categories (shared) ─────────────────────────────────────────────
    path('categories/',               views.categories,              name='categories'),
    path('categories/suggest/',       views.suggest_category_view,   name='suggest_category'),

    # ── Instructor — Batches ──────────────────────────────────────────────────
    path('instructor/batches/',                           views.instructor_batches,         name='instructor_batches'),
    path('instructor/batches/<int:batch_id>/enroll/',     views.instructor_batch_enroll,    name='instructor_batch_enroll'),
    path('instructor/batches/<int:batch_id>/students/',   views.instructor_batch_students,  name='instructor_batch_students'),

    # ── Instructor — Assessments ──────────────────────────────────────────────
    path('instructor/assessments/',                                   views.instructor_assessments,           name='instructor_assessments'),
    path('instructor/assessments/<int:assessment_id>/',               views.instructor_assessment_detail,     name='instructor_assessment_detail'),
    path('instructor/assessments/<int:assessment_id>/questions/',     views.instructor_assessment_questions,  name='instructor_assessment_questions'),

    # ── Instructor — Recommendations ──────────────────────────────────────────
    path('instructor/students/recommendations/', views.instructor_student_recommendations, name='instructor_student_recommendations'),

    # ── Student — Assessment Flow ─────────────────────────────────────────────
    path('assessments/active/',                  views.assessment_active,  name='assessment_active'),
    path('assessments/<int:assessment_id>/start/',  views.assessment_start,   name='assessment_start'),
    path('assessments/<int:assessment_id>/submit/', views.assessment_submit,  name='assessment_submit'),

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
]