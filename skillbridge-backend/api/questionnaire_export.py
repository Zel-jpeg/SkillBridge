"""Export saved authoring questions within the existing staff access boundary."""

import hashlib
import json
import re

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .assessment_layout import ordered_choices, ordered_questions
from .management_access import managed_assessments


LETTERS = 'ABCD'
LINE_BREAK = re.compile(r'[\r\n\u2028\u2029]')
AIKEN_STEM_MARKER = re.compile(r'^(?:[A-Z][.)](?:\s|$)|ANSWER\s*:)', re.I)
RICH_CONTENT = re.compile(r'!\[[^\]]*\]\(|<(?:img|svg|picture|audio|video|iframe|table|object|math|script)\b|\[\[(?:image|file):', re.I)


def export_question(question, file_format):
    kind = question.question_type
    if file_format == 'aiken' and kind != 'mcq':
        return None, 'AIKEN supports multiple choice questions.'
    if kind not in ('mcq', 'truefalse', 'identification'):
        return None, 'This question type is unsupported.'

    stem = question.question_text.strip()
    choices = list(question.choices.all()) if kind == 'identification' else ordered_choices(question, None)
    texts = [choice.choice_text.strip() for choice in choices]
    keys = [index for index, choice in enumerate(choices) if choice.is_correct]
    if not stem or not all(texts) or len(keys) != 1:
        return None, 'Question text, answer text and one correct key are required.'
    key = keys[0]
    if kind == 'mcq' and not 2 <= len(choices) <= len(LETTERS):
        return None, 'SkillBridge supports two to four multiple choice options.'
    if kind == 'truefalse' and [text.casefold() for text in texts] != ['true', 'false']:
        return None, 'A true/false question needs exactly one True and one False option.'
    if kind == 'identification' and len(choices) != 1:
        return None, 'Identification needs one saved grading answer.'

    if file_format == 'aiken':
        if AIKEN_STEM_MARKER.match(stem) or any(LINE_BREAK.search(text) or RICH_CONTENT.search(text) for text in [stem, *texts]):
            return None, 'The question and choices must fit the single-line AIKEN format.'
        options = [f'{letter}. {text}' for letter, text in zip(LETTERS, texts)]
        return '\n'.join([stem, *options, f'ANSWER: {LETTERS[key]}']), None

    category = question.skill_category.name.strip() if question.skill_category else ''
    if not category:
        return None, 'Assign a saved skill category to include this question in SkillBridge text.'
    answer = LETTERS[key] if kind == 'mcq' else texts[key]
    fields = [('QUESTION', stem), *list(zip(LETTERS, texts if kind == 'mcq' else [])),
              ('CORRECT', answer), ('CATEGORY', category)]
    encoded = any(LINE_BREAK.search(value) for _, value in fields)
    lines = [f'TYPE: {kind}']
    if encoded:
        lines.append('ENCODING: JSON')
    lines.extend(f'{name}: {json.dumps(value) if encoded else value}' for name, value in fields)
    return '\n'.join(lines), None


@never_cache
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def questionnaire_export(request, assessment_id):
    queryset = managed_assessments(request.user)
    # The same assessment row lock guards saved question changes. The download
    # comes from the exact snapshot reviewed by the staff member.
    assessment = get_object_or_404(queryset.select_for_update(of=('self',)), pk=assessment_id)
    file_format = request.query_params.get('file_format', 'aiken')
    if file_format not in ('aiken', 'native'):
        return Response({'error': 'Choose AIKEN or SkillBridge text.'}, status=400)

    questions = ordered_questions(assessment, None)
    blocks, omitted = [], []
    for number, question in enumerate(questions, start=1):
        block, reason = export_question(question, file_format)
        if reason:
            omitted.append({'number': number, 'reason': reason})
        else:
            blocks.append(block)

    filename = f'skillbridge-assessment-{assessment.pk}-{file_format}.txt'
    separator = '\n\n' if file_format == 'aiken' else '\n\n---\n\n'
    content = (separator.join(blocks) + '\n').encode('utf-8') if blocks else b''
    revision = hashlib.sha256(json.dumps([filename, omitted]).encode('utf-8') + b'\0' + content).hexdigest()
    if request.query_params.get('download') != '1':
        return Response({'total': len(questions), 'included': len(blocks), 'omitted': omitted,
                         'revision': revision, 'filename': filename})
    if request.query_params.get('revision') != revision:
        return Response({'error': 'Review the current questionnaire before downloading.'}, status=409)
    if not blocks:
        return Response({'error': 'No questions can be exported in this format.'}, status=409)
    if omitted and request.query_params.get('allow_partial') != '1':
        return Response({'error': 'Confirm the supported subset before downloading.'}, status=409)
    response = HttpResponse(content, content_type='text/plain; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
