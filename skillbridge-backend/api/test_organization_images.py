from io import BytesIO
import json
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from .company_images import ImageStorageError
from .models import Institute, InstructorAssignment, Program, User
from .test_company_images import fixture


@override_settings(SUPABASE_STORAGE_URL='https://storage.example.invalid', COMPANY_IMAGE_BUCKET='synthetic-assets')
class OrganizationCardImageTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('image-admin@example.invalid', role='admin')
        self.instructor = User.objects.create_user('image-owner@example.invalid', role='instructor', is_approved=True)
        self.institute = Institute.objects.create(code='SYN', name='Synthetic institute')
        self.program = Program.objects.create(institute=self.institute, code='ANY', name='Synthetic program')
        InstructorAssignment.objects.create(instructor=self.instructor, program=self.program)
        self.institute_url = reverse('admin_institute_detail', args=[self.institute.id])
        self.program_url = reverse('admin_program_detail', args=[self.institute.id, self.program.id])
        self.client.force_authenticate(self.admin)

    def upload(self, url, *, name, file=None):
        return self.client.patch(url, {
            'payload': json.dumps({'name': name, 'image_action': 'replace'}),
            'image': file if file is not None else fixture(),
        }, format='multipart')

    def test_webp_uploaded_to_distinct_owned_paths_and_readable_by_assigned_instructor(self):
        with patch('api.company_images._storage_request') as storage:
            institute = self.upload(self.institute_url, name='Updated institute', file=fixture('JPEG', size=(1024, 800)))
            program = self.upload(self.program_url, name='Updated program')
        self.assertEqual((institute.status_code, program.status_code), (200, 200))
        for call, namespace in zip(storage.call_args_list, ('organization/institutes', 'organization/programs'), strict=True):
            method, key = call.args
            self.assertEqual(method, 'POST')
            self.assertTrue(key.startswith(namespace + '/'))
            self.assertEqual(call.kwargs['prefix'], namespace)
            self.assertEqual(call.kwargs['headers']['Content-Type'], 'image/webp')
            with Image.open(BytesIO(call.kwargs['data'])) as image:
                self.assertEqual(image.format, 'WEBP')
                self.assertLessEqual(max(image.size), 512)
        self.client.force_authenticate(self.instructor)
        options = self.client.get(reverse('staff_organization_options')).data
        self.assertEqual(options['institutes'][0]['image_url'], institute.data['image_url'])
        self.assertEqual(options['programs'][0]['image_url'], program.data['image_url'])
        with patch('api.company_images._storage_request') as storage:
            self.assertEqual(self.upload(self.program_url, name='Denied').status_code, 403)
            storage.assert_not_called()

    def test_all_twelve_banner_colors_persist_and_are_readable_without_uploads(self):
        with patch('api.company_images._storage_request') as storage:
            for color in range(12):
                for url in (self.institute_url, self.program_url):
                    saved = self.client.patch(url, {'banner_color': color}, format='json')
                    self.assertEqual((saved.status_code, saved.data['banner_color']), (200, color))
                options = self.client.get(reverse('staff_organization_options')).data
                self.assertEqual(options['institutes'][0]['banner_color'], color)
                self.assertEqual(options['programs'][0]['banner_color'], color)
            for color in (-1, 12, True, '1', 1.5, []):
                for url in (self.institute_url, self.program_url):
                    self.assertEqual(self.client.patch(url, {'banner_color': color}, format='json').status_code, 400)
            storage.assert_not_called()
        self.program.refresh_from_db()
        self.assertEqual(self.program.banner_color, 11)
        self.client.force_authenticate(self.instructor)
        self.assertEqual(self.client.get(reverse('staff_organization_options')).data['programs'][0]['banner_color'], 11)
        self.assertEqual(self.client.patch(self.program_url, {'banner_color': 0}, format='json').status_code, 403)

    def test_replacement_removal_and_failures_preserve_the_right_object(self):
        old_key = 'organization/programs/' + 'a' * 32 + '.webp'
        self.program.image_key = old_key
        self.program.save(update_fields=['image_key'])
        with patch('api.company_images._storage_request', side_effect=ImageStorageError()):
            self.assertEqual(self.upload(self.program_url, name='Unavailable').status_code, 503)
        self.program.refresh_from_db()
        self.assertEqual((self.program.name, self.program.image_key), ('Synthetic program', old_key))
        with patch('api.company_images._storage_request') as storage:
            bad_file = SimpleUploadedFile('corrupt.png', b'invalid', content_type='image/png')
            self.assertEqual(self.upload(self.program_url, name='Corrupt', file=bad_file).status_code, 400)
            self.assertEqual(self.client.patch(self.program_url, {'image_key': old_key}, format='json').status_code, 400)
            storage.assert_not_called()
        with patch('api.company_images._storage_request') as storage, patch('api.organization.record_action', side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                self.upload(self.program_url, name='Failed transaction')
            new_key = storage.call_args_list[0].args[1]
            self.assertEqual(storage.call_args_list[1].kwargs['json'], {'prefixes': [new_key]})
        self.program.refresh_from_db()
        self.assertEqual((self.program.name, self.program.image_key), ('Synthetic program', old_key))
        with patch('api.company_images._storage_request') as storage, self.captureOnCommitCallbacks(execute=True):
            result = self.upload(self.program_url, name='Replacement')
            self.assertEqual(result.status_code, 200)
        self.assertEqual(storage.call_args_list[-1].kwargs['json'], {'prefixes': [old_key]})
        self.program.refresh_from_db()
        new_key = self.program.image_key
        with patch('api.company_images._storage_request') as storage, self.captureOnCommitCallbacks(execute=True):
            result = self.client.patch(self.program_url, {'image_action': 'remove'}, format='json')
            self.assertEqual(result.status_code, 200)
            self.assertIsNone(result.data['image_url'])
        self.assertEqual(storage.call_args.kwargs['json'], {'prefixes': [new_key]})
