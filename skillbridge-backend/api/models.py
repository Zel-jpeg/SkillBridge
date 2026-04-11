from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


# ── User Manager ────────────────────────────────────────────────────────────
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


# ── User ────────────────────────────────────────────────────────────────────
class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('student',    'Student'),
        ('instructor', 'Instructor'),
        ('admin',      'Admin'),
    ]

    email        = models.EmailField(unique=True)
    name         = models.CharField(max_length=255)
    role         = models.CharField(max_length=20, choices=ROLE_CHOICES)
    school_id = models.CharField(max_length=20, blank=True, default='')
    course       = models.CharField(max_length=100, blank=True)
    phone        = models.CharField(max_length=20, blank=True)
    address      = models.JSONField(blank=True, null=True)
    photo_url    = models.TextField(blank=True)
    is_approved  = models.BooleanField(default=False)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    # ↓ These two lines fix the clash
    groups = models.ManyToManyField(
        'auth.Group', blank=True, related_name='api_users'
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission', blank=True, related_name='api_users'
    )

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['name', 'role']

    def __str__(self):
        return f'{self.name} ({self.role})'
# ── Batch ────────────────────────────────────────────────────────────────────
class Batch(models.Model):
    STATUS_CHOICES = [('active', 'Active'), ('archived', 'Archived')]

    name        = models.CharField(max_length=100)               # e.g. "AY 2025-2026"
    instructor  = models.ForeignKey(User, on_delete=models.CASCADE, related_name='batches')
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    archived_at = models.DateTimeField(blank=True, null=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ── Batch Enrollment (Student ↔ Batch) ───────────────────────────────────────
class BatchEnrollment(models.Model):
    batch   = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='enrollments')
    student = models.ForeignKey(User,  on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('batch', 'student')


# ── Skill Category ───────────────────────────────────────────────────────────
class SkillCategory(models.Model):
    name        = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ── Assessment ───────────────────────────────────────────────────────────────
class Assessment(models.Model):
    title            = models.CharField(max_length=255)
    created_by       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assessments')
    batch            = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


# ── Question ─────────────────────────────────────────────────────────────────
class Question(models.Model):
    TYPE_CHOICES = [('mcq', 'Multiple Choice'), ('truefalse', 'True/False')]

    assessment      = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name='questions')
    skill_category  = models.ForeignKey(SkillCategory, on_delete=models.SET_NULL, null=True)
    question_text   = models.TextField()
    question_type   = models.CharField(max_length=20, choices=TYPE_CHOICES, default='mcq')
    question_order  = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['question_order']

    def __str__(self):
        return f'Q{self.question_order}: {self.question_text[:60]}'


# ── Answer Choice ─────────────────────────────────────────────────────────────
class AnswerChoice(models.Model):
    question    = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='choices')
    choice_text = models.TextField()
    is_correct  = models.BooleanField(default=False)

    def __str__(self):
        return f'{"✓" if self.is_correct else "✗"} {self.choice_text[:60]}'


# ── Student Response (one per student per assessment) ────────────────────────
class StudentResponse(models.Model):
    student         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='responses')
    assessment      = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name='responses')
    submitted_at    = models.DateTimeField(auto_now_add=True)
    retake_allowed  = models.BooleanField(default=False)

    class Meta:
        unique_together = ('student', 'assessment')

    def __str__(self):
        return f'{self.student.name} → {self.assessment.title}'


# ── Response Answer (one per question per response) ───────────────────────────
class ResponseAnswer(models.Model):
    response        = models.ForeignKey(StudentResponse, on_delete=models.CASCADE, related_name='answers')
    question        = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_choice = models.ForeignKey(AnswerChoice, on_delete=models.SET_NULL, null=True)


# ── Skill Score (auto-computed after submit) ──────────────────────────────────
class SkillScore(models.Model):
    student        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='skill_scores')
    assessment     = models.ForeignKey(Assessment, on_delete=models.CASCADE)
    skill_category = models.ForeignKey(SkillCategory, on_delete=models.CASCADE)
    raw_score      = models.PositiveIntegerField(default=0)
    max_score      = models.PositiveIntegerField(default=0)
    percentage     = models.FloatField(default=0.0)

    class Meta:
        unique_together = ('student', 'assessment', 'skill_category')


# ── Company ───────────────────────────────────────────────────────────────────
class Company(models.Model):
    name         = models.CharField(max_length=255)
    address      = models.JSONField(blank=True, null=True)   # { province, city, barangay }
    location_lat = models.FloatField(blank=True, null=True)
    location_lng = models.FloatField(blank=True, null=True)
    added_by     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ── Position ──────────────────────────────────────────────────────────────────
class Position(models.Model):
    company         = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='positions')
    title           = models.CharField(max_length=255)
    slots_available = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f'{self.title} @ {self.company.name}'


# ── Position Requirement ──────────────────────────────────────────────────────
class PositionRequirement(models.Model):
    position            = models.ForeignKey(Position, on_delete=models.CASCADE, related_name='requirements')
    skill_category      = models.ForeignKey(SkillCategory, on_delete=models.CASCADE)
    required_percentage = models.FloatField(default=0.0)

    class Meta:
        unique_together = ('position', 'skill_category')


# ── Recommendation ────────────────────────────────────────────────────────────
class Recommendation(models.Model):
    student      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recommendations')
    position     = models.ForeignKey(Position, on_delete=models.CASCADE)
    match_score  = models.FloatField(default=0.0)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-match_score']

    def __str__(self):
        return f'{self.student.name} → {self.position.title} ({self.match_score:.0%})'