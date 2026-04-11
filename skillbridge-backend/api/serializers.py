from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ['id', 
                  'email', 
                  'name', 
                  'role', 
                  'school_id',
                  'course', 
                  'phone', 
                  'address', 
                  'photo_url', 
                  'is_approved'
                  ]