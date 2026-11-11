from collections.abc import Mapping

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import RecommendationConfiguration
from .nlp_evaluation import DatasetError, run_comparison


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_nlp_model_comparison(request):
    # Admin-only first release; matches existing NLP configuration permissions.
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    parameters = request.query_params if request.method == 'GET' else request.data
    if not isinstance(parameters, Mapping):
        return Response({'error': 'Comparison parameters must be an object.'}, status=400)
    # The shared authenticated GET cache appends _t on background revalidation.
    # It is transport metadata, never an evaluation input or a POST parameter.
    allowed = {'mode', 'program_scope', '_t'} if request.method == 'GET' else {'mode', 'program_scope'}
    if set(parameters) - allowed:
        return Response({'error': 'Only mode and program_scope comparison parameters are supported.'}, status=400)
    if hasattr(parameters, 'getlist') and any(len(parameters.getlist(key)) != 1 for key in parameters):
        return Response({'error': 'Comparison parameters must have one value each.'}, status=400)
    mode = parameters.get('mode', 'workflow_simulation')
    program_scope = parameters.get('program_scope', 'all')
    if not isinstance(mode, str) or not isinstance(program_scope, str):
        return Response({'error': 'mode and program_scope must be strings.'}, status=400)
    try:
        if request.method == 'GET':
            if mode != 'workflow_simulation':
                raise ValueError('Coverage is available for workflow_simulation')
            from .nlp_workflow_evaluation import workflow_coverage
            return Response(workflow_coverage(program_scope, balanced_subset=True))
        if mode == 'workflow_simulation':
            from .nlp_workflow_evaluation import run_workflow_comparison
            result = run_workflow_comparison(program_scope, balanced_subset=True)
        else:
            result = run_comparison(mode, program_scope)
    except DatasetError as exc:
        return Response({'status': 'dataset_error', 'error': str(exc)}, status=503)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=400)
    # Read configuration without get_active(): that helper may create a row.
    result['active_model'] = (RecommendationConfiguration.objects.filter(pk=1)
        .values_list('active_model', flat=True).first() or 'spacy_md')
    result['evaluated_at'] = timezone.now().isoformat()
    return Response(result)
