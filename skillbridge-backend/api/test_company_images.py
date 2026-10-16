"""Generated fixtures and mocked HTTP only. No production services or emails."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
import random
from threading import Event
from unittest import skipUnless
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from PIL import Image, ImageDraw, PngImagePlugin, features
import requests
from rest_framework.test import APIClient, APITestCase

from . import company_images as images
from . import tests as existing_tests
from .models import Batch, BatchEnrollment, ChangeEvent, Company, OJTPlacement, Position, User

OLD_KEY = 'companies/' + 'a' * 32 + '.webp'
STORAGE = dict(SUPABASE_STORAGE_URL='https://synthetic.supabase.co',
               SUPABASE_STORAGE_SERVICE_KEY='synthetic-service-credential',
               COMPANY_IMAGE_BUCKET='company-branding')


def fixture(fmt='PNG', size=(120, 60), alpha=False, **options):
    image = Image.new('RGBA' if alpha else 'RGB', size, (32, 128, 64, 80) if alpha else (32, 128, 64))
    ImageDraw.Draw(image).rectangle((5, 5, 20, 20), fill=(255, 255, 255, 0) if alpha else 'white')
    out = BytesIO()
    image.save(out, format=fmt, **options)
    return SimpleUploadedFile('synthetic.untrusted', out.getvalue(), content_type='application/octet-stream')


class ConversionTests(SimpleTestCase):
    def test_webp_support_and_decoded_formats_not_filename_or_mime(self):
        self.assertTrue(features.check('webp'))
        for fmt in ('JPEG', 'PNG', 'WEBP'):
            with self.subTest(fmt=fmt):
                result = images.convert_company_image(fixture(fmt, size=(1600, 800)))
                with Image.open(BytesIO(result)) as decoded:
                    self.assertEqual(decoded.format, 'WEBP')
                    self.assertEqual(decoded.size, (512, 256))
                    decoded.load()
                self.assertLessEqual(len(result), images.MAX_OUTPUT_BYTES)

    def test_transparency_small_dimensions_and_metadata(self):
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text('private-comment', 'synthetic metadata to remove')
        result = images.convert_company_image(fixture(alpha=True, pnginfo=metadata))
        with Image.open(BytesIO(result)) as decoded:
            self.assertEqual(decoded.size, (120, 60))
            self.assertEqual(decoded.convert('RGBA').getpixel((10, 10))[3], 0)
            self.assertEqual(decoded.convert('RGBA').getpixel((50, 40))[3], 80)
            self.assertFalse(decoded.getexif())
            self.assertFalse({'exif', 'icc_profile', 'xmp', 'private-comment'} & decoded.info.keys())

    def test_exif_orientation_applied_then_metadata_removed(self):
        exif = Image.Exif()
        exif[274] = 6
        exif[315] = 'Synthetic artist'
        result = images.convert_company_image(fixture('JPEG', exif=exif, icc_profile=b'synthetic-icc'))
        with Image.open(BytesIO(result)) as decoded:
            self.assertEqual(decoded.size, (60, 120))
            self.assertFalse(decoded.getexif())
            self.assertNotIn('icc_profile', decoded.info)

    def test_invalid_formats_and_corrupt_content(self):
        invalid = [fixture('GIF'), fixture('BMP'),
                   SimpleUploadedFile('fake.png', b'<svg xmlns="http://www.w3.org/2000/svg"/>'),
                   SimpleUploadedFile('fake.jpg', b'not an image'),
                   SimpleUploadedFile('broken.jpg', fixture('JPEG').read()[:30])]
        for upload in invalid:
            with self.subTest(name=upload.name), self.assertRaises(images.ImageValidationError):
                images.convert_company_image(upload)

    def test_animated_png_and_webp_rejected(self):
        for fmt in ('PNG', 'WEBP'):
            output = BytesIO()
            Image.new('RGB', (20, 20), 'red').save(output, format=fmt, save_all=True,
                append_images=[Image.new('RGB', (20, 20), 'blue')], duration=100, loop=0)
            with self.subTest(fmt=fmt), self.assertRaisesMessage(images.ImageValidationError, 'Animated'):
                images.convert_company_image(SimpleUploadedFile('animation', output.getvalue()))

    def test_byte_pixel_and_side_limits_before_decode(self):
        upload = SimpleUploadedFile('large.png', b'x' * (images.MAX_INPUT_BYTES + 1))
        with patch.object(Image, 'open') as decoder, self.assertRaises(images.ImageValidationError):
            images.convert_company_image(upload)
        decoder.assert_not_called()
        for width, height in ((5000, 4001), (10001, 1)):
            output = BytesIO()
            Image.new('L', (width, height)).save(output, format='PNG')
            with self.subTest(size=(width, height)), self.assertRaisesMessage(images.ImageValidationError, '20 megapixels'):
                images.convert_company_image(SimpleUploadedFile('too-large.png', output.getvalue()))

    def test_output_budget_is_bounded_and_can_fail_clearly(self):
        upload = fixture()
        with patch.object(images, 'MAX_OUTPUT_BYTES', 1), patch.object(Image.Image, 'save', autospec=True,
                side_effect=lambda image, stream, **kwargs: stream.write(b'xx')) as encoder:
            with self.assertRaisesMessage(images.ImageValidationError, '200 KiB'):
                images.convert_company_image(upload)
            self.assertEqual(encoder.call_count, len(images.ENCODING_STEPS))

    def test_representative_compression_measurements(self):
        noise = Image.frombytes('RGB', (1024, 768), random.Random(42).randbytes(1024 * 768 * 3))
        measurements = []
        for fmt in ('JPEG', 'PNG', 'WEBP'):
            original = BytesIO()
            noise.save(original, format=fmt)
            raw = original.getvalue()
            output = images.convert_company_image(SimpleUploadedFile('noise', raw))
            with Image.open(BytesIO(output)) as decoded:
                measurements.append(f'{fmt}: 1024x768/{len(raw)} B -> {decoded.width}x{decoded.height}/{len(output)} B')
            self.assertLessEqual(len(output), images.MAX_OUTPUT_BYTES)
        print('\nSynthetic compression: ' + '; '.join(measurements))

    def test_alpha_entropy_triggers_bounded_downscaling(self):
        original = BytesIO()
        Image.frombytes('RGBA', (512, 512), random.Random(73).randbytes(512 * 512 * 4)).save(original, format='PNG')
        result = images.convert_company_image(SimpleUploadedFile('alpha-noise.png', original.getvalue()))
        with Image.open(BytesIO(result)) as decoded:
            self.assertLess(decoded.width, 512)
            self.assertIn('A', decoded.getbands())
            print(f'\nAlpha-noise compression: PNG 512x512/{len(original.getvalue())} B -> WebP {decoded.width}x{decoded.height}/{len(result)} B')
        self.assertLessEqual(len(result), images.MAX_OUTPUT_BYTES)

    def test_palette_transparency_is_not_flattened(self):
        source = Image.new('P', (40, 20), 0)
        source.putpalette([255, 0, 0, 0, 0, 255] + [0] * 762)
        source.putpixel((10, 10), 1)
        out = BytesIO()
        source.save(out, format='PNG', transparency=0)
        result = images.convert_company_image(SimpleUploadedFile('palette.png', out.getvalue()))
        with Image.open(BytesIO(result)) as decoded:
            self.assertEqual(decoded.convert('RGBA').getpixel((0, 0))[3], 0)
            self.assertEqual(decoded.convert('RGBA').getpixel((10, 10))[3], 255)


@override_settings(**STORAGE)
class CompanyImageAPITests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('admin@synthetic.invalid', name='Admin', role='admin')
        self.teacher = User.objects.create_user('teacher@synthetic.invalid', name='Teacher', role='instructor', is_approved=True)
        self.student = User.objects.create_user('student@dnsc.edu.ph', name='Student', role='student', is_approved=True)
        self.batch = Batch.objects.create(name='Synthetic batch', instructor=self.teacher)
        BatchEnrollment.objects.create(student=self.student, batch=self.batch)
        self.company = Company.objects.create(name='Synthetic company', added_by=self.admin, image_key=OLD_KEY)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = f'/api/admin/companies/{self.company.id}/'
        self.http = self.enterContext(patch('api.company_images.requests.request'))
        self.http.return_value = Mock(status_code=200)

    def replace(self, url=None, method='patch', **details):
        return getattr(self.client, method)(url or self.url, {
            'payload': json.dumps({'image_action': 'replace', **details}), 'image': fixture(),
        }, format='multipart')

    def test_create_without_image_and_old_json_clients(self):
        result = self.client.post('/api/admin/companies/', {
            'name': 'No image', 'address': {'city': 'Synthetic City'}, 'lat': None, 'lng': None,
        }, format='json')
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.data['image_key'], '')
        self.assertIsNone(result.data['image_url'])
        self.http.assert_not_called()
        result = self.client.patch(self.url, {'address': {'street': 'Synthetic Street'}, 'lat': 7.3}, format='json')
        self.assertEqual(result.status_code, 200)
        self.company.refresh_from_db()
        self.assertEqual(self.company.image_key, OLD_KEY)
        self.assertEqual(self.company.address, {'street': 'Synthetic Street'})

    def test_create_uploads_only_webp_and_no_partial_company(self):
        result = self.replace('/api/admin/companies/', method='post', name='With image', address={'city': 'Synthetic'})
        self.assertEqual(result.status_code, 201)
        self.assertTrue(result.data['image_key'].endswith('.webp'))
        args, kwargs = self.http.call_args
        self.assertEqual(args[0], 'POST')
        self.assertEqual(kwargs['headers']['Content-Type'], 'image/webp')
        self.assertEqual(kwargs['timeout'], images.STORAGE_TIMEOUT)
        self.assertFalse(kwargs['allow_redirects'])
        with Image.open(BytesIO(kwargs['data'])) as decoded:
            self.assertEqual(decoded.format, 'WEBP')
        self.assertEqual(Company.objects.get(pk=result.data['id']).address, {'city': 'Synthetic'})
        self.http.side_effect = requests.Timeout()
        with self.assertLogs('api.company_images', level='ERROR'):
            failed = self.replace('/api/admin/companies/', method='post', name='Must not persist')
        self.assertEqual(failed.status_code, 503)
        self.assertFalse(Company.objects.filter(name='Must not persist').exists())

    def test_replacement_removal_cleanup_waits_for_commit(self):
        with self.captureOnCommitCallbacks(execute=True):
            result = self.replace(name='Renamed')
            self.assertEqual(result.status_code, 200)
            self.assertEqual(self.http.call_count, 1)
            self.company.refresh_from_db()
            new_key = self.company.image_key
            self.assertNotEqual(new_key, OLD_KEY)
        self.assertEqual(self.http.call_args.kwargs['json'], {'prefixes': [OLD_KEY]})
        self.http.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            removed = self.client.patch(self.url, {'image_action': 'remove'}, format='json')
            self.assertEqual(removed.status_code, 200)
            self.http.assert_not_called()
        self.company.refresh_from_db()
        self.assertEqual(self.company.image_key, '')
        self.assertEqual(self.http.call_args.kwargs['json'], {'prefixes': [new_key]})

    def test_storage_failure_keeps_all_old_details_and_publishes_nothing(self):
        self.http.side_effect = requests.ConnectionError()
        with self.assertLogs('api.company_images', level='ERROR'), self.captureOnCommitCallbacks(execute=True):
            result = self.replace(name='Must roll back')
        self.assertEqual(result.status_code, 503)
        self.company.refresh_from_db()
        self.assertEqual((self.company.name, self.company.image_key), ('Synthetic company', OLD_KEY))
        self.assertFalse(ChangeEvent.objects.exists())

    def test_db_failure_cleans_new_orphan_and_keeps_old(self):
        self.client.raise_request_exception = False
        with patch.object(Company, 'save', side_effect=IntegrityError('synthetic DB failure')):
            with self.captureOnCommitCallbacks(execute=True):
                result = self.replace(name='Must roll back')
        self.assertEqual(result.status_code, 500)
        self.company.refresh_from_db()
        self.assertEqual(self.company.image_key, OLD_KEY)
        new_url = self.http.call_args_list[0].args[1]
        self.assertEqual(self.http.call_args_list[1].kwargs['json'], {'prefixes': [new_url.split('/company-branding/')[1]]})
        self.assertFalse(ChangeEvent.objects.exists())

    def test_later_position_failure_rolls_back_company_and_cleans_upload(self):
        position = Position.objects.create(company=self.company, title='Intern')
        self.client.force_authenticate(self.teacher)
        self.client.raise_request_exception = False
        with patch.object(Position, 'save', side_effect=IntegrityError('synthetic position failure')):
            result = self.replace(f'/api/instructor/companies/{self.company.id}/', name='Must roll back',
                                  positions=[{'id': position.id, 'title': 'Changed', 'slots': 2}])
        self.assertEqual(result.status_code, 500)
        self.company.refresh_from_db()
        self.assertEqual(self.company.name, 'Synthetic company')
        self.assertEqual(self.company.image_key, OLD_KEY)
        self.assertEqual(self.http.call_count, 2)

    def test_cleanup_failure_logs_without_failing_committed_save(self):
        def http(method, *args, **kwargs):
            if method == 'DELETE':
                raise requests.Timeout()
            return Mock(status_code=201)
        self.http.side_effect = http
        with self.assertLogs('api.company_images', level='ERROR'), self.captureOnCommitCallbacks(execute=True):
            result = self.replace()
        self.assertEqual(result.status_code, 200)
        self.company.refresh_from_db()
        self.assertNotEqual(self.company.image_key, OLD_KEY)

    def test_delayed_cleanup_never_deletes_current_or_foreign_keys(self):
        images.cleanup_image(OLD_KEY)
        for key in ('../outside.webp', 'students/' + 'a' * 32 + '.webp', 'companies/legacy.png'):
            images.cleanup_image(key)
        self.http.assert_not_called()
        # Two replacements commit before deferred cleanup callbacks execute.
        with self.captureOnCommitCallbacks(execute=True):
            first = self.replace()
            second = self.replace()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertNotEqual(first.data['image_key'], second.data['image_key'])
        deleted = [call.kwargs['json']['prefixes'][0] for call in self.http.call_args_list if call.args[0] == 'DELETE']
        self.assertEqual(deleted, [OLD_KEY, first.data['image_key']])
        self.assertNotIn(second.data['image_key'], deleted)

    def test_delete_after_success_and_protected_history_keeps_image(self):
        position = Position.objects.create(company=self.company, title='Intern')
        OJTPlacement.objects.create(student=self.student, company=self.company, position=position, batch=self.batch)
        with self.captureOnCommitCallbacks(execute=True):
            result = self.client.delete(self.url)
        self.assertEqual(result.status_code, 409)
        self.http.assert_not_called()
        OJTPlacement.objects.all().delete()
        with self.captureOnCommitCallbacks(execute=True):
            result = self.client.delete(self.url)
            self.http.assert_not_called()
        self.assertEqual(result.status_code, 204)
        self.assertEqual(self.http.call_args.kwargs['json'], {'prefixes': [OLD_KEY]})

    def test_anonymous_and_student_cannot_create_replace_or_remove(self):
        for user in (None, self.student):
            self.client.force_authenticate(user)
            for url in (self.url, f'/api/instructor/companies/{self.company.id}/'):
                self.assertIn(self.replace(url).status_code, (401, 403))
                self.assertIn(self.client.patch(url, {'image_action': 'remove'}, format='json').status_code, (401, 403))
            self.assertIn(self.replace('/api/admin/companies/', method='post', name='Denied').status_code, (401, 403))
        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.replace('/api/admin/companies/', method='post', name='Denied').status_code, 403)
        self.http.assert_not_called()

    def test_multipart_structured_validation_and_action_contract(self):
        cases = [({'payload': 'not JSON'}, 'multipart'), ({'payload': '[]'}, 'multipart'),
                 ({'payload': json.dumps({'address': 'not an object'})}, 'multipart'),
                 ({'payload': json.dumps({'positions': [1]})}, 'multipart'),
                 ({'image_action': 'replace'}, 'json'), ({'image_action': 'bogus'}, 'json'),
                 ({'image_key': OLD_KEY}, 'json'), ({'image_url': 'https://foreign.invalid'}, 'json')]
        for payload, fmt in cases:
            with self.subTest(payload=payload):
                self.assertEqual(self.client.patch(self.url, payload, format=fmt).status_code, 400)
        for action in ('unchanged', 'remove'):
            result = self.client.patch(self.url, {'payload': json.dumps({'image_action': action}), 'image': fixture()}, format='multipart')
            self.assertEqual(result.status_code, 400)
        self.http.assert_not_called()

    def test_invalid_image_returns_clear_error_before_any_write(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(self.url, {
                'payload': json.dumps({'name': 'Must not save', 'image_action': 'replace'}),
                'image': SimpleUploadedFile('pretend.png', b'<svg/>', content_type='image/png'),
            }, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('image', str(response.data['error']))
        self.company.refresh_from_db()
        self.assertEqual(self.company.name, 'Synthetic company')
        self.http.assert_not_called()
        self.assertFalse(ChangeEvent.objects.exists())

    def test_missing_storage_config_cannot_change_reference(self):
        with override_settings(SUPABASE_STORAGE_SERVICE_KEY=''):
            with self.assertLogs('api.company_images', level='ERROR'):
                response = self.replace()
        self.assertEqual(response.status_code, 503)
        self.company.refresh_from_db()
        self.assertEqual(self.company.image_key, OLD_KEY)
        self.http.assert_not_called()

    def test_legacy_no_file_multipart_still_accepts_structured_json(self):
        response = self.client.patch(self.url, {
            'name': 'Legacy client', 'address': json.dumps({'city': 'Synthetic City'}), 'lat': 'null',
        }, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.company.refresh_from_db()
        self.assertEqual(self.company.address, {'city': 'Synthetic City'})
        self.assertIsNone(self.company.location_lat)
        self.assertEqual(self.company.image_key, OLD_KEY)

    def test_catalog_notifications_after_complete_success_contain_no_images(self):
        with self.captureOnCommitCallbacks(execute=True):
            result = self.replace()
            self.assertFalse(ChangeEvent.objects.exists())
        self.assertEqual(result.status_code, 200)
        self.assertTrue(ChangeEvent.objects.filter(recipient=self.student).exists())
        for event in ChangeEvent.objects.all():
            self.assertIn('placements', event.payload['topics'])
            self.assertIn('results', event.payload['topics'])
            self.assertEqual(set(event.payload), {'topics'})

    def test_google_photo_refresh_clear_and_scoped_notifications(self):
        self.student.photo_url = 'https://synthetic.invalid/old.png'
        self.student.save(update_fields=['photo_url'])
        foreign = User.objects.create_user('other@synthetic.invalid', name='Other', role='instructor', is_approved=True)
        for picture in ('https://synthetic.invalid/new.png', None):
            userinfo = {'email': self.student.email, 'name': 'Student', 'email_verified': True}
            if picture: userinfo['picture'] = picture
            with patch('api.views.http_requests.get', return_value=Mock(status_code=200, json=lambda: userinfo)):
                with self.captureOnCommitCallbacks(execute=True):
                    result = self.client.post('/api/auth/google/', {'token': 'synthetic'}, format='json')
            self.assertEqual(result.status_code, 200)
            self.student.refresh_from_db()
            self.assertEqual(self.student.photo_url, picture or '')
            self.assertEqual(result.data['user']['photo_url'], picture or '')
        self.assertFalse(ChangeEvent.objects.filter(recipient=foreign).exists())
        self.assertIn('placements', ChangeEvent.objects.filter(recipient=self.teacher).first().payload['topics'])

    def test_clients_cannot_replace_provider_photo_and_invalid_google_is_unchanged(self):
        self.student.photo_url = 'https://synthetic.invalid/provider.png'
        self.student.save(update_fields=['photo_url'])
        self.client.force_authenticate(self.student)
        response = self.client.patch('/api/students/me/profile/', {
            'photo_url': 'https://synthetic.invalid/client-controlled.png', 'phone': '09123456789',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.photo_url, 'https://synthetic.invalid/provider.png')

        with patch('api.views.http_requests.get', return_value=Mock(status_code=401)):
            with self.captureOnCommitCallbacks(execute=True):
                result = self.client.post('/api/auth/google/', {'token': 'invalid-synthetic'}, format='json')
        self.assertEqual(result.status_code, 401)
        self.student.refresh_from_db()
        self.assertEqual(self.student.photo_url, 'https://synthetic.invalid/provider.png')

    def test_role_registration_refreshes_missing_picture_without_changing_identity(self):
        self.student.photo_url = 'https://synthetic.invalid/old.png'
        self.student.save(update_fields=['photo_url'])
        userinfo = {'email': self.student.email, 'name': self.student.name, 'email_verified': True}
        with patch('api.views.http_requests.get', return_value=Mock(status_code=200, json=lambda: userinfo)):
            with self.captureOnCommitCallbacks(execute=True):
                result = self.client.post('/api/auth/register-role/', {'token': 'synthetic', 'role': 'instructor'}, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['id'], self.student.id)
        self.student.refresh_from_db()
        self.assertEqual(self.student.photo_url, '')
        self.assertEqual(self.student.role, 'student')
        self.assertTrue(ChangeEvent.objects.filter(recipient=self.teacher).exists())


@override_settings(**STORAGE)
class ImagePayloadTests(APITestCase):
    def setUp(self):
        existing_tests.OJTPlacementAPITests.setUp(self)
        self.student_one.photo_url = 'https://synthetic.invalid/google-photo.png'
        self.student_one.save(update_fields=['photo_url'])
        self.company.image_key = OLD_KEY
        self.company.save(update_fields=['image_key'])

    def test_company_recommendation_and_placement_payloads_preserve_photo_and_scores(self):
        self.client.force_authenticate(self.admin)
        approved = self.client.post('/api/placements/approve/', {'recommendation_id': self.recommendation_one.id}, format='json')
        self.assertEqual(approved.status_code, 201)
        saved_score = approved.data['placement']['match_score_at_assignment']
        for user in (self.admin, self.instructor):
            self.client.force_authenticate(user)
            suggestions = self.client.get('/api/placements/suggestions/?include_placed=true').data
            company = next(c for c in suggestions['companies'] if c['id'] == self.company.id)
            self.assertEqual(company['image_url'], images.company_image_url(OLD_KEY))
            student = next(s for p in company['positions'] for s in p['suggested_students'] if s['student']['id'] == self.student_one.id)
            self.assertEqual(student['student']['photo_url'], self.student_one.photo_url)
            self.assertEqual(student['approved_placement']['company_image_url'], company['image_url'])
            self.assertEqual(next(s for s in suggestions['eligible_students'] if s['id'] == self.student_one.id)['photo_url'], self.student_one.photo_url)
            history = self.client.get('/api/placements/').data['placements'][0]
            self.assertEqual(history['student']['photo_url'], self.student_one.photo_url)
            self.assertEqual(history['company']['image_url'], company['image_url'])
            self.assertEqual(history['match_score_at_assignment'], saved_score)
        for user, url in ((self.admin, '/api/admin/companies/'), (self.instructor, '/api/instructor/companies/'), (self.student_one, '/api/student/companies/')):
            self.client.force_authenticate(user)
            company = next(c for c in self.client.get(url).data if c['id'] == self.company.id)
            self.assertEqual(company['image_url'], images.company_image_url(OLD_KEY))
        self.client.force_authenticate(self.student_one)
        self.assertEqual(self.client.get('/api/students/me/').data['placement']['company']['image_url'], images.company_image_url(OLD_KEY))
        recs = self.client.get('/api/student/results/combined/').data['recommendations']
        self.assertEqual(next(r for r in recs if r['position_id'] == self.position.id)['company_image_url'], images.company_image_url(OLD_KEY))


@skipUnless(connection.vendor == 'postgresql', 'Requires dedicated PostgreSQL row-lock verification')
@override_settings(**STORAGE)
class ConcurrentCompanyImageTests(TransactionTestCase):
    def test_replacement_and_removal_serialize_and_cleanup_only_retired_objects(self):
        admin = User.objects.create_user('concurrent@synthetic.invalid', name='Admin', role='admin')
        company = Company.objects.create(name='Concurrent', added_by=admin, image_key=OLD_KEY)
        uploaded, release = Event(), Event()
        calls = []
        def upload(key, content):
            calls.append(key)
            uploaded.set()
            self.assertTrue(release.wait(10))
        def mutate(action):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=admin.pk))
                data = {'image_action': action}
                if action == 'replace':
                    return client.patch(f'/api/admin/companies/{company.pk}/', {'payload': json.dumps(data), 'image': fixture()}, format='multipart').status_code
                return client.patch(f'/api/admin/companies/{company.pk}/', data, format='json').status_code
            finally:
                close_old_connections()
        with patch('api.company_images.upload_image', side_effect=upload), patch('api.company_images._storage_request') as storage:
            with ThreadPoolExecutor(max_workers=2) as pool:
                replacing = pool.submit(mutate, 'replace')
                self.assertTrue(uploaded.wait(10))
                removing = pool.submit(mutate, 'remove')
                release.set()
                self.assertEqual(replacing.result(timeout=15), 200)
                self.assertEqual(removing.result(timeout=15), 200)
        company.refresh_from_db()
        self.assertEqual(company.image_key, '')
        self.assertEqual({c.kwargs['json']['prefixes'][0] for c in storage.call_args_list}, {OLD_KEY, calls[0]})
