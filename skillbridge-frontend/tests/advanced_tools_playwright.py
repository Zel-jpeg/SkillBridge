"""Real-API recommendation tools, scope safety and responsive dialog acceptance.

The harness owns a disposable synthetic SQLite database and localhost servers.
Purposeful intercepted delays/errors exercise UI recovery; happy-path dataset,
comparison, model verification and selected-batch refresh use the actual API.
"""
import json
import os
from pathlib import Path
import re
import sqlite3
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright
from organization_playwright import API, BASE, OUT, api, errors, session

CHECKS = []
COMPARISON = '/api/admin/nlp-model-comparison/'
CONFIG = '/api/admin/nlp-configuration/'
RERUN = '/api/admin/rerun-recommendations/'


def passed(message):
    CHECKS.append(message)
    print('PASS', message, flush=True)


def record_failure(page, name):
    try:
        page.screenshot(path=str(OUT / f'failure-{name}.png'), full_page=True, animations='disabled')
        (OUT / f'failure-{name}.html').write_text(page.content(), encoding='utf-8')
    except Exception:
        pass


def snapshot():
    tables = ['api_recommendation', 'api_studentcompetencyprofile', 'api_combinedcompetencyprofile',
              'api_skillscore', 'api_combinedcategoryscore', 'api_recommendationconfiguration', 'api_ojtplacement']
    with sqlite3.connect(OUT / 'synthetic-browser.sqlite3') as connection:
        return {table: connection.execute(f'SELECT * FROM {table} ORDER BY id').fetchall() for table in tables}


def open_tools(page):
    page.goto(BASE + '/admin/reports', wait_until='networkidle')
    page.get_by_role('button', name='Advanced tools', exact=True).click()
    dialog = page.get_by_role('dialog', name='Advanced recommendation tools', exact=True)
    expect(dialog).to_be_visible()
    expect(dialog.get_by_role('tab', name='Model settings', exact=True)).to_be_visible()
    page.wait_for_load_state('networkidle')
    return dialog


def assert_fits(dialog, page):
    geometry = dialog.evaluate('''node => {
      const rect = node.getBoundingClientRect();
      return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: innerWidth, height: innerHeight, scroll: node.scrollWidth, client: node.clientWidth};
    }''')
    assert geometry['left'] >= -1 and geometry['right'] <= geometry['width'] + 1, geometry
    assert geometry['top'] >= -1 and geometry['bottom'] <= geometry['height'] + 1, geometry
    assert geometry['scroll'] <= geometry['client'] + 1, geometry
    assert page.locator('body').evaluate('node => getComputedStyle(node).overflow') == 'hidden'


def strict_local_and_synthetic(browser):
    context, page = session(browser)
    try:
        for role in ['instructor', 'student']:
            for path in [COMPARISON, CONFIG]:
                response = api(context, path, role=role)
                assert response.status == 403, (role, path, response.status)
        coverage = api(context, COMPARISON)
        assert coverage.status == 200, coverage.text()
        data = coverage.json()
        (OUT / 'coverage.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
        assert data['case_count'] == 200, data
        assert {row['id']: row['case_count'] for row in data['dataset']['programs']} == {
            'IT': 50, 'IS': 50, 'SW': 50, 'TOURISM': 50}, data
        passed('admin-only real coverage endpoint supplies 200 synthetic student scenarios')

        before = snapshot()
        dialog = open_tools(page)
        expect(dialog.locator('details,summary')).to_have_count(0)
        expect(dialog.get_by_role('button', name='Save model', exact=False)).to_be_disabled()
        height = dialog.bounding_box()['height']
        assert height < 840, height
        assert_fits(dialog, page)
        page.screenshot(path=str(OUT / 'model-settings-desktop.png'), animations='disabled')
        tab = dialog.get_by_role('tab', name='Model settings', exact=True)
        tab.focus()
        tab.press('ArrowRight')
        expect(dialog.get_by_role('tab', name='Model comparison', exact=True)).to_have_attribute('aria-selected', 'true')
        expect(dialog.get_by_text(re.compile(r'200 synthetic'))).to_be_visible()
        coverage_button = dialog.get_by_role('button', name='Test data & coverage', exact=True)
        plain_color = coverage_button.evaluate('node => getComputedStyle(node).backgroundColor')
        coverage_button.hover()
        page.wait_for_timeout(180)
        assert coverage_button.evaluate('node => getComputedStyle(node).backgroundColor') != plain_color
        coverage_button.click()
        detail = page.get_by_role('dialog', name='Test data & coverage', exact=True)
        expect(detail).to_be_visible()
        expect(detail.locator('details,summary')).to_have_count(0)
        for program in ['IT', 'IS', 'Social Work', 'Tourism']:
            assert re.search(r'\b' + re.escape(program) + r'\b', detail.inner_text()), detail.inner_text()
        page.screenshot(path=str(OUT / 'test-coverage-desktop.png'), animations='disabled')
        detail.get_by_role('button', name=re.compile('Close|Done')).last.click()
        expect(detail).to_have_count(0)
        expect(dialog).to_be_visible()
        expect(dialog.get_by_role('button', name='Metrics & case results', exact=True)).to_be_disabled()
        passed('content-sized tabs, keyboard navigation, real coverage modal and not-run metric state')

        held = []
        def delay_comparison(route):
            if route.request.method == 'POST' and urlparse(route.request.url).path == COMPARISON:
                held.append(route)
            else:
                route.fallback()
        context.route('**/api/**', delay_comparison)
        dialog.get_by_role('button', name='Run comparison', exact=True).click()
        expect(dialog.get_by_role('button', name=re.compile(r'Comparing|Running'))).to_be_disabled()
        expect(dialog.get_by_role('combobox', name=re.compile('Program scope'))).to_be_disabled()
        assert len(held) == 1, len(held)
        context.unroute('**/api/**', delay_comparison)
        if os.environ.get('SB_ADVANCED_UI_ONLY') == '1':
            held[0].fulfill(status=503, content_type='application/json', body=json.dumps({'error': 'Synthetic unavailable model service.'}))
            expect(dialog.get_by_role('alert')).to_be_visible()
            expect(dialog.get_by_role('button', name='Run comparison', exact=True)).to_be_enabled()
            dialog.get_by_role('combobox', name='Program scope', exact=True).select_option('IT')
            expect(dialog.get_by_role('alert')).to_have_count(0)
            expect(dialog.get_by_text(re.compile('50 synthetic'))).to_be_visible()
            dialog.get_by_role('combobox', name='Program scope', exact=True).select_option('all')
            passed('comparison busy controls and recoverable intercepted server error (UI-only run)')
        else:
            with page.expect_response(lambda response: urlparse(response.url).path == COMPARISON and response.request.method == 'POST', timeout=360000) as response_info:
                held[0].fallback()
            result_response = response_info.value
            assert result_response.status == 200, result_response.text()
            result = result_response.json()
            (OUT / 'comparison-200.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
            assert result['case_count'] == 200, result
            assert len(result['models']) == 3
            for model in result['models']:
                assert model['status'] == 'available', model
                assert model['metrics'] is not None and 0 <= model['metrics']['top1_accuracy'] <= 1, model
            expect(dialog.get_by_role('button', name='Run comparison', exact=True)).to_be_enabled(timeout=20000)
            assert snapshot() == before, 'Comparison or inspecting configuration changed saved evidence'
            page.screenshot(path=str(OUT / 'comparison-results-desktop.png'), animations='disabled')
            dialog.get_by_role('button', name='Metrics & case results', exact=True).click()
            detail = page.get_by_role('dialog', name='Metrics & case results', exact=True)
            expect(detail).to_be_visible()
            expect(detail.locator('details,summary')).to_have_count(0)
            assert_fits(detail, page)
            page.screenshot(path=str(OUT / 'metrics-cases-desktop.png'), animations='disabled')
            detail.get_by_role('searchbox', name='Search cases', exact=True).fill('no case can match this')
            expect(detail.get_by_text('No cases match this search.', exact=True)).to_be_visible()
            detail.get_by_role('searchbox', name='Search cases', exact=True).fill('')
            expect(detail.get_by_text(re.compile('Showing 1–10 of 200'))).to_be_visible()
            detail.get_by_role('button', name='Next →', exact=True).click()
            expect(detail.get_by_text(re.compile('Showing 11–20 of 200'))).to_be_visible()
            detail.get_by_role('combobox', name=re.compile('Model to inspect')).select_option('stanza_en')
            expect(detail.get_by_text(re.compile('Showing 1–10 of 200'))).to_be_visible()
            detail.get_by_role('button', name=re.compile('Close|Done')).last.click()
            dialog.get_by_role('tab', name='Model settings', exact=True).click()
            dialog.get_by_role('tab', name='Model comparison', exact=True).click()
            expect(dialog.get_by_role('button', name='Metrics & case results', exact=True)).to_be_enabled()
            passed('actual 200-student comparison executes all three strict models with metrics and zero saved-evidence writes')
            model_controls(context, page, dialog)
        context.close()
    except Exception:
        record_failure(page, 'comparison')
        raise
    finally:
        if context.pages:
            context.close()


def model_controls(context, page, dialog):
    before = snapshot()
    dialog.get_by_role('tab', name='Model settings', exact=True).click()
    held = []
    def hold_check(route):
        parsed = urlparse(route.request.url)
        if parsed.path == CONFIG and 'verify=1' in parsed.query:
            held.append(route)
        else:
            route.fallback()
    context.route('**/api/**', hold_check)
    dialog.get_by_role('button', name='Recheck models', exact=True).click()
    expect(dialog.get_by_role('button', name='Checking models…', exact=True)).to_be_disabled()
    assert len(held) == 1
    context.unroute('**/api/**', hold_check)
    with page.expect_response(lambda response: CONFIG in response.url and 'verify=1' in response.url, timeout=180000) as response_info:
        held[0].fallback()
    verified = response_info.value.json()
    assert response_info.value.status == 200 and all(row['verified'] for row in verified['models']), verified
    expect(dialog.locator('.rt-model[data-ready="verified"]')).to_have_count(3)
    assert snapshot() == before, 'Runtime verification changed database rows'
    held.clear()
    def hold_save(route):
        if route.request.method == 'PATCH' and urlparse(route.request.url).path == CONFIG:
            held.append(route)
        else:
            route.fallback()
    context.route('**/api/**', hold_save)
    dialog.get_by_role('combobox', name='Recommendation model', exact=True).select_option('spacy_sm')
    dialog.get_by_role('button', name='Save model', exact=True).click()
    expect(dialog.get_by_role('button', name='Saving model…', exact=True)).to_be_disabled()
    expect(dialog.get_by_role('combobox', name='Recommendation model', exact=True)).to_be_disabled()
    assert len(held) == 1
    context.unroute('**/api/**', hold_save)
    with page.expect_response(lambda response: response.request.method == 'PATCH' and urlparse(response.url).path == CONFIG, timeout=180000) as response_info:
        held[0].fallback()
    assert response_info.value.status == 200, response_info.value.text()
    expect(dialog.get_by_role('button', name='Save model', exact=True)).to_be_disabled()
    assert api(context, CONFIG).json()['active_model'] == 'spacy_sm'
    after = snapshot()
    assert {key: value for key, value in after.items() if key != 'api_recommendationconfiguration'} == {
        key: value for key, value in before.items() if key != 'api_recommendationconfiguration'}, 'Saving model changed saved recommendation/grade/decision evidence'
    passed('real strict runtime recheck and model save use disabled loading controls and preserve all saved evidence')


def refresh_scopes(browser):
    context, page = session(browser)
    try:
        posts = []
        page.on('request', lambda request: posts.append(request.post_data_json) if request.method == 'POST' and urlparse(request.url).path == RERUN else None)
        page.goto(BASE + '/admin/placements?refresh=recommendations', wait_until='networkidle')
        dialog = page.get_by_role('dialog', name='Refresh saved recommendations', exact=True)
        expect(dialog).to_be_visible()
        expect(dialog.get_by_role('radio', name=re.compile('Selected batch'))).to_be_checked()
        expect(dialog.get_by_role('button', name='Review refresh', exact=True)).to_be_disabled()
        assert not posts
        page.screenshot(path=str(OUT / 'refresh-scope-desktop.png'), animations='disabled')
        dialog.get_by_role('radio', name=re.compile('Whole system')).check()
        expect(dialog.get_by_role('button', name='Review refresh', exact=True)).to_be_enabled()
        dialog.get_by_role('button', name='Review refresh', exact=True).click()
        confirmation = page.get_by_role('dialog', name='Refresh recommendations?', exact=True)
        expect(confirmation).to_be_visible()
        expect(confirmation).to_contain_text(re.compile('Whole system|whole system|all active'))
        confirmation.get_by_role('button', name='Cancel', exact=True).click()
        assert not posts
        dialog.get_by_role('radio', name=re.compile('Selected batch')).check()
        dialog.get_by_role('combobox', name='Institute', exact=True).select_option(label='Institute of Computing')
        program = dialog.get_by_role('combobox', name='Program', exact=True)
        options = program.locator('option').evaluate_all('nodes => nodes.map(node => ({value:node.value, text:node.textContent}))')
        shared = next(option for option in options if re.search('Shared|shared', option['text']))
        program.select_option(shared['value'])
        batch = dialog.get_by_role('combobox', name='Batch', exact=True)
        batch_options = batch.locator('option').evaluate_all('nodes => nodes.map(node => ({value:node.value, text:node.textContent}))')
        batch.select_option(next(option['value'] for option in batch_options if 'Existing IC mixed batch' in option['text']))
        dialog.get_by_role('button', name='Review refresh', exact=True).click()
        confirmation = page.get_by_role('dialog', name='Refresh recommendations?', exact=True)
        expect(confirmation).to_be_visible()
        assert not posts
        with page.expect_response(lambda response: urlparse(response.url).path == RERUN and response.request.method == 'POST', timeout=180000) as response_info:
            confirmation.get_by_role('button', name='Refresh recommendations', exact=True).click()
        assert response_info.value.status == 200, response_info.value.text()
        expect(dialog).to_have_count(0, timeout=20000)
        assert len(posts) == 1 and set(posts[0]) == {'batch_id'}, posts
        expect(page.get_by_role('button', name='Refresh saved recommendations', exact=True)).to_be_visible()
        passed('batch scope required by default; explicit whole-system review cancels without POST; shared batch uses only its batch_id')
    except Exception:
        record_failure(page, 'refresh')
        raise
    finally:
        context.close()


def responsive_and_errors(browser):
    for width, height, dark in [(1440, 620, False), (768, 740, False), (390, 844, True)]:
        context, page = session(browser, width=width, dark=dark, mobile=width < 500)
        try:
            page.set_viewport_size({'width': width, 'height': height})
            page.emulate_media(reduced_motion='reduce')
            dialog = open_tools(page)
            assert_fits(dialog, page)
            expect(dialog.get_by_role('button', name=re.compile('Close'))).to_be_visible()
            dialog.get_by_role('tab', name='Model comparison', exact=True).click()
            expect(dialog.locator('details,summary')).to_have_count(0)
            assert_fits(dialog, page)
            dialog.get_by_role('button', name='Test data & coverage', exact=True).click()
            detail = page.get_by_role('dialog', name='Test data & coverage', exact=True)
            assert_fits(detail, page)
            page.screenshot(path=str(OUT / f'coverage-{width}-{height}-{dark}.png'), animations='disabled')
            detail.get_by_role('button', name=re.compile('Close|Done')).last.click()
            dialog.get_by_role('tab', name='Model settings', exact=True).click()
            page.screenshot(path=str(OUT / f'settings-{width}-{height}-{dark}.png'), animations='disabled')
            dialog.get_by_role('button', name=re.compile('Close')).first.click()
            expect(page.get_by_role('button', name='Advanced tools', exact=True)).to_be_focused()
            passed(f'responsive content containment, nested focus restoration and reduced motion at {width}x{height} {"dark" if dark else "light"}')
        except Exception:
            record_failure(page, f'responsive-{width}')
            raise
        finally:
            context.close()


def dataset_recovery(browser):
    context, page = session(browser)
    def reject_coverage(route):
        if route.request.method == 'GET' and urlparse(route.request.url).path == COMPARISON:
            route.fulfill(status=503, content_type='application/json', body=json.dumps({'error': 'Synthetic dataset temporarily unavailable.'}))
        else:
            route.fallback()
    context.route('**/api/**', reject_coverage)
    try:
        dialog = open_tools(page)
        dialog.get_by_role('tab', name='Model comparison', exact=True).click()
        comparison_panel = dialog.get_by_role('tabpanel', name='Model comparison', exact=True)
        expect(comparison_panel.get_by_role('alert')).to_contain_text('Could not load the test dataset')
        expect(dialog.get_by_role('button', name='Run comparison', exact=True)).to_be_disabled()
        context.unroute('**/api/**', reject_coverage)
        dialog.get_by_role('button', name='Retry test data', exact=True).click()
        expect(dialog.get_by_role('button', name='Run comparison', exact=True)).to_be_enabled(timeout=20000)
        expect(dialog.get_by_text(re.compile('200 synthetic'))).to_be_visible()
        expect(comparison_panel.get_by_role('alert')).to_have_count(0)
        passed('missing dataset disables comparison and retries real metadata without starting a model run')
    except Exception:
        record_failure(page, 'dataset-recovery')
        raise
    finally:
        context.close()


if __name__ == '__main__':
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='chrome', headless=True)
            try:
                strict_local_and_synthetic(browser)
                refresh_scopes(browser)
                responsive_and_errors(browser)
                dataset_recovery(browser)
            finally:
                browser.close()
        assert not errors, errors
    finally:
        (OUT / 'advanced-results.json').write_text(json.dumps({'checks': CHECKS, 'page_errors': errors}, indent=2), encoding='utf-8')
    print(json.dumps({'passed': len(CHECKS), 'checks': CHECKS, 'page_errors': errors}))
