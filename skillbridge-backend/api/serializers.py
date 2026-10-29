from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    profile_review_required = serializers.SerializerMethodField()

    def get_profile_review_required(self, user):
        if user.role != 'student':
            return False
        from .assessment_progress import current_enrollment
        enrollment = current_enrollment(user)
        return bool(enrollment and enrollment.profile_review_required)

    class Meta:
        model  = User
        read_only_fields = ['photo_url']
        fields = ['id', 
                  'email', 
                  'name', 
                  'role', 
                  'school_id',
                  'course', 
                  'phone', 
                  'address', 
                  'photo_url', 
                  'is_approved', 'profile_review_required'
                  ]
