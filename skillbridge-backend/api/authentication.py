"""Recheck account access on every JWT request, not only when minting tokens."""
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import BatchEnrollment


class AccountJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if (user.role not in ('admin', 'instructor', 'student') or
                (user.role in ('instructor', 'student') and not user.is_approved) or
                (user.role == 'student' and not BatchEnrollment.objects.filter(student=user).exists())):
            raise AuthenticationFailed('Account access has changed. Please sign in again.', code='account_access_changed')
        return user
