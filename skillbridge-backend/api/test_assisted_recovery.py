from io import StringIO
from unittest.mock import patch
from django.core.cache import cache
from django.core.management import call_command, CommandError
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import User


class AssistedAdminRecoveryTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(email='recovery-admin@example.com', name='Synthetic Admin', role='admin', password='Old-synthetic-admin-2026')
        self.other = User.objects.create_user(email='other-admin@example.com', name='Other Admin', role='admin', password='Other-synthetic-admin-2026')

    def login(self, password):
        return self.client.post(reverse('login'), {'email': self.admin.email, 'password': password}, format='json')

    def test_operator_command_recovers_only_selected_account_without_mail(self):
        old_hash = self.other.password
        with patch('django.contrib.auth.management.commands.changepassword.Command._get_pass', return_value='Recovered-synthetic-admin-2026'), patch('django.core.mail.send_mail') as mail:
            call_command('changepassword', self.admin.email, stdout=StringIO())
            mail.assert_not_called()
        self.assertEqual(self.login('Old-synthetic-admin-2026').status_code, 401)
        self.assertEqual(self.login('Recovered-synthetic-admin-2026').status_code, 200)
        self.admin.refresh_from_db()
        self.other.refresh_from_db()
        self.assertNotEqual(self.admin.password, 'Recovered-synthetic-admin-2026')
        self.assertEqual(self.other.password, old_hash)

    @override_settings(AUTH_PASSWORD_VALIDATORS=[{'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}}])
    def test_invalid_or_mismatched_password_never_replaces_original(self):
        original = self.admin.password
        for values in [['short'] * 6, ['Synthetic-password-one', 'Synthetic-password-two'] * 3]:
            with patch('django.contrib.auth.management.commands.changepassword.Command._get_pass', side_effect=values):
                with self.assertRaises(CommandError):
                    call_command('changepassword', self.admin.email, stdout=StringIO(), stderr=StringIO())
            self.admin.refresh_from_db()
            self.assertEqual(self.admin.password, original)
        self.assertEqual(self.login('Old-synthetic-admin-2026').status_code, 200)

    def test_unknown_operator_account_causes_no_mutation(self):
        with self.assertRaises(CommandError):
            call_command('changepassword', 'unknown-synthetic@example.com', stdout=StringIO())
        self.assertEqual(User.objects.count(), 2)
