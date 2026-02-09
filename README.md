# Metadata-Driven ERP Platform

A production-grade, industry-agnostic ERP platform built on metadata-driven architecture.

## Core Principles

- **Metadata-Driven**: All business logic configured via database, not code
- **Industry-Agnostic**: No hard-coded business rules or industry assumptions
- **Configuration-First**: Behavior controlled by metadata tables
- **ACID-Correct**: Strong transactional guarantees
- **Audit-Safe**: Immutable audit trail for all operations

## Tech Stack

### Backend
- Python 3.11+
- Django 4.2+
- Django REST Framework
- PostgreSQL (via Supabase supported)
- Celery for background jobs
- Elasticsearch for search

### Frontend
- React 18+
- TypeScript
- MUI or Ant Design
- React Hook Form
- Redux Toolkit / Zustand

## Architecture

### Logical Data Separation
Uses PostgreSQL schemas for logical separation:
- **metadata**: Attributes, workflows, rules, permissions
- **transactions**: Documents, inventory, master data
- **audit**: Immutable audit logs
- **analytics**: Reporting and aggregations

### Core Modules

1. **core** - Shared utilities and base models
2. **mdm** - Master Data Management (Company, User, Product, SKU, etc.)
3. **attributes** - Dynamic attribute engine (NO hard-coded fields)
4. **rbac** - Role-Based Access Control (runtime permission evaluation)
5. **workflow** - State machine engine (metadata-driven workflows)
6. **documents** - Document engine (PO, SO, Invoice, etc.)
7. **inventory** - Inventory management (attribute-based)
8. **config** - Configuration engine
9. **rules** - Validation/business rule engine
10. **numbering** - Sequence/numbering engine
11. **calendar** - Period and calendar management
12. **audit** - Audit service (append-only)
13. **reporting** - Reporting and analytics
14. **imports** - Data import framework
15. **search** - Search abstraction layer
16. **integrations** - External integrations

## Setup

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

### Database Setup

```sql
-- Create schemas for logical separation
CREATE SCHEMA IF NOT EXISTS metadata;
CREATE SCHEMA IF NOT EXISTS transactions;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;
```

### Celery Setup

```bash
# Start Celery worker
celery -A config worker -l info

# Start Celery beat (for scheduled tasks)
celery -A config beat -l info
```

## Key Features

### 1. Attribute Engine
- NO hard-coded attributes (size, color, fabric, etc.)
- All attributes defined in database
- Supports variant dimensions
- Type-safe validation
- Searchable and filterable

### 2. RBAC Engine
- Permissions evaluated at runtime
- Conditional permissions via JSONLogic
- Row-level security
- NO hard-coded role checks

### 3. Workflow Engine
- State machine based
- Metadata-driven transitions
- Conditional approvals
- Audit trail for all state changes

### 4. Document Engine
- Generic document framework
- Document types configured via metadata
- Line-item support
- Workflow integration

### 5. Inventory Engine
- Attribute-based stock tracking
- Multi-location support
- Stock aging calculations
- ACID-compliant movements

### 6. Rule Engine
- Pre-save and pre-submit validations
- Stored as metadata
- Reusable across entities
- JSONLogic expressions

### 7. Numbering Engine
- Configurable formats
- Scoped sequences (company/location/year)
- Concurrency-safe
- Never uses max(id)+1

## Product Hierarchy

```
Product (design/concept)
  └── Style (optional grouping)
      └── SKU (sellable unit)
          └── Inventory Balance
```

**CRITICAL**: Inventory ALWAYS references SKU, never Product.

## Attribute System Example

Instead of hard-coded fields:
```python
# ❌ WRONG
class SKU:
    size = models.CharField()
    color = models.CharField()
    fabric = models.CharField()
```

Use dynamic attributes:
```python
# ✅ CORRECT
# Define attributes in database
AttributeDefinition(entity_type='sku', code='size', data_type='string')
AttributeDefinition(entity_type='sku', code='color', data_type='string')
AttributeDefinition(entity_type='sku', code='fabric', data_type='string')

# Values stored in AttributeValue table
AttributeValue(entity=sku_instance, attribute='size', value='M')
```

## Error Handling

All errors use structured format:
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "SKU A123 size M has only 2 units at Store X. Requested: 5, Available: 2",
    "details": {
      "sku_code": "A123",
      "location": "Store X",
      "requested": 5,
      "available": 2
    }
  }
}
```

## Forbidden Patterns

❌ Hard-coded size/color/category fields
❌ Hard-coded workflows
❌ Business rules in serializers/views
❌ `if industry == fashion`
❌ Permission checks via role strings
❌ Deleting business data (use soft delete)
❌ `max(id)+1` sequences

## Development Guidelines

1. **Models First**: Always start with models
2. **Services Layer**: Business logic in services, not views
3. **Transactions**: Use `transaction.atomic()` for all business operations
4. **Validation**: Use rule engine, not inline validation
5. **Permissions**: Use RBAC service, not decorators
6. **Audit**: All changes must be audited
7. **Testing**: Write tests for services, not just views

## API Structure

```
/api/auth/token/          - JWT authentication
/api/mdm/                 - Master data endpoints
/api/attributes/          - Attribute management
/api/rbac/                - Roles and permissions
/api/workflow/            - Workflow management
/api/documents/           - Document operations
/api/inventory/           - Inventory operations
/api/config/              - Configuration
/api/rules/               - Rule management
/api/numbering/           - Sequence management
/api/calendar/            - Period management
/api/audit/               - Audit logs
/api/reporting/           - Reports
/api/imports/             - Data imports
/api/search/              - Search operations
```

## License

Proprietary - All rights reserved

## Support

For issues and questions, contact the development team.
