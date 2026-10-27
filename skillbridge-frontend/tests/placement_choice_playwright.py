"""Suggestion-save regressions; synthetic API responses, no database writes.

Run with Vite on port 5178 and backend venv Python (installed headless Chrome).
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlparse

import placement_collections_playwright as collections
from placement_collections_playwright import Fixture, expect, sync_playwright

collections.BASE = 'http://127.0.0.1:5178'
OUT = Path(__file__).parent / 'artifacts/placement-choice'
OUT.mkdir(parents=True, exist_ok=True)


class ChoiceFixture(Fixture):
    def __init__(self, browser, role, width=1366):
        super().__init__(browser, role)
        self.page.set_viewport_size({'width': width, 'height': 950})
        self.options = [dict(id=101+i, position_id=1+i, position=f'QA Intern 0{1+i}',
                             company_id=1+i, company=f'QA Company 0{1+i}', match_score=value,
                             category_score_component=value, nlp_score_component=value,
                             location_score_component=value)
                        for i, value in enumerate((90, 75))]
        self.suggestion.update(match_score=90, category_score_component=90,
                               nlp_score_component=90, location_score_component=90)
        self.companies[1]['positions'][0]['suggested_students'] = [
            {**self.suggestion, 'recommendation_id': 102, 'match_score': 75,
             'category_score_component': 75, 'nlp_score_component': 75, 'location_score_component': 75}]
        self.draft['students'][0].update(status='proposed', proposal=self.options[0], alternatives=self.options)
        self.draft['proposed_counts'] = {'1': 1}
        self.mode, self.fail_reads = 'hold', False
        self.choice_routes, self.read_routes, self.choices, self.approvals, self.reads = [], [], [], [], []
        self.saved = False
        self.stale_route = None
        self.stale_data = None

    def route(self, route):
        request = route.request
        path = urlparse(request.url).path
        if request.method == 'POST' and path == '/api/placements/approve/':
            self.approvals.append(request.post_data_json)
            return route.fulfill(status=409, json={'error': 'Synthetic approval stopped after checking target.'})
        if request.method == 'POST' and path == '/api/placements/draft/' and request.post_data_json.get('action') == 'choose':
            self.choices.append(request.post_data_json)
            if self.mode == 'reject':
                return route.fulfill(status=409, json={'error': 'All suggested slots for this position are already proposed.'})
            if self.mode == 'network':
                return route.abort('failed')
            if self.mode == 'invalid':
                return route.fulfill(json={'unexpected': 'Invalid save response'})
            self.choice_routes.append(route)
            return
        if request.method == 'GET' and path == '/api/placements/draft/' and self.stale_data is not None:
            self.stale_route = route
            return
        if self.saved and request.method == 'GET' and path in ['/api/placements/', '/api/placements/suggestions/', '/api/placements/draft/']:
            self.reads.append(path)
            if self.fail_reads:
                return route.fulfill(status=503, json={'error': 'Synthetic read outage after successful save'})
            self.read_routes.append(route)
            return
        return super().route(route)

    def review(self):
        page = self.open()
        page.get_by_role('button', name='Open company QA Company 01', exact=True).click()
        page.get_by_role('button', name='Review candidate', exact=True).click()
        return page.get_by_role('dialog', name='Review suggested placement')

    def confirm_choice(self):
        route = self.choice_routes.pop(0)
        option = next(item for item in self.options if item['id'] == route.request.post_data_json['recommendation_id'])
        self.draft = {**self.draft, 'revision': self.draft['revision']+1,
                      'sync_key': f'choice-{self.draft["revision"]+1}',
                      'proposed_counts': {str(option['position_id']): 1}}
        self.draft['students'][0].update(proposal=option, coordinator_choice=True)
        self.saved = True
        route.fulfill(json=self.draft)

    def release_reads(self):
        self.saved = False
        routes, self.read_routes = self.read_routes, []
        for route in routes:
            super().route(route)


checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for role in ('admin', 'instructor'):
            for width in (1366, 320):
                f = ChoiceFixture(browser, role, width)
                d = f.review()
                choose = d.locator('.pl-alternative').filter(has_text='QA Intern 02').get_by_role('button')
                choose.evaluate('(button) => { button.click(); button.click() }')
                expect(d.get_by_role('button', name='Saving suggestion…')).to_be_disabled()
                expect(d.get_by_role('button', name='Approve placement', exact=True)).to_be_disabled()
                expect(d.get_by_role('button', name='Decline suggestion', exact=True)).to_be_disabled()
                assert len(f.choices) == 1
                f.confirm_choice()
                expect(d.locator('.pl-target h3')).to_have_text('QA Intern 02')
                expect(d.locator('.pl-score-grid strong')).to_have_text(['75%']*4)
                expect(d.locator('.pl-target .pl-capacity')).to_contain_text('1 suggested')
                expect(d.locator('.pl-alternative').filter(has_text='QA Intern 02').get_by_text('Current suggestion', exact=True)).to_be_visible()
                expect(d.get_by_role('status')).to_contain_text('Suggestion saved.')
                expect(d.get_by_role('button', name='Approve placement', exact=True)).to_be_enabled()
                f.page.wait_for_timeout(150)
                assert len(f.read_routes) == 2 and '/api/placements/draft/' not in f.reads, f.reads
                assert f.page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                d.screenshot(path=str(OUT / f'{role}-saved-{width}.png'))
                d.get_by_role('button', name='Approve placement', exact=True).click()
                decision = f.page.get_by_role('dialog', name='Placement decision', exact=True)
                expect(decision.get_by_text('QA Intern 02 at QA Company 02', exact=True)).to_be_visible()
                decision.get_by_role('button', name='Approve student', exact=True).click()
                expect(decision.locator('form [role="alert"]')).to_contain_text('Synthetic approval stopped')
                assert f.approvals[0]['recommendation_id'] == 102
                f.page.keyboard.press('Escape')
                f.release_reads()
                assert not f.errors, f.errors
                f.context.close()
                checks.append(f'{role} {width}px: one write, visible saving, atomic dialog/capacity update before reads, correct explicit approval target')

            f = ChoiceFixture(browser, role)
            d = f.review()
            f.fail_reads = True
            d.locator('.pl-alternative').filter(has_text='QA Intern 02').get_by_role('button').click()
            expect(d.get_by_role('button', name='Saving suggestion…')).to_be_visible()
            f.confirm_choice()
            expect(d.get_by_role('alert')).to_contain_text('Suggestion saved, but related placement data could not refresh.')
            expect(d.locator('.pl-target h3')).to_have_text('QA Intern 02')
            expect(d.locator('.pl-score-grid strong')).to_have_text(['75%']*4)
            f.fail_reads = False
            d.get_by_role('button', name='Retry refresh', exact=True).click()
            f.page.wait_for_timeout(150)
            f.release_reads()
            expect(d.get_by_role('button', name='Retry refresh', exact=True)).to_have_count(0)
            assert len(f.choices) == 1
            assert not f.errors, f.errors
            f.context.close()
            checks.append(f'{role}: saved choice survives failed background refresh; read-only retry clears warning without replay')

            for mode in ('reject', 'network', 'invalid'):
                f = ChoiceFixture(browser, role)
                d = f.review()
                f.mode = mode
                d.locator('.pl-alternative').filter(has_text='QA Intern 02').get_by_role('button').click()
                expect(d.locator('.pl-dialog-body [role="alert"]')).to_be_visible()
                expect(d.locator('.pl-target h3')).to_have_text('QA Intern 01')
                expect(d.get_by_text('Suggestion saved.', exact=False)).to_have_count(0)
                assert len(f.choices) == 1 and not f.reads
                assert not f.errors, f.errors
                f.context.close()
            checks.append(f'{role}: rejected, network-failed and invalid saves preserve original selection without false success or replay')

            f = ChoiceFixture(browser, role)
            d = f.review()
            f.stale_data = copy.deepcopy(f.draft)
            f.page.evaluate('async () => { const {invalidateCache}=await import("/src/hooks/useApi.js"); invalidateCache("/api/placements/draft/") }')
            f.page.wait_for_timeout(100)
            assert f.stale_route is not None
            d.locator('.pl-alternative').filter(has_text='QA Intern 02').get_by_role('button').click()
            expect(d.get_by_role('button', name='Saving suggestion…')).to_be_visible()
            f.confirm_choice()
            expect(d.locator('.pl-target h3')).to_have_text('QA Intern 02')
            f.stale_route.fulfill(json=f.stale_data)
            f.stale_data = None
            f.page.wait_for_timeout(150)
            expect(d.get_by_text('Current suggestion:', exact=False)).to_contain_text('QA Intern 02')
            f.release_reads()
            assert not f.errors, f.errors
            f.context.close()
            checks.append(f'{role}: older in-flight draft read cannot replace confirmed mutation data')

            f = ChoiceFixture(browser, role)
            d = f.review()
            d.locator('.pl-alternative').filter(has_text='QA Intern 02').get_by_role('button').click()
            expect(d.get_by_role('button', name='Saving suggestion…')).to_be_visible()
            f.page.keyboard.press('Escape')
            expect(d).to_have_count(0)
            f.confirm_choice()
            f.page.wait_for_timeout(150)
            expect(d).to_have_count(0)
            f.release_reads()
            assert not f.errors, f.errors
            f.context.close()
            checks.append(f'{role}: closing during save stays closed after response')
    finally:
        browser.close()
        result = {'checks': checks, 'scope': 'Synthetic API responses only; no live records'}
        (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2))
