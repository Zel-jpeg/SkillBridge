from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import RecommendationConfiguration
from .nlp_evaluation import DatasetError, run_comparison


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_nlp_model_comparison(request):
    # Admin-only first release; matches existing NLP configuration permissions.
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    mode = request.data.get('mode', 'evaluation_dataset')
    try:
        result = run_comparison(mode)
    except DatasetError as exc:
        return Response({'status': 'dataset_error', 'error': str(exc)}, status=503)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=400)
    # Read configuration without get_active(): that helper may create a row.
    result['active_model'] = (RecommendationConfiguration.objects.filter(pk=1)
        .values_list('active_model', flat=True).first() or 'spacy_md')
    result['evaluated_at'] = timezone.now().isoformat()
    return Response(result)
