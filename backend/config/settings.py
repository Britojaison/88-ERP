"""
Django settings for metadata-driven ERP platform.
"""
import os
from pathlib import Path
from datetime import timedelta
import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file from BASE_DIR
load_dotenv(BASE_DIR / '.env', override=True)

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-this-in-production')
DEBUG = os.getenv('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    
    # ERP Apps (order matters - no circular dependencies)
    'apps.core',
    'apps.audit',
    'apps.mdm',
    'apps.attributes',
    'apps.rbac',
    'apps.calendar',
    'apps.numbering',
    'apps.config',
    'apps.rules',
    'apps.workflow',
    'apps.documents',
    'apps.inventory',
    'apps.events',
    'apps.reporting',
    'apps.imports',
    'apps.search',
    'apps.integrations',
    'apps.sales',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database Configuration
# Try DATABASE_URL first (full connection string), then individual variables
DATABASE_URL = os.getenv('DATABASE_URL', '')
DB_ENGINE = os.getenv('DB_ENGINE', '')
DB_HOST = os.getenv('DB_HOST', '')
DB_PORT = os.getenv('DB_PORT', '5432')

# Check if using Supabase Transaction pooler (port 6543)
is_transaction_pooler = DB_PORT == '6543' or ':6543' in DATABASE_URL

if DATABASE_URL and 'postgresql' in DATABASE_URL:
    # Use full connection string
    import dj_database_url
    db_config = dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=0 if is_transaction_pooler else 60
    )
    
    # Add pgbouncer compatibility for transaction pooler
    if is_transaction_pooler:
        db_config['OPTIONS'] = {
            'sslmode': 'require',
            # Disable server-side cursors for pgbouncer transaction mode
            'options': '-c statement_timeout=60000',
        }
        db_config['DISABLE_SERVER_SIDE_CURSORS'] = True
    else:
        db_config['OPTIONS'] = {'sslmode': 'require'}
    
    DATABASES = {'default': db_config}
    
elif DB_ENGINE == 'django.db.backends.postgresql' and DB_HOST:
    # Use individual Supabase variables
    db_options = {
        'sslmode': 'require',
    }
    
    # Add pgbouncer compatibility for transaction pooler
    if is_transaction_pooler:
        db_options['options'] = '-c statement_timeout=60000'
    
    DATABASES = {
        'default': {
            'ENGINE': DB_ENGINE,
            'NAME': os.getenv('DB_NAME', 'postgres'),
            'USER': os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD'),
            'HOST': DB_HOST,
            'PORT': DB_PORT,
            'OPTIONS': db_options,
            'CONN_MAX_AGE': 0 if is_transaction_pooler else 60,
            'DISABLE_SERVER_SIDE_CURSORS': is_transaction_pooler,
        }
    }
else:
    # Fallback to SQLite for development
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Use schemas for logical separation
DATABASE_ROUTERS = ['config.db_router.LogicalDatabaseRouter']

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'apps.rbac.permissions.DynamicPermission',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'EXCEPTION_HANDLER': 'apps.core.exceptions.custom_exception_handler',
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': os.getenv('JWT_SECRET_KEY', SECRET_KEY),
}

# CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Elasticsearch
ELASTICSEARCH_DSL = {
    'default': {
        'hosts': os.getenv('ELASTICSEARCH_HOST', 'localhost:9200')
    },
}

# Audit Configuration
AUDIT_ENABLED = True
AUDIT_LOG_RETENTION_DAYS = 2555  # 7 years

# Custom User Model
AUTH_USER_MODEL = 'mdm.User'

# Shopify Integration
SHOPIFY_STORE_DOMAIN = os.getenv('SHOPIFY_STORE_DOMAIN', '')
SHOPIFY_ACCESS_TOKEN = os.getenv('SHOPIFY_ACCESS_TOKEN', '')
SHOPIFY_API_KEY = os.getenv('SHOPIFY_API_KEY', '')
SHOPIFY_API_SECRET = os.getenv('SHOPIFY_API_SECRET', '')
SHOPIFY_API_VERSION = os.getenv('SHOPIFY_API_VERSION', '2024-10')
