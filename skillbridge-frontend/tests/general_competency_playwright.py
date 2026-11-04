"""Real graded results, saved/current NLP text and reports across arbitrary programs."""
import json
from playwright.sync_api import expect, sync_playwright
import organization_playwright as support
from program_batches_playwright import call

OUT, BASE = support.OUT, support.BASE
checks, errors = support.checks, support.errors


def run(browser):
    scenarios = json.loads((OUT / 'general-text.json').read_text(encoding='utf-8'))
    for index, scenario in enumerate(scenarios):
        context, page = support.session(browser, scenario['auth'], width=390 if index else 1440, dark=index == 1)
        page.goto(BASE + f'/student/assessments/{scenario["assessment_id"]}/results', wait_until='networkidle')
        expect(page.get_by_role('heading', name='Category scores', exact=True)).to_be_visible()
        insights = page.get_by_role('region', name='Individual assessment interpretation')
        for name in scenario['categories']:
            expect(insights.get_by_role('heading', name=name, exact=True)).to_be_visible()
        expect(insights).to_contain_text('Choose one related activity from your course materials')
        expect(insights).not_to_contain_text('small program')
        expect(insights).not_to_contain_text('Backend and data-oriented')
        if scenario['percentage']:
            expect(insights).to_contain_text('Strongest areas · tied')
        else:
            expect(insights).to_contain_text('No assessed category scored above zero')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.screenshot(path=str(OUT / f'program-{index}-result.png'), animations='disabled', full_page=True)
        result = call(context, f'/api/student/results/?assessment_id={scenario["assessment_id"]}', role=scenario['auth'])
        assert all(row['max_score'] == 5 and row['percentage'] == scenario['percentage'] for row in result['skill_scores'])
        checks.append(f'program {index + 1} real 10-question grading and result UI preserve category raw/max, ties or assessed zero, with neutral course-based guidance')
        context.close()

    context, page = support.session(browser, 'instructor')
    for scenario in scenarios:
        student = call(context, f'/api/nlp/students/{scenario["student_id"]}/text/?assessment_id={scenario["assessment_id"]}', role='instructor')
        position = call(context, f'/api/nlp/positions/{scenario["position_id"]}/text/', role='instructor')
        current = student['texts'][1]['text']
        assert student['texts'][0]['text_generation_version'] == 'general-category-context-v4'
        assert 'Backend and data-oriented' not in current
        if scenario['percentage']:
            for name in scenario['categories']:
                assert f'Contextual category definition for {name}' in current
                assert f'Contextual category definition for {name}' in position['texts'][0]['text']
        else:
            assert 'Contextual category definition' not in current
        response = support.api(context, f'/api/management/assessment-reports/?type=student_competency&batch_id={scenario["batch_id"]}&export=csv', role='instructor')
        assert response.status == 200, response.text()
        csv = response.text()
        assert all(name in csv for name in scenario['categories'])
        assert 'Backend and data-oriented' not in csv
        (OUT / f'program-{scenario["assessment_id"]}-report.csv').write_text(csv, encoding='utf-8')
    checks.append('authorized real NLP previews contain bounded definitions symmetrically, keep zero context empty, identify saved text version and produce category-based CSV reports')
    page.goto(BASE + '/instructor/reports?tab=assessments', wait_until='networkidle')
    page.get_by_role('button', name='Individual assessment reports', exact=True).click()
    page.get_by_role('combobox', name='Report type', exact=True).select_option('student_competency')
    with page.expect_download() as download:
        page.get_by_role('button', name='Download CSV', exact=True).click()
    downloaded = OUT / 'displayed-student-competency.csv'
    download.value.save_as(str(downloaded))
    csv = downloaded.read_text(encoding='utf-8-sig')
    assert all(name in csv for scenario in scenarios for name in scenario['categories'])
    assert 'Backend and data-oriented' not in csv
    checks.append('instructor report UI downloads an actual CSV with all three program categories and neutral individual/combined summaries')
    context.close()


if __name__ == '__main__':
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='chrome', headless=True)
            try:
                run(browser)
            except Exception:
                for context in browser.contexts:
                    for index, page in enumerate(context.pages):
                        page.screenshot(path=str(OUT / f'failure-{index}.png'), animations='disabled')
                        (OUT / f'failure-{index}.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
                raise
            finally:
                browser.close()
        assert not errors, errors
    finally:
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
    print(json.dumps({'passed': len(checks), 'checks': checks, 'page_errors': errors}))
