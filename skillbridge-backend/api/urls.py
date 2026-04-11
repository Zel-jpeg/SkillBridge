from django.urls import path
from . import views

urlpatterns = [
    path('auth/login/',          views.login,          name='login'),
    path('auth/refresh/',        views.refresh,        name='refresh'),
    path('auth/me/',             views.me,             name='me'),
    path('auth/google/',         views.google_login,   name='google_login'),         
    path('students/me/profile/', views.student_profile, name='student_profile'),
    path('students/me/',         views.student_me,     name='student_me'), 
]