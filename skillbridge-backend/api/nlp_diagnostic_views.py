"""Read-only staff explainability endpoints; no assessment answers are queried."""
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (BatchEnrollment, Position, SkillCategory, SkillScore,
                     StudentCompetencyProfile, StudentResponse, User)
from .recommendation_nlp import build_position_description, generate_competency_insights, TEXT_GENERATION_VERSION
from .skill_taxonomy import taxonomy_diagnostics


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def taxonomy_quality(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    return Response(taxonomy_diagnostics(SkillCategory.objects.order_by('id')))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_nlp_text(request, student_id):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Staff only'}, status=403)
    if request.user.role == 'instructor' and not BatchEnrollment.objects.filter(
            student_id=student_id, batch__instructor=request.user).exists():
        return Response({'error': 'Student is outside your batches.'}, status=403)
    get_object_or_404(User, pk=student_id, role='student')
    responses = StudentResponse.objects.filter(student_id=student_id, status='submitted', submitted_at__isnull=False)
    if request.user.role == 'instructor':
        responses = responses.filter(assessment__batch__instructor=request.user)
    assessment_id = request.query_params.get('assessment_id')
    if assessment_id:
        try:
            responses = responses.filter(assessment_id=int(assessment_id))
        except (ValueError, TypeError):
            return Response({'error': 'assessment_id must be an integer.'}, status=400)
    response = responses.order_by('-submitted_at', '-id').first()
    if not response:
        return Response({'status': 'empty', 'message': 'No submitted assessment is available within your access scope.'})
    profile = StudentCompetencyProfile.objects.filter(student_id=student_id, assessment_id=response.assessment_id).first()
    scores = list(SkillScore.objects.filter(student_id=student_id, assessment_id=response.assessment_id).select_related('skill_category'))
    return Response({'status': 'available', 'assessment_id': response.assessment_id,
        'text_generation_version': TEXT_GENERATION_VERSION,
        'texts': [
            {'label': 'Saved generated competency profile', 'text': profile.competency_profile_text if profile else '',
             'note': f'Saved on {profile.generated_at.isoformat()}. It may predate current tags or text generation.' if profile else 'No saved profile exists.'},
            {'label': 'Current competency profile preview',
             'text': generate_competency_insights(scores)['competency_profile_text'] if scores else '',
             'note': 'Generated from current saved category scores and tags. Not saved; recommendations are unchanged.'}],
        'note': 'Diagnostic inputs for NLP fit, not model accuracy. Category vocabulary does not verify each subskill. No question or answer content is included.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def position_nlp_text(request, position_id):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Staff only'}, status=403)
    position = get_object_or_404(Position.objects.select_related('company').prefetch_related('requirements__skill_category'), pk=position_id)
    return Response({'status': 'available', 'text_generation_version': TEXT_GENERATION_VERSION,
        'texts': [{'label': 'Current position NLP description', 'text': build_position_description(position),
                   'note': 'Generated on demand from saved requirements and tags; not stored. Earlier recommendation inputs may differ.'}],
        'note': 'Read-only diagnostic text used as input for NLP fit/text similarity. No assessment questions or answers are queried.'})
