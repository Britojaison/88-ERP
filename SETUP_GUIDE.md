# ERP Platform Setup Guide

## Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Node.js 18+
- Redis (optional, for Celery)
- Elasticsearch 8+ (optional, for search)

## Backend Setup

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv

# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Database Setup

Create PostgreSQL database and schemas:

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE erp_db;

-- Connect to the database
\c erp_db

-- Create schemas for logical separation
CREATE SCHEMA IF NOT EXISTS metadata;
CREATE SCHEMA IF NOT EXISTS transactions;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant permissions (adjust username as needed)
GRANT ALL PRIVILEGES ON SCHEMA metadata TO your_username;
GRANT ALL PRIVILEGES ON SCHEMA transactions TO your_username;
GRANT ALL PRIVILEGES ON SCHEMA audit TO your_username;
GRANT ALL PRIVILEGES ON SCHEMA analytics TO your_username;
```

### 4. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
SECRET_KEY=your-secret-key-here-generate-with-python-secrets
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DATABASE_URL=postgresql://username:password@localhost:5432/erp_db

# Optional services
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
ELASTICSEARCH_HOST=localhost:9200
```

### 5. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create Superuser

```bash
python manage.py createsuperuser
```

Follow prompts to create admin user.

### 7. Load Initial Data (Optional)

Create initial permissions and roles:

```bash
python manage.py shell
```

```python
from apps.rbac.models import Permission

# Create basic permissions
permissions = [
    ('inventory', 'view'),
    ('inventory', 'create'),
    ('inventory', 'update'),
    ('inventory', 'delete'),
    ('documents', 'view'),
    ('documents', 'create'),
    ('documents', 'approve'),
    ('mdm', 'view'),
    ('mdm', 'create'),
    ('mdm', 'update'),
]

for module, action in permissions:
    Permission.objects.get_or_create(
        code=f"{module}.{action}",
        defaults={'module': module, 'action': action}
    )

print("Permissions created!")
```

### 8. Run Development Server

```bash
python manage.py runserver
```

Server will be available at: http://localhost:8000

Admin panel: http://localhost:8000/admin

### 9. Start Celery (Optional)

In separate terminals:

```bash
# Worker
celery -A config worker -l info

# Beat scheduler
celery -A config beat -l info
```

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=http://localhost:8000/api
```

### 3. Run Development Server

```bash
npm run dev
```

Frontend will be available at: http://localhost:5173

## Testing the Setup

### 1. Test API

```bash
# Get JWT token
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "password": "yourpassword"}'

# Use token for authenticated requests
curl -X GET http://localhost:8000/api/mdm/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2. Test Admin Panel

1. Go to http://localhost:8000/admin
2. Login with superuser credentials
3. Explore the models

## Initial Configuration

### 1. Create Company

Via admin panel or API:
- Go to MDM > Companies
- Create your first company

### 2. Create Attribute Definitions

For SKU attributes (size, color, etc.):
- Go to Attributes > Attribute Definitions
- Create attributes for your use case

Example for fashion:
- Entity Type: `sku`
- Code: `size`
- Data Type: `string`
- Is Variant Dimension: `True`

### 3. Create Workflows

- Go to Workflow > Workflows
- Define workflows for your document types
- Create states and transitions

### 4. Create Roles and Permissions

- Go to RBAC > Roles
- Create roles (e.g., "Warehouse Manager", "Buyer")
- Assign permissions to roles

## Development Workflow

### 1. Create New Models

```bash
# Edit apps/your_app/models.py
python manage.py makemigrations
python manage.py migrate
```

### 2. Create Serializers

Create in `apps/your_app/serializers.py`

### 3. Create Services

Business logic goes in `apps/your_app/services.py`

### 4. Create ViewSets

API endpoints in `apps/your_app/views.py`

### 5. Register URLs

Update `apps/your_app/urls.py`

## Common Issues

### Issue: Migration Errors

```bash
# Reset migrations (development only!)
python manage.py migrate --fake-initial
```

### Issue: Permission Denied

Check PostgreSQL user permissions:

```sql
GRANT ALL PRIVILEGES ON DATABASE erp_db TO your_username;
```

### Issue: Celery Not Starting

Ensure Redis is running:

```bash
redis-cli ping
# Should return: PONG
```

## Production Deployment

### 1. Environment Variables

Set production values:
- `DEBUG=False`
- Strong `SECRET_KEY`
- Proper `ALLOWED_HOSTS`
- Production database URL

### 2. Static Files

```bash
python manage.py collectstatic
```

### 3. Use Production Server

```bash
# Install gunicorn
pip install gunicorn

# Run
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

### 4. Use Process Manager

Use systemd, supervisor, or Docker to manage processes.

### 5. Setup Nginx

Configure Nginx as reverse proxy.

## Next Steps

1. Configure your company and business units
2. Define attribute schemas for your products
3. Create workflows for your documents
4. Set up roles and permissions
5. Import master data (products, customers, vendors)
6. Start creating documents

## Support

For issues and questions, refer to the main README.md or contact the development team.
