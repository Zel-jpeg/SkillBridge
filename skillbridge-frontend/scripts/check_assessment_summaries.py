"""Synthetic browser checks against a running Vite server (no live API calls).

Run with the backend venv Python; requires Playwright and installed Edge.
"""
import json
import argparse
import mimetypes
import subprocess
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-results' / 'assessment-summaries'
HARNESS = ROOT / '.assessment-summary-check.jsx'
ENTRY = ROOT / '.assessment-summary-check.html'
OUTPUT.mkdir(parents=True, exist_ok=True)
SCORES = [dict(category=name, percentage=percentage, raw_score=percentage, max_score=100)
          for name, percentage in [('Database Management', 100), ('Networking', 100),
                                   ('Web Development', 100), ('Programming', 50)]]
HARNESS_SOURCE = '''import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { SessionProvider } from '/src/context/SessionContext.jsx'
import { ToastProvider } from '/src/context/ToastContext.jsx'
import StudentResults from '/src/pages/student/StudentResults.jsx'
import StudentDashboard from '/src/pages/student/StudentDashboard.jsx'
import StudentDetailModal from '/src/components/StudentDetailModal.jsx'
import CompetencyInsights from '/src/components/CompetencyInsights.jsx'
import '/src/index.css'
const view = new URLSearchParams(location.search).get('view')
const scores = window.syntheticScores
const student = { name: 'Synthetic Student', email: 'synthetic@example.test', studentId: 'TEST-1',
  batch: { name: 'Synthetic batch' }, recommendationsLocked: window.syntheticLocked,
  combinedCategoryScores: scores, completedRequiredCount: 1, totalRequiredCount: 1,
  combinedCompetencyProfile: { orientation_label: 'Old misleading orientation', orientation_summary: 'Old summary' },
  assessmentResults: [{ id: 1, title: 'Synthetic assessment', attempt_status: 'submitted', category_scores: scores }] }
createRoot(document.getElementById('root')).render(<MemoryRouter><ToastProvider><SessionProvider>
  {view === 'dashboard' ? <StudentDashboard /> : view === 'student' ? <StudentResults /> : view === 'staff' ? <StudentDetailModal student={student} onClose={() => {}} readOnly />
    : <main className="mx-auto max-w-5xl p-4"><CompetencyInsights scores={scores} locked={window.syntheticLocked} /></main>}
</SessionProvider></ToastProvider></MemoryRouter>)
'''
HTML = '''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body { margin: 0; background: #f9fafb; } .dark body { background: #030712; }</style></head>
<body><div id="root"></div><script type="module" src="/.assessment-summary-check.jsx"></script></body></html>'''


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--themes', nargs='+', default=['light', 'dark'])
    parser.add_argument('--widths', nargs='+', type=int, default=[375, 768, 1280])
    parser.add_argument('--views', nargs='+', default=['student', 'staff', 'component', 'dashboard'])
    args = parser.parse_args()
    HARNESS.write_text(HARNESS_SOURCE, encoding='utf-8')
    ENTRY.write_text(HTML, encoding='utf-8')
    preview = OUTPUT / 'preview'
    # Bundle the real components/styles, avoiding development HMR transport noise.
    build_script = ('import { build } from "vite"; await build({build:{outDir:'
                    + json.dumps(str(preview)) + ',emptyOutDir:true,rollupOptions:{input:'
                    + json.dumps(str(ENTRY)) + '}}});')
    subprocess.run(['node', '--input-type=module', '-e', build_script], cwd=ROOT,
                   check=True, capture_output=True, text=True)
    preview_html = (preview / ENTRY.name).read_text(encoding='utf-8')
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        errors = []
        checks = 0
        try:
            for theme in args.themes:
                for width in args.widths:
                    for view in args.views:
                        context = browser.new_context(viewport={'width': width, 'height': 900})
                        page = context.new_page()
                        page.on('pageerror', lambda error: errors.append(error.stack) if len(errors) < 3 else None)
                        fixture_state = {'scores': SCORES, 'locked': False}

                        def route(request):
                            url = urlparse(request.request.url)
                            if url.path == '/__assessment_summary_check':
                                setup = (f'<script>window.syntheticScores = {json.dumps(fixture_state["scores"])};'
                                         f'window.syntheticLocked = {json.dumps(fixture_state["locked"])};'
                                         f'document.documentElement.classList.toggle("dark", {json.dumps(theme)} === "dark");</script>')
                                request.fulfill(content_type='text/html', body=preview_html.replace('<body>', '<body>' + setup))
                            elif url.path.startswith('/assets/'):
                                asset = preview / 'assets' / Path(url.path).name
                                request.fulfill(body=asset.read_bytes(), content_type=mimetypes.guess_type(asset)[0] or 'application/octet-stream')
                            elif url.path.startswith('/api/'):
                                data = ({'recommendations_locked': False, 'combined_category_scores': SCORES,
                                         'overall_percentage': 90, 'all_required_completed': True,
                                         'combined_competency_profile': {'orientation_label': 'Old misleading orientation'},
                                         'recommendations': [], 'included_assessments': [], 'placement': {'status': 'unplaced'}}
                                        if '/results/combined/' in url.path else
                                        {'school_id': 'TEST-1', 'course': 'BSIT', 'address': {}} if '/students/me/' in url.path else [])
                                request.fulfill(json=data, headers={'Access-Control-Allow-Origin': '*'})
                            elif url.hostname in ('127.0.0.1', 'localhost'):
                                request.continue_()
                            else:
                                request.abort()  # No CDN, map tiles, personal data or external API access.

                        page.route('**/*', route)
                        page.goto(f'http://127.0.0.1:5173/__assessment_summary_check?view={view}')
                        page.wait_for_load_state('networkidle')
                        assert not errors, errors
                        assert page.evaluate('document.documentElement.classList.contains("dark")') == (theme == 'dark')
                        if view == 'staff':
                            page.get_by_role('tab', name='Combined competency').click()
                        if view == 'dashboard':
                            score = page.get_by_text('Overall skill score', exact=True)
                            expect(score).to_be_visible()
                            card = score.locator('../..')
                            expect(card.get_by_text('90', exact=True)).to_be_visible()
                            expect(card.get_by_text('Database Management · Networking · Web Development', exact=True)).to_be_visible()
                            expect(card.get_by_text('Highest-scoring areas: tied at 100%', exact=True)).to_be_visible()
                            assert card.evaluate('(el) => el.scrollWidth <= el.clientWidth')
                            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                            page.screenshot(path=str(OUTPUT / f'{view}-{theme}-{width}.png'), full_page=True)
                            checks += 1
                            print(f'Checked {view}, {theme}, {width}px', flush=True)
                            context.close()
                            continue
                        section = page.get_by_role('region', name='Combined assessment interpretation')
                        expect(section).to_be_visible()
                        toggle = section.locator('summary')
                        assert section.locator('details').get_attribute('open') is None
                        expect(section.get_by_role('heading', name='Assessment summary', exact=True)).to_be_hidden()
                        page.screenshot(path=str(OUTPUT / f'collapsed-{view}-{theme}-{width}.png'), full_page=True)
                        toggle.focus()
                        page.keyboard.press('Enter')
                        assert toggle.evaluate('(el) => getComputedStyle(el).outlineStyle') != 'none'
                        expect(section.get_by_role('heading', name='Assessment summary', exact=True)).to_be_visible()
                        page.keyboard.press('Space')
                        expect(section.get_by_role('heading', name='Assessment summary', exact=True)).to_be_hidden()
                        page.keyboard.press('Enter')
                        expect(section.get_by_text('Highest-scoring areas: tied at 100%', exact=True)).to_be_visible()
                        expect(section.get_by_text('Database Management · Networking · Web Development', exact=True)).to_be_visible()
                        expect(section.get_by_text('Programming: 50%', exact=True)).to_be_visible()
                        expect(page.get_by_text('Old misleading orientation', exact=True)).to_have_count(0)
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (theme, width, view)
                        assert section.evaluate('(el) => el.scrollWidth <= el.clientWidth'), (theme, width, view)
                        summary = section.locator('h3').first.evaluate('(el) => getComputedStyle(el.nextElementSibling).fontSize')
                        assert float(summary.removesuffix('px')) >= 14, summary
                        if view == 'staff':
                            tab = page.get_by_role('tab', name='Combined competency')
                            tab.focus()
                            page.keyboard.press('ArrowRight')
                            expect(page.get_by_role('tab', name='Recommendations')).to_be_focused()
                            outline = page.evaluate('getComputedStyle(document.activeElement).outlineStyle')
                            assert outline != 'none'
                            page.keyboard.press('ArrowLeft')
                        page.screenshot(path=str(OUTPUT / f'{view}-{theme}-{width}.png'), full_page=True)
                        # Stress long labels and close scores using the same production component.
                        if view == 'component':
                            long_scores = [dict(category='Very long assessed category name covering information systems and application development', percentage=83.33),
                                           dict(category='Networking', percentage=83.34)]
                            fixture_state['scores'] = long_scores
                            page.reload(wait_until='networkidle')
                            page.locator('summary').click()
                            expect(page.get_by_text('Highest-scoring area: 83.34%', exact=True)).to_be_visible()
                            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                            page.screenshot(path=str(OUTPUT / f'long-label-{theme}-{width}.png'), full_page=True)
                            fixture_state['locked'] = True
                            page.reload(wait_until='networkidle')
                            page.locator('summary').click()
                            expect(page.get_by_text('Results locked', exact=True)).to_be_visible()
                            expect(page.get_by_text('Networking', exact=True)).to_have_count(0)
                        checks += 1
                        print(f'Checked {view}, {theme}, {width}px', flush=True)
                        context.close()
            assert not errors, errors
            print(f'PASS: {checks} view/theme/width combinations; dashboard layout and summaries verified; no overflow or page errors')
            print(f'Screenshots: {OUTPUT}')
        finally:
            browser.close()


try:
    run()
finally:
    HARNESS.unlink(missing_ok=True)
    ENTRY.unlink(missing_ok=True)
