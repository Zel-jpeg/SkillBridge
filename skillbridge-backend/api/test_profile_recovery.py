"""Own-profile validation and atomic recommendation refresh using synthetic users."""
from unittest.mock import patch
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import Batch, BatchEnrollment, User


class ProfileRecoveryTests(APITestCase):
    def setUp(self):
        self.student = User.objects.create_user(email='profile-synthetic@example.com', name='Original Student', role='student',
            school_id='2026-00001', course='BSIT', phone='09123456789', address={'home': {'city': 'Tagum'}, 'pinLat': 7, 'pinLng': 125})
        self.other = User.objects.create_user(email='profile-other@example.com', role='student', school_id='2026-00002')
        self.client.force_authenticate(self.student)
        self.url = reverse('student_profile')

    def test_partial_contact_change_preserves_address_and_identity(self):
        result = self.client.patch(self.url, {'phone': '09987654321', 'role': 'admin', 'email': self.other.email}, format='json')
        self.assertEqual(result.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.address, {'home': {'city': 'Tagum'}, 'pinLat': 7, 'pinLng': 125})
        self.assertEqual(self.student.role, 'student')
        self.assertEqual(self.student.email, 'profile-synthetic@example.com')

    def test_malformed_fields_fail_without_partial_changes(self):
        cases = [('name', []), ('name', ''), ('studentId', 'invalid'), ('studentId', self.other.school_id),
                 ('course', 'Unsupported'), ('phone', 'bad'), ('phone', None), ('homeCity', {}),
                 ('stayingAt', 'invalid'), ('travelWilling', True), ('pinLat', 95), ('pinLat', 'NaN')]
        for field, value in cases:
            with self.subTest(field=field, value=value):
                response = self.client.patch(self.url, {'name': 'Must not save', field: value}, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data['field'], field)
                self.student.refresh_from_db()
                self.assertEqual(self.student.name, 'Original Student')

    def test_coordinate_pair_is_validated_and_zero_is_a_real_pin(self):
        for data in [{'pinLat': 7}, {'pinLat': None, 'pinLng': 125}, {'pinLat': True, 'pinLng': 125}]:
            self.assertEqual(self.client.patch(self.url, data, format='json').status_code, 400)
        for lat, lng in [(0, 0), ('7', '125'), (None, None)]:
            result = self.client.patch(self.url, {'pinLat': lat, 'pinLng': lng}, format='json')
            self.assertEqual(result.status_code, 200)
            self.student.refresh_from_db()
            self.assertEqual((self.student.address['pinLat'], self.student.address['pinLng']),
                             (float(lat), float(lng)) if lat is not None else (None, None))

    def test_failed_downstream_recalculation_rolls_back_profile_save(self):
        instructor = User.objects.create_user(email='profile-teacher@example.com', role='instructor')
        batch = Batch.objects.create(name='Synthetic refresh', instructor=instructor)
        BatchEnrollment.objects.create(batch=batch, student=self.student)
        with patch('api.views.combined_is_unlocked', return_value=True), patch('api.views.recalculate_combined', side_effect=RuntimeError('Synthetic refresh failure')):
            with self.assertRaises(RuntimeError):
                self.client.patch(self.url, {'name': 'Must roll back'}, format='json')
        self.student.refresh_from_db()
        self.assertEqual(self.student.name, 'Original Student')

    def test_foreign_role_and_unauthenticated_access_denied(self):
        admin = User.objects.create_user(email='profile-admin@example.com', role='admin')
        for user, expected in [(admin, 403), (None, 401)]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.patch(self.url, {'name': 'Blocked'}, format='json').status_code, expected)

    def test_nonobject_json_envelopes_fail_as_parse_errors(self):
        for value in [[], 'invalid', 42]:
            with self.subTest(value=value):
                result = self.client.patch(self.url, value, format='json')
                self.assertEqual(result.status_code, 400)
                self.assertEqual(str(result.data['detail']), 'Expected a JSON object.')
