from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
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

    def save(self, *args, **kwargs):
        if self.name:
            self.name = self.name.title()
        super().save(*args, **kwargs)

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
    tags        = models.JSONField(default=list, blank=True)
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
    TYPE_CHOICES = [
        ('mcq',            'Multiple Choice'),
        ('truefalse',      'True/False'),
        ('identification', 'Identification'),
    ]

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
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_SUBMITTED = 'submitted'
    STATUS_STOPPED = 'stopped'
    STATUS_CHOICES = [
        (STATUS_IN_PROGRESS, 'In progress'),
        (STATUS_SUBMITTED, 'Submitted'),
        (STATUS_STOPPED, 'Stopped'),
    ]

    student         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='responses')
    assessment      = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name='responses')
    started_at      = models.DateTimeField(null=True, blank=True)   # set on first question load (timer anti-cheat)
    submitted_at    = models.DateTimeField(null=True, blank=True)   # set on submit (null = in progress)
    retake_allowed  = models.BooleanField(default=False)
    question_layout = models.JSONField(default=dict, blank=True)
    status                  = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    stopped_reason          = models.CharField(max_length=50, blank=True, default='')
    stopped_reason_display  = models.CharField(max_length=255, blank=True, default='')
    stopped_at              = models.DateTimeField(null=True, blank=True)
    violation_count         = models.PositiveIntegerField(default=0)
    violation_events        = models.JSONField(default=list, blank=True)
    is_flagged              = models.BooleanField(default=False)

    class Meta:
        unique_together = ('student', 'assessment')

    def __str__(self):
        return f'{self.student.name} → {self.assessment.title}'


# ── Response Answer (one per question per response) ───────────────────────────
class ResponseAnswer(models.Model):
    response        = models.ForeignKey(StudentResponse, on_delete=models.CASCADE, related_name='answers')
    question        = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_choice = models.ForeignKey(AnswerChoice, on_delete=models.SET_NULL, null=True, blank=True)
    text_answer     = models.TextField(blank=True, default='')     # used for identification questions


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


class StudentCompetencyProfile(models.Model):
    """Auditable, assessment-level narrative shared by authorized views."""

    student                 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='competency_profiles')
    assessment              = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name='competency_profiles')
    orientation_label       = models.CharField(max_length=160, blank=True, default='')
    orientation_summary     = models.TextField(blank=True, default='')
    competency_profile_text = models.TextField(blank=True, default='')
    development_suggestions = models.JSONField(default=list, blank=True)
    supporting_categories   = models.JSONField(default=list, blank=True)
    generated_at            = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'assessment')

    def __str__(self):
        return f'{self.student.name} — {self.orientation_label}'


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
    tags            = models.JSONField(default=list, blank=True)

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
    category_score_component = models.FloatField(default=0.0)
    nlp_score_component      = models.FloatField(default=0.0)
    location_score_component = models.FloatField(default=0.0)
    model_used               = models.CharField(max_length=40, blank=True, default='')
    distance_km              = models.FloatField(blank=True, null=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-match_score']
        unique_together = ('student', 'position')

    def __str__(self):
        return f'{self.student.name} → {self.position.title} ({self.match_score:.0%})'


# ── OJT Placement ───────────────────────────────────────────────────────────────────────────
class OJTPlacement(models.Model):
    STATUS_SUGGESTED = 'suggested'
    STATUS_APPROVED = 'approved'
    STATUS_REMOVED = 'removed'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_SUGGESTED, 'Suggested'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REMOVED, 'Removed'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    student = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name='ojt_placements',
    )
    company = models.ForeignKey(
        Company, on_delete=models.PROTECT, related_name='ojt_placements',
    )
    position = models.ForeignKey(
        Position, on_delete=models.PROTECT, related_name='ojt_placements',
    )
    recommendation = models.ForeignKey(
        Recommendation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ojt_placements',
    )
    batch = models.ForeignKey(
        Batch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ojt_placements',
    )

    # These values are snapshots. Later recommendation recalculation must not
    # alter the evidence used when this placement decision was made.
    match_score_at_assignment = models.FloatField(null=True, blank=True)
    category_score_component_at_assignment = models.FloatField(null=True, blank=True)
    nlp_score_component_at_assignment = models.FloatField(null=True, blank=True)
    location_score_component_at_assignment = models.FloatField(null=True, blank=True)
    distance_km_at_assignment = models.FloatField(null=True, blank=True)

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_SUGGESTED,
    )
    remarks = models.TextField(blank=True, default='')
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ojt_assignments_made',
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ojt_placements_approved',
    )
    removed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ojt_placements_removed',
    )
    rejected_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ojt_placements_rejected',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    removed_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-updated_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['student'],
                condition=models.Q(status='approved'),
                name='unique_approved_placement_per_student',
            ),
        ]
        indexes = [
            models.Index(fields=['position', 'status'], name='ojt_pos_status_idx'),
            models.Index(fields=['student', 'status'], name='ojt_student_status_idx'),
        ]

    def clean(self):
        errors = {}
        if self.student_id and self.student.role != 'student':
            errors['student'] = 'OJT placements can only be created for students.'
        if self.position_id and self.company_id and self.position.company_id != self.company_id:
            errors['company'] = 'Company must match the selected position.'
        if self.recommendation_id:
            if self.recommendation.student_id != self.student_id:
                errors['recommendation'] = 'Recommendation must belong to the selected student.'
            elif self.recommendation.position_id != self.position_id:
                errors['recommendation'] = 'Recommendation must belong to the selected position.'
        if self.batch_id and self.student_id and not BatchEnrollment.objects.filter(
            batch_id=self.batch_id, student_id=self.student_id,
        ).exists():
            errors['batch'] = 'Student is not enrolled in the selected batch.'
        if errors:
            raise ValidationError(errors)

    def copy_recommendation_snapshot(self, recommendation):
        self.recommendation = recommendation
        self.match_score_at_assignment = recommendation.match_score
        self.category_score_component_at_assignment = recommendation.category_score_component
        self.nlp_score_component_at_assignment = recommendation.nlp_score_component
        self.location_score_component_at_assignment = recommendation.location_score_component
        self.distance_km_at_assignment = recommendation.distance_km

    def __str__(self):
        return f'{self.student.name} → {self.position.title} ({self.status})'


class RecommendationConfiguration(models.Model):
    """Singleton-style configuration for the active NLP preprocessor."""

    MODEL_CHOICES = [
        ('spacy_sm', 'spaCy Small (en_core_web_sm)'),
        ('spacy_md', 'spaCy Medium (en_core_web_md)'),
        ('stanza_en', 'Stanza English'),
    ]

    active_model = models.CharField(max_length=20, choices=MODEL_CHOICES, default='spacy_md')
    updated_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    updated_at   = models.DateTimeField(auto_now=True)

    @classmethod
    def get_active(cls):
        config, _ = cls.objects.get_or_create(pk=1, defaults={'active_model': 'spacy_md'})
        return config

    def __str__(self):
        return f'Active recommendation NLP model: {self.get_active_model_display()}'
