"""Read real cross-program rankings and stale states from the production UI."""
import json

from playwright.sync_api import expect, sync_playwright

from organization_playwright import API, AUTH, BASE, OUT, checks, errors, session
from program_batches_playwright import call


def open_result(browser, scenario, *, phone=False):
    context, page = session(browser, scenario['auth'], width=390 if phone else 1440, dark=phone)
    # Finalize the synthetic batch before parallel SPA reads. SQLite cannot
    # exercise PostgreSQL row-lock behavior; backend concurrency uses PostgreSQL.
    response = context.request.get(API + '/api/student/results/combined/',
        headers={'Authorization': 'Bearer ' + AUTH[scenario['auth']]['token']}, timeout=120000)
    assert response.status == 200, response.status
    page.on('response', lambda response: errors.append(f'Unexpected server error: {response.status} {response.url}') if response.status >= 500 else None)
    page.goto(BASE + '/student/results', wait_until='networkidle')
    expect(page.get_by_role('button', name='Recommendation Order', exact=True)).to_be_visible(timeout=20000)
    return context, page


def run(browser):
    first, second, zero = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    for scenario in (first, second):
        context, page = open_result(browser, scenario, phone=scenario == second)
        expect(page.get_by_text('1 partner · 1 suggested position', exact=True)).to_be_visible()
        result = call(context, '/api/student/results/combined/', role=scenario['auth'])
        assert len(result['recommendations']) == 1 and result['recommendations'][0]['position_id'] == scenario['position_id']
        assert result['recommendations'][0]['assessment_details']['ranking_inputs']['framework_version'] == 1
        recommendation = result['recommendations'][0]
        assert recommendation['ranking_policy'] == 'assessment-average-match-v1'
        assert recommendation['match_percentage'] == recommendation['assessment_details']['required_mean'] == 80
        card = page.locator('article').filter(has=page.get_by_text('View match breakdown', exact=True))
        expect(card.get_by_text('80%', exact=True)).to_be_visible()
        card.get_by_text('View match breakdown', exact=True).click()
        expect(card.get_by_text('Average of 2 required categories = 80% Match.', exact=True)).to_be_visible()
        expect(page.get_by_text('Meets all required category minimums', exact=True)).to_be_visible()
        page.screenshot(path=str(OUT / ('assessment-match-phone-dark.png' if scenario == second else 'assessment-match-desktop.png')), animations='disabled', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.get_by_role('button', name='View partner details for', exact=False).first.click()
        dialog = page.get_by_role('dialog')
        expect(dialog.get_by_text('80%', exact=True)).to_be_visible()
        dialog.get_by_text('View match breakdown', exact=True).click()
        expect(dialog.get_by_text('Average of 2 required categories = 80% Match.', exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.keyboard.press('Escape')
        page.goto(BASE + '/student/dashboard', wait_until='networkidle')
        highlights = page.locator('.student-company-highlights.is-ranked')
        expect(highlights.locator('.student-company-score')).to_contain_text('80%')
        expect(highlights.get_by_text('Match', exact=True)).to_be_visible()
        context.close()
    checks.append('two programs with real graded evidence each see just their own recommendation in the desktop and phone UI')
    checks.append('assessment-based 80% Match and category/minimum breakdown agree with each scoped API response')

    admin, _ = session(browser)
    call(admin, f'/api/admin/positions/{second["position_id"]}/', 'patch', {'tags': ['Changed visitor desk vocabulary']})
    context, page = open_result(browser, first)
    expect(page.get_by_text('1 partner · 1 suggested position', exact=True)).to_be_visible()
    expect(page.get_by_text('Suggestions need refreshing.', exact=False)).to_have_count(0)
    context.close()
    context, page = open_result(browser, second, phone=True)
    expect(page.get_by_text('Suggestions need refreshing.', exact=False)).to_be_visible()
    expect(page.get_by_text('0 partners · 0 suggested positions', exact=True)).to_be_visible()
    result = call(context, '/api/student/results/combined/', role=second['auth'])
    assert result['recommendations_stale'] and result['overall_percentage'] == 80 and result['recommendations'] == []
    page.screenshot(path=str(OUT / 'scoped-stale-phone-dark.png'), animations='disabled', full_page=True)
    context.close()
    checks.append('the edited program sees a stale warning and retained grades while the independent program keeps its current recommendation')

    call(admin, '/api/admin/rerun-recommendations/', 'post', {})
    context, page = open_result(browser, second)
    expect(page.get_by_text('1 partner · 1 suggested position', exact=True)).to_be_visible()
    expect(page.get_by_text('Suggestions need refreshing.', exact=False)).to_have_count(0)
    context.close()
    context, page = open_result(browser, zero)
    expect(page.get_by_text('0 partners · 0 suggested positions', exact=True)).to_be_visible()
    result = call(context, '/api/student/results/combined/', role=zero['auth'])
    assert result['is_finalized'] and result['overall_percentage'] == 0 and not result['recommendations_stale']
    context.close()
    admin.close()
    checks.append('explicit synthetic rerun refreshes the edited program and assessed zero remains visible without recommendations')


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        run(browser)
        browser.close()
    assert not errors, errors
    for check in checks:
        print(f'PASS {check}')
