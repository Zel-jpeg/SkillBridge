"""Synthetic browser checks; no live API, Storage, device calls or student data."""
import json
import os
import re
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
from io import BytesIO
from email.parser import BytesParser
from email.policy import default
from PIL import Image

BASE = os.environ.get('SKILLBRIDGE_TEST_BASE', 'http://127.0.0.1:5178')
OUT = Path(__file__).parent / 'artifacts/retake-recovery'
OUT.mkdir(parents=True, exist_ok=True)
IDENTITY = datetime.now(timezone.utc).isoformat()
DEADLINE = (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat()
USER = {'id': 991, 'name': 'Synthetic Recovery Student', 'role': 'student', 'phone': '09000000000',
        'is_approved': True, 'profile_completed': True, 'course': 'BSIT', 'school_id': 'SYNTHETIC'}
ASSESSMENT = {'id': 1, 'title': 'Synthetic Recovery Assessment', 'duration_minutes': 30, 'availability_status': 'available',
              'attempt_status': 'stopped', 'submitted_at': IDENTITY, 'started_at': IDENTITY, 'retake_allowed': False,
              'is_flagged': True, 'can_request_retake': True,
              'include_in_competency': True, 'is_required': True, 'question_count': 1, 'categories': ['Programming'], 'action': 'view_result'}
QUESTION = {'id': 1, 'question_text': 'Choose a synthetic answer', 'question_type': 'mcq', 'category': 'Programming',
            'choices': [{'id': 1, 'text': 'Keep this answer'}, {'id': 2, 'text': 'Another answer'}]}
checks, errors = [], []
IMAGE = BytesIO()
Image.new('RGB', (200, 100), 'white').save(IMAGE, 'WEBP')
INTERRUPTIONS = [{'id': f'event-{number}', 'reasons': [reason], 'duration_seconds': duration,
    'started_at': f'2026-10-27T02:{30 + number:02}:00+00:00'} for number, (reason, duration) in enumerate([
        ('window_lost_focus', 11), ('tab_hidden', 12), ('fullscreen_exited', 40)], 1)]


class Fixture:
    def __init__(self, browser, role='student', width=390, mobile=None):
        self.user = {**USER, 'role': role}
        self.record = deepcopy(ASSESSMENT)
        self.records = None
        self.uploaded_image = None
        self.request = {}
        self.rows = []
        self.histories = []
        self.fail_review = False
        self.fail_queue = False
        self.fail_request_read = False
        self.writes = []
        self.events = []
        self.force_review = False
        self.fail_recovery = False
        self.evidence_reads = 0
        self.draft = []
        mobile = role == 'student' if mobile is None else mobile
        self.context = browser.new_context(viewport={'width': width, 'height': 900}, is_mobile=mobile,
            user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' if mobile else None)
        self.context.add_init_script('if (!localStorage.getItem("sb-token")) { for (const [k,v] of Object.entries(' + json.dumps({
            'sb-token': 'synthetic', 'sb-role': role, 'sb-user': json.dumps(self.user)}) + ')) localStorage.setItem(k,v); }')
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(15000)
        self.page.on('pageerror', lambda error: errors.append(str(error)))

    def route(self, route):
        parsed = urlparse(route.request.url)
        path, method = parsed.path, route.request.method
        if not path.startswith('/api/'):
            return route.continue_() if parsed.hostname in ('localhost', '127.0.0.1') else route.abort()
        if method != 'GET': self.writes.append(path)
        if path.endswith('/events/'): return route.fulfill(status=204)
        if path in ('/api/auth/me/', '/api/students/me/', '/api/students/me/profile/'): return route.fulfill(json=self.user)
        if path == '/api/assessments/': return route.fulfill(json={'assessments': self.records or [self.record], 'batch': {'id': 1, 'name': 'Synthetic batch'}})
        if path == '/api/student/results/combined/': return route.fulfill(json={'recommendations_locked': True, 'combined_category_scores': [], 'recommendations': []})
        if path == '/api/management/analytics/':
            return route.fulfill(json={'role': self.user['role'], 'generated_at': IDENTITY,
                'summary': {key: 0 for key in ['students','required_complete','approved','unplaced','awaiting_review','needs_followup','slots_remaining']},
                'scope': {}, 'options': {key: [] for key in ['batches', 'instructors', 'courses', 'assessments', 'companies', 'positions', 'areas']},
                **{key: [] for key in ['students','placement_students','assessments','batches','skills','capacity','match_bands','companies','areas','geography','activity']}})
        if path == '/api/admin/users/': return route.fulfill(json={'students': [], 'instructors': [], 'pending_instructors': []})
        if path.endswith('/retake-request/'):
            if method == 'POST':
                body = BytesParser(policy=default).parsebytes(
                    b'Content-Type: ' + route.request.headers['content-type'].encode() + b'\r\n\r\n' + route.request.post_data_buffer)
                image = next((part for part in body.iter_parts() if part.get_param('name', header='content-disposition') == 'image'), None)
                self.uploaded_image = (image.get_filename(), image.get_payload(decode=True)) if image else None
                self.request = {'status': 'pending', 'request_id': 'synthetic-confirmed-request', 'explanation': 'A synthetic system alert interrupted my assessment and I need a reviewed retake.',
                                'no_image_reason': '' if image else 'The alert disappeared before a screenshot was possible.', 'has_image': image is not None}
                self.record['retake_request'] = self.request
                return route.fulfill(status=201, json={'request': self.request})
            if self.fail_request_read and self.request:
                return route.fulfill(status=503, json={'error': 'Synthetic read failure after successful request'})
            return route.fulfill(json={'assessment': self.record['title'], 'student_id': 991, 'assessment_id': 1,
                'attempt_started_at': IDENTITY, 'request': self.request, 'can_request': not self.request, 'history': []})
        if path == '/api/retake-requests/':
            if self.fail_queue: return route.fulfill(status=503, json={'error': 'Synthetic queue outage'})
            query = parse_qs(parsed.query)
            status = query.get('status', ['pending'])[0]
            rows = (self.histories if status == 'history' else self.rows) if not query.get('search') else []
            if status not in ('all', 'history'): rows = [row for row in rows if row['request']['status'] == status]
            page = min(int(query.get('page', ['1'])[0]), max(1, (len(rows) + 7) // 8))
            return route.fulfill(json={'count': len(rows), 'page': page, 'page_size': 8, 'results': rows[(page-1)*8:page*8]})
        if path.endswith('/review/'):
            if self.fail_review: return route.fulfill(status=409, json={'error': 'Synthetic conflict: another reviewer changed this request.'})
            payload = route.request.post_data_json
            row = next(row for row in self.rows if row['student_id'] == int(path.split('/')[-3]))
            row['request'].update(status=payload['decision'], review_note=payload['note'])
            return route.fulfill(json={'request': row['request'], 'retake_allowed': payload['decision'] == 'approved'})
        if path.endswith('/start/'):
            self.record.update(attempt_status='in_progress', submitted_at=None)
            return route.fulfill(json={'response_id': 1, 'started_at': IDENTITY, 'attempt_started_at': IDENTITY,
                'time_limit_sec': 1800, 'remaining_seconds': 1200, 'deadline_at': DEADLINE, 'questions': [QUESTION], 'draft_answers': self.draft,
                'interruption': {'open_event': self.events[-1] if self.events and not self.events[-1].get('ended_at') else None}})
        if path.endswith('/interruption/'):
            data = route.request.post_data_json
            self.draft = data.get('answers', self.draft)
            event = next((item for item in self.events if item['id'] == data.get('event_id')), None)
            if data['action'] == 'begin' and event is None:
                event = {'id': data['event_id'], 'started_at': datetime.now(timezone.utc).isoformat(), 'reasons': [data['reason']]}
                self.events.append(event)
            if data['action'] == 'recover':
                if self.fail_recovery: return route.fulfill(status=503, json={'error': 'Synthetic offline recovery'})
                event['ended_at'] = IDENTITY
            return route.fulfill(json={'review_required': self.force_review, 'remaining_seconds': 1190, 'deadline_at': DEADLINE,
                'open_event': event if event and not event.get('ended_at') else None})
        if path.endswith('/evidence/'):
            self.evidence_reads += 1
            return route.fulfill(body=IMAGE.getvalue(), content_type='image/webp', headers={'Cache-Control': 'private, no-store'})
        if path.endswith('/stop/'):
            self.record.update(attempt_status='stopped', submitted_at=IDENTITY)
            return route.fulfill(json={'attempt_status': 'stopped', 'stopped_reason_display': 'Interruption review required.', 'review_required': True})
        if path.endswith('/timing/'): return route.fulfill(json={'status': 'in_progress', 'remaining_seconds': 1180, 'deadline_at': DEADLINE})
        return route.fulfill(json=[])

    def close(self):
        self.context.unroute_all(behavior='ignoreErrors'); self.context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        cards = Fixture(browser, width=1280, mobile=False)
        cards.records = [cards.record,
            {**ASSESSMENT, 'id': 2, 'title': 'Ordinary submitted assessment', 'attempt_status': 'submitted', 'is_flagged': False},
            {**ASSESSMENT, 'id': 3, 'title': 'Never started assessment', 'attempt_status': None, 'is_flagged': False, 'can_request_retake': False},
            {**ASSESSMENT, 'id': 4, 'title': 'Expired unfinished assessment', 'attempt_status': 'in_progress', 'is_flagged': False},
            {**ASSESSMENT, 'id': 5, 'title': 'Retake already approved', 'retake_allowed': True, 'can_request_retake': False},
            {**ASSESSMENT, 'id': 6, 'title': 'Existing request', 'is_flagged': False, 'can_request_retake': False, 'retake_request': {'status': 'pending'}}]
        page = cards.page
        page.goto(BASE + '/student/assessments', wait_until='networkidle')
        expect(page.get_by_role('button', name='Request retake', exact=True)).to_have_count(1)
        expect(page.get_by_role('button', name='View retake request')).to_have_count(1)
        request_button = page.get_by_role('button', name='Request retake', exact=True)
        expect(request_button).to_have_css('cursor', 'pointer')
        before = request_button.evaluate('(el) => getComputedStyle(el).backgroundColor')
        request_button.hover()
        page.wait_for_function('(before) => getComputedStyle([...document.querySelectorAll("button")].find(el => el.textContent === "Request retake")).backgroundColor !== before', arg=before)
        request_button.click()
        expect(page).to_have_url(re.compile('/student/assessments/1/retake-request$'))
        checks.append('Assessment-specific flagged request action, ordinary/unstarted/expired/approved cards hidden, existing request retained and real hover feedback')
        cards.close()

        for width, mobile in [(1280, False), (375, True)]:
            upload = Fixture(browser, width=width, mobile=mobile)
            page = upload.page
            page.goto(BASE + '/student/assessments/1/retake-request', wait_until='networkidle')
            file_input = page.locator('input[type="file"]')
            choose = page.get_by_role('button', name='Add image', exact=True)
            choose.focus()
            expect(choose).to_be_focused()
            expect(choose).to_have_css('outline-style', 'solid')
            with page.expect_file_chooser() as chooser:
                choose.press('Enter')
            chooser.value.set_files({'name': 'evidence.webp', 'mimeType': 'image/webp', 'buffer': IMAGE.getvalue()})
            preview = page.get_by_alt_text('Preview of your supporting image')
            expect(preview).to_be_visible()
            page.wait_for_function("() => [...document.images].some(image => image.alt === 'Preview of your supporting image' && image.naturalWidth > 0)")
            expect(page.get_by_label('Why no image is available')).to_have_count(0)
            old_preview = preview.get_attribute('src')
            file_input.set_input_files({'name': 'invalid.txt', 'mimeType': 'text/plain', 'buffer': b'not an image'})
            expect(page.get_by_role('alert')).to_contain_text('Choose a JPEG, PNG or WebP')
            expect(preview).to_have_attribute('src', old_preview)
            file_input.set_input_files({'name': 'oversized.png', 'mimeType': 'image/png', 'buffer': b'x' * (5 * 1024 * 1024 + 1)})
            expect(page.get_by_role('alert')).to_contain_text('up to 5 MiB')
            expect(preview).to_have_attribute('src', old_preview)
            page.get_by_role('button', name='Remove image', exact=True).click()
            expect(preview).to_have_count(0)
            expect(page.get_by_label('Why no image is available')).to_be_visible()
            zone = page.get_by_role('group', name='Supporting image (optional)')
            dropped = page.evaluate_handle('''bytes => {
                const transfer = new DataTransfer();
                transfer.items.add(new File([new Uint8Array(bytes)], 'dropped.webp', { type: 'image/webp' }));
                return transfer;
            }''', list(IMAGE.getvalue()))
            zone.dispatch_event('dragenter', {'dataTransfer': dropped})
            expect(page.get_by_text('Drop your image here', exact=True)).to_be_visible()
            zone.dispatch_event('drop', {'dataTransfer': dropped})
            expect(preview).to_be_visible()
            expect(page.get_by_text('dropped.webp', exact=True)).to_be_visible()
            assert not upload.writes, 'Selection/drop must not upload before submission'
            with page.expect_file_chooser() as chooser:
                page.get_by_role('button', name='Replace image').click()
            chooser.value.set_files({'name': 'final.webp', 'mimeType': 'image/webp', 'buffer': IMAGE.getvalue()})
            expect(page.get_by_text('final.webp', exact=True)).to_be_visible()
            page.get_by_label('Explanation (30–500 characters)').fill('A synthetic call interrupted this assessment. Please review my supporting image.')
            send = page.get_by_role('button', name='Send retake request')
            expect(send).to_have_css('cursor', 'pointer')
            if not mobile:
                page.mouse.move(0, 0)
                before = send.evaluate('(el) => getComputedStyle(el).backgroundColor')
                send.hover()
                page.wait_for_function('(before) => getComputedStyle([...document.querySelectorAll("button")].find(el => el.textContent === "Send retake request")).backgroundColor !== before', arg=before)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / f'image-preview-{width}.png'), full_page=True)
            page.evaluate('document.documentElement.classList.add("dark")')
            page.screenshot(path=str(OUT / f'image-preview-dark-{width}.png'), full_page=True)
            send.click()
            expect(page.get_by_text('Request pending', exact=True)).to_be_visible()
            assert upload.uploaded_image == ('final.webp', IMAGE.getvalue()), 'Submit must contain the selected replacement image'
            checks.append(f'{width}px: keyboard file picker, loaded preview, invalid/oversize replacement, remove, drop feedback, replace, responsive/dark layout and actual multipart image submission')
            upload.close()

        student = Fixture(browser, width=375)
        page = student.page
        page.goto(BASE + '/student/assessments', wait_until='networkidle')
        page.get_by_role('button', name='Request retake', exact=True).click()
        explanation = page.get_by_label('Explanation (30–500 characters)')
        expect(explanation).to_have_attribute('maxlength', '500')
        explanation.fill('x' * 500)
        expect(page.get_by_text('500/500 characters', exact=True)).to_be_visible()
        explanation.press('End'); explanation.press('y')
        expect(explanation).to_have_value('x' * 500)
        explanation.fill('A synthetic system alert interrupted my assessment and I need a reviewed retake.')
        page.get_by_label('Why no image is available').fill('The alert disappeared before a screenshot was possible.')
        student.fail_request_read = True
        page.get_by_role('button', name='Send retake request').evaluate('(button) => { button.click(); button.click() }')
        expect(page.get_by_text('Request pending', exact=True)).to_be_visible()
        expect(page.get_by_text('Your retake request was sent for review, but the latest details could not refresh. You do not need to submit it again.', exact=True)).to_be_visible()
        assert sum(path.endswith('/retake-request/') for path in student.writes) == 1
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUT / 'student-request.png'), full_page=True)
        checks.append('Student card to explanation/no-image request, pending state and no duplicate submission')
        student.close()

        for role, width in [('instructor', 375), ('admin', 1280)]:
            staff = Fixture(browser, role, width)
            staff.rows = [{'id': number, 'student_id': number, 'student': f'Synthetic Student {number}', 'school_id': f'SYN-{number}',
                'assessment_id': 1, 'assessment': ASSESSMENT['title'], 'batch': 'Synthetic batch', 'attempt_started_at': IDENTITY,
                'attempt_status': 'stopped', 'stopped_reason': 'Interruption review', 'interruptions': deepcopy(INTERRUPTIONS) if number == 1 else [{'id': 'open-event', 'reasons': ['page_closed'], 'duration_seconds': None, 'started_at': None}], 'has_image': number == 1,
                'request': {'request_id': f'synthetic-{number}', 'status': 'pending', 'explanation': 'Synthetic interruption explanation.',
                            'requested_at': IDENTITY, 'no_image_reason': 'No screenshot could be captured.'}} for number in range(1, 10)]
            page = staff.page
            page.goto(BASE + f'/{role}/retake-requests', wait_until='networkidle')
            assert page.get_by_role('searchbox').bounding_box()['width'] >= 200, 'Search must remain usable on narrow screens'
            visible_rows = page.locator('article:visible') if width < 1024 else page.locator('tbody tr')
            expect(visible_rows).to_have_count(8)
            if width >= 1024:
                expect(page.get_by_role('button', name='Show request list')).to_have_attribute('aria-pressed', 'true')
                for label in ['Show request cards', 'Show request list']:
                    assert page.get_by_role('button', name=label).inner_text() == '', 'View controls must remain icon-only'
            page.get_by_role('button', name='Next →').click()
            expect(visible_rows).to_have_count(1)
            if width >= 1024:
                page.get_by_role('button', name='Show request cards').click()
                expect(page.locator('article:visible')).to_have_count(1)
                expect(page.locator('article:visible')).to_contain_text('Synthetic Student 9')
                page.get_by_role('button', name='Show request list').click()
                expect(visible_rows).to_contain_text('Synthetic Student 9')
            page.get_by_label('Search student, ID or assessment').fill('absent')
            expect(page.get_by_text('No requests match these filters.')).to_be_visible()
            page.get_by_role('button', name='Reset filters').last.click()
            expect(visible_rows).to_have_count(8)
            assert staff.evidence_reads == 0, 'Closed evidence must not download'
            opener = page.get_by_role('button', name='Review request for Synthetic Student 1', exact=True)
            opener.click()
            dialog = page.get_by_role('dialog')
            expect(dialog).to_be_visible()
            expect(dialog.get_by_alt_text('Student-provided evidence supporting this retake request')).to_be_visible()
            assert staff.evidence_reads == 1
            if width < 800:
                records_toggle = dialog.get_by_role('button', name='Interruption records · 3', exact=True)
                expect(records_toggle).to_have_attribute('aria-expanded', 'false')
                expect(dialog.get_by_text('Window lost focus', exact=True)).not_to_be_visible()
                records_toggle.click()
                expect(dialog.get_by_text('63 seconds total', exact=True)).to_be_visible()
            else:
                expect(dialog.get_by_text('3 records · 63 seconds total', exact=True)).to_be_visible()
            for reason in ['Window lost focus', 'Assessment hidden', 'Fullscreen exited']:
                expect(dialog.get_by_text(reason, exact=True)).to_be_visible()
            expect(dialog.get_by_text('window_lost_focus', exact=True)).to_have_count(0)
            expect(dialog.get_by_text(INTERRUPTIONS[0]['started_at'], exact=True)).to_have_count(0)
            dialog.get_by_label('Review note').fill('Reviewed the explanation; a new assessment attempt is approved.')
            note_length = len('Reviewed the explanation; a new assessment attempt is approved.')
            expect(dialog.get_by_text(f'{note_length}/1000', exact=True)).to_be_visible()
            staff.fail_review = True
            dialog.get_by_role('button', name='Approve retake', exact=True).click()
            expect(dialog.get_by_role('alert')).to_contain_text('Synthetic conflict')
            expect(dialog.get_by_label('Review note')).to_have_value('Reviewed the explanation; a new assessment attempt is approved.')
            staff.fail_review = False
            dialog.get_by_role('button', name='Approve retake', exact=True).click()
            expect(dialog).to_have_count(0)
            expect(page.get_by_text('Retake request approved.', exact=True)).to_be_visible()
            page.get_by_role('button', name='Approved', exact=True).click()
            expect(visible_rows).to_have_count(1)
            page.get_by_role('button', name='View request details for Synthetic Student 1', exact=True).click()
            expect(dialog.get_by_text('Reviewed the explanation; a new assessment attempt is approved.')).to_be_visible()
            expect(dialog.get_by_role('button', name='Approve retake', exact=True)).to_have_count(0)
            dialog.get_by_role('button', name='Close retake request').click()
            expect(page.get_by_role('button', name='View request details for Synthetic Student 1', exact=True)).to_be_focused()
            page.get_by_role('button', name='Pending', exact=True).click()
            page.get_by_role('button', name='Review request for Synthetic Student 2', exact=True).click()
            expect(dialog.get_by_text('No screenshot could be captured.', exact=False)).to_be_visible()
            if width < 800: dialog.get_by_role('button', name='Interruption records · 1', exact=True).click()
            if width < 800:
                expect(dialog.locator('.retake-records-content').get_by_text('Duration not recorded', exact=True)).to_be_visible()
            else:
                expect(dialog.get_by_text('1 record · Duration not recorded', exact=True)).to_be_visible()
            expect(dialog.get_by_text('Recovery not recorded', exact=True)).to_be_visible()
            expect(dialog.get_by_text('Time not recorded', exact=True)).to_be_visible()
            dialog.get_by_label('Review note').fill('Reviewed the explanation. This request is declined with a recorded reason.')
            dialog.get_by_role('button', name='Decline', exact=True).click()
            expect(dialog).to_have_count(0)
            page.get_by_role('button', name='Declined', exact=True).click()
            expect(visible_rows).to_have_count(1)
            expect(visible_rows).to_contain_text('Synthetic Student 2')
            staff.histories = [{**deepcopy(staff.rows[0]), 'history_id': 10, 'read_only': True}]
            page.get_by_role('button', name='Previous attempts', exact=True).click()
            page.get_by_role('button', name='View request details for Synthetic Student 1', exact=True).click()
            expect(dialog.get_by_text('Previous attempt · Read only')).to_be_visible()
            expect(dialog.get_by_label('Review note')).to_have_count(0)
            page.keyboard.press('Escape')
            expect(dialog).to_have_count(0)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / f'{role}-queue.png'), full_page=True)
            checks.append(f'{role}: pagination, icon-only views preserve page, search/reset, lazy evidence, conflict recovery, approve/decline and read-only history with focus restoration')
            expect(page.get_by_text('The server returned invalid data. Please retry.', exact=False)).to_have_count(0)
            staff.close()

        for role in ['instructor', 'admin']:
            for width in [320, 640, 768, 800, 1024, 1440]:
                staff = Fixture(browser, role, width)
                staff.rows = [{'id': number, 'student_id': number, 'student': name, 'school_id': f'SYN-{number:03}',
                    'assessment_id': 1, 'assessment': assessment, 'batch': 'BSIT 4-A', 'attempt_started_at': IDENTITY,
                    'attempt_status': 'stopped', 'stopped_reason': 'Interruption review required.', 'interruptions': deepcopy(INTERRUPTIONS) if number == 1 else [], 'has_image': number == 1,
                    'request': {'request_id': f'synthetic-{number}', 'status': 'pending', 'requested_at': IDENTITY,
                        'explanation': 'Repeated system alerts interrupted my assessment. Please review my request.',
                        'no_image_reason': 'No screenshot could be captured.'}} for number, (name, assessment) in enumerate([
                            ('Alex Reyes', 'Programming Fundamentals'), ('Mia Santos', 'Database Foundations'),
                            ('Noah Cruz', 'Networking Essentials'), ('Ella Garcia', 'Web Development'),
                            ('Liam Torres', 'Programming Fundamentals'), ('Zoe Ramos', 'Database Foundations')], 1)]
                page = staff.page
                page.goto(BASE + f'/{role}/retake-requests', wait_until='networkidle')
                visible_rows = page.locator('article:visible') if width < 1024 else page.locator('tbody tr')
                expect(visible_rows).to_have_count(6)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{role} {width}: page overflow'
                if width < 1024:
                    expect(page.get_by_role('group', name='Request view')).to_have_count(0)
                else:
                    list_names = page.locator('tbody tr td:first-child p.font-semibold').all_text_contents()
                    page.get_by_role('button', name='Show request cards').click()
                    expect(page.locator('article:visible')).to_have_count(6)
                    for row, name in zip(page.locator('article:visible').all(), list_names):
                        assert name in row.inner_text(), 'Card/list identity must agree'
                    page.screenshot(path=str(OUT / f'{role}-cards-{width}.png'), full_page=True, animations='disabled')
                    page.get_by_role('button', name='Show request list').click()
                page.evaluate('window.scrollTo(0,0); document.activeElement.blur()')
                page.wait_for_function("() => { const sidebar = document.querySelector('.sb-desktop-sidebar'); return !sidebar.getClientRects().length || document.querySelector('h1').getBoundingClientRect().left >= sidebar.getBoundingClientRect().right }")
                page.screenshot(path=str(OUT / f'{role}-list-{width}.png'), full_page=True, animations='disabled')
                page.get_by_role('button', name='Review request for Alex Reyes', exact=True).click()
                dialog = page.get_by_role('dialog')
                expect(dialog.get_by_alt_text('Student-provided evidence supporting this retake request')).to_be_visible()
                assert dialog.evaluate('(el) => el.getBoundingClientRect().bottom - el.querySelector(".sb-detail-footer").getBoundingClientRect().bottom < 3'), 'Footer must meet the dialog bottom without empty space'
                evidence_box = dialog.locator('.retake-review-evidence').bounding_box()
                decision_box = dialog.locator('.retake-review-decision').bounding_box()
                if width >= 800:
                    assert decision_box['x'] > evidence_box['x'] + evidence_box['width'], 'Desktop review must have two columns'
                    expect(dialog.get_by_text('Window lost focus', exact=True)).to_be_visible()
                else:
                    assert decision_box['y'] >= evidence_box['y'] + evidence_box['height'], 'Mobile review must stack sections'
                    records_toggle = dialog.get_by_role('button', name='Interruption records · 3', exact=True)
                    expect(records_toggle).to_have_attribute('aria-expanded', 'false')
                    records_toggle.click()
                    expect(dialog.get_by_text('Window lost focus', exact=True)).to_be_visible()
                page.screenshot(path=str(OUT / f'{role}-review-light-{width}.png'), animations='disabled')
                # Short landscape viewport and expanded records must retain the footer and trap focus.
                page.set_viewport_size({'width': width, 'height': 420})
                dialog.get_by_label('Review note').fill('The reviewer can reach this note even on a short screen.')
                assert dialog.evaluate('(el) => el.scrollWidth <= el.clientWidth'), 'Dialog horizontal overflow'
                approve = dialog.get_by_role('button', name='Approve retake', exact=True)
                bounds = approve.bounding_box()
                assert 0 <= bounds['y'] and bounds['y'] + bounds['height'] <= 420, 'Footer must stay on screen'
                approve.focus(); page.keyboard.press('Tab')
                expect(dialog.get_by_role('button', name='Close retake request')).to_be_focused()
                page.evaluate('document.documentElement.classList.add("dark")')
                page.screenshot(path=str(OUT / f'{role}-review-dark-{width}.png'), animations='disabled')
                page.keyboard.press('Escape')
                expect(dialog).to_have_count(0)
                assert not staff.writes, 'Responsive inspection must not submit a decision'
                staff.close()
            checks.append(f'{role}: light/dark layout at 320/640/768/800/1024/1440px, two-column/stacked review, mobile disclosure, matching views, no overflow, short-screen footer, focus trap and Escape')

        attempt = Fixture(browser)
        attempt.record.update(attempt_status=None, submitted_at=None)
        page = attempt.page
        page.goto(BASE + '/student/assessments/1/take', wait_until='networkidle')
        page.get_by_role('checkbox').check()
        page.get_by_role('button', name='Agree & start', exact=True).click()
        page.get_by_role('button', name=re.compile('Keep this answer')).click()
        page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {key:'c',ctrlKey:true,bubbles:true,cancelable:true}))")
        expect(page.get_by_text('Integrity monitoring active', exact=True)).to_be_visible()
        assert not any(path.endswith('/stop/') for path in attempt.writes)
        page.evaluate("Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>false}); window.dispatchEvent(new Event('blur'))")
        expect(page.get_by_role('heading', name='Assessment interrupted')).to_be_visible()
        page.evaluate("Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>true})")
        expect(page.get_by_role('button', name=re.compile('Keep this answer'))).to_be_visible()
        assert not any(path.endswith('/stop/') for path in attempt.writes)
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
        expect(page.get_by_role('heading', name='Assessment interrupted')).to_be_visible()
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false})")
        attempt.fail_recovery = True
        page.get_by_role('button', name='Resume assessment').click()
        expect(page.get_by_role('alert')).to_contain_text('Recovery could not be confirmed')
        attempt.fail_recovery = False
        page.get_by_role('button', name='Resume assessment').click()
        expect(page.get_by_role('button', name=re.compile('Keep this answer'))).to_be_visible()
        assert attempt.draft[0]['selected_choice_id'] == 1
        assert not any(path.endswith('/stop/') for path in attempt.writes)
        page.reload(wait_until='networkidle')
        page.get_by_role('checkbox').check()
        page.get_by_role('button', name='Agree & start', exact=True).click()
        expect(page.get_by_role('heading', name='Assessment interrupted')).to_be_visible()
        page.get_by_role('button', name='Resume assessment').click()
        expect(page.get_by_role('button', name=re.compile('Keep this answer'))).to_be_visible()
        attempt.force_review = True
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
        expect(page.get_by_role('heading', name='Your assessment was stopped')).to_be_visible()
        expect(page.get_by_role('button', name='Request a retake')).to_be_visible()
        page.screenshot(path=str(OUT / 'interruption-review.png'), full_page=True)
        checks.append('Restricted shortcut warning, transient focus recovery, hidden interruption retry, preserved draft/reload, review stop and retake link')
        attempt.close()
    finally:
        browser.close()
assert not errors, errors
(OUT / 'results.json').write_text(json.dumps({'checks': checks, 'page_errors': errors}, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks, 'page_errors': errors}, indent=2))
