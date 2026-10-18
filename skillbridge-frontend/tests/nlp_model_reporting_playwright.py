"""Synthetic result states show actual model output rather than configured intent."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ARTIFACTS = Path(__file__).parent / 'artifacts/nlp-model-reporting'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for actual, label in [('', 'No model result available'), ('simple_fallback', 'simple_fallback')]:
            context = browser.new_context(viewport={'width': 1280, 'height': 900})
            user = {'id': 1, 'name': 'Synthetic Student', 'role': 'student', 'is_approved': True, 'course': 'BSIT', 'school_id': 'SYNTH-1'}
            values = {'sb-token': 'synthetic', 'sb-user': json.dumps(user), 'sb-role': 'student'}
            context.add_init_script('for (const [k,v] of Object.entries(' + json.dumps(values) + ')) localStorage.setItem(k,v)')
            result = {'recommendations_locked': False, 'combined_category_scores': [], 'recommendations': [],
                      'active_model': 'spacy_md', 'model_used': actual, 'included_assessments': [], 'competency_profile': None}
            def route_request(route):
                path = urlparse(route.request.url).path
                if urlparse(route.request.url).hostname not in ['127.0.0.1', 'localhost']:
                    return route.abort()
                if path.endswith('/events/'):
                    return route.fulfill(status=204)
                if path == '/api/student/results/combined/':
                    return route.fulfill(json=result)
                if path == '/api/students/me/':
                    return route.fulfill(json=user)
                if path.startswith('/api/'):
                    return route.fulfill(json=[])
                return route.continue_()
            context.route('**/*', route_request)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('http://127.0.0.1:5178/student/results')
            expect(page.get_by_text('Model used: ' + label, exact=False)).to_be_visible(timeout=15000)
            checks.append('Missing actual model is explicit' if not actual else 'Actual fallback shown instead of selected spacy_md')
            page.screenshot(path=str(ARTIFACTS / ('empty.png' if not actual else 'fallback.png')), full_page=True)
            context.close()
        assert not errors, errors
    finally:
        (ARTIFACTS / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
        print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
        browser.close()
