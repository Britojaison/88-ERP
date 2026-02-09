# ERP Platform Architecture

## Overview

This is a production-grade, metadata-driven ERP platform designed to be industry-agnostic. The system is built on the principle that **configuration drives behavior**, not code.

## Core Architectural Principles

### 1. Metadata-Driven Design

**Everything important is configurable:**
- Fields → Attribute Engine
- Forms → Dynamic form rendering from metadata
- Validations → Rule Engine
- Workflows → Workflow Engine
- Permissions → RBAC Engine
- Numbering → Numbering Engine

**Code = Engine Only**
- No domain assumptions
- No fashion-specific logic
- No industry conditionals
- Everything configurable via database tables

### 2. Industry-Agnostic

The platform can support:
- Fashion (today)
- Manufacturing (tomorrow)
- Distribution (next week)
- Any other industry

**Without changing a single line of code.**

### 3. ACID Correctness

- Strong transactional guarantees
- `transaction.atomic()` for all business operations
- Referential integrity enforced
- Deterministic behavior
- No eventual consistency shortcuts

### 4. Audit-Safe

- Immutable audit trail
- Append-only audit logs
- No updates or deletes on audit data
- 7-year retention by default

## System Architecture

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer (DRF)                       │
│  - JWT Authentication                                        │
│  - Dynamic Permissions (RBAC)                                │
│  - Structured Error Handling                                 │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  - Business Logic                                            │
│  - Transaction Management                                    │
│  - Event Emission                                            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Engine Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Attribute   │  │   Workflow   │  │     RBAC     │      │
│  │   Engine     │  │    Engine    │  │    Engine    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     Rule     │  │  Numbering   │  │    Audit     │      │
│  │   Engine     │  │    Engine    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              PostgreSQL (Single Physical DB)          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │  metadata  │  │transactions│  │   audit    │     │   │
│  │  │   schema   │  │   schema   │  │   schema   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  │  ┌────────────┐                                      │   │
│  │  │ analytics  │                                      │   │
│  │  │   schema   │                                      │   │
│  │  └────────────┘                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
apps/
├── core/              # Shared utilities, base models, exceptions
├── mdm/               # Master Data Management
├── attributes/        # Dynamic attribute engine
├── rbac/              # Role-based access control
├── workflow/          # State machine engine
├── documents/         # Generic document framework
├── inventory/         # Inventory management
├── config/            # Configuration engine
├── rules/             # Validation/business rule engine
├── numbering/         # Sequence engine
├── calendar/          # Period & calendar management
├── audit/             # Audit service (append-only)
├── reporting/         # Reporting & analytics
├── imports/           # Data import framework
├── search/            # Search abstraction layer
├── events/            # Event system
└── integrations/      # External integrations
```

**No circular dependencies. Clear boundaries.**

## Key Engines

### 1. Attribute Engine

**Problem:** Hard-coded fields (size, color, fabric) make system inflexible.

**Solution:** All attributes defined in database.

```python
# ❌ WRONG
class SKU:
    size = models.CharField()
    color = models.CharField()

# ✅ CORRECT
AttributeDefinition(entity_type='sku', code='size', data_type='string')
AttributeValue(entity=sku, attribute='size', value='M')
```

**Features:**
- Type-safe validation
- Variant dimensions
- Searchable/filterable
- Grouped for UX
- Predefined options

### 2. RBAC Engine

**Problem:** Hard-coded role checks (`if user.role == 'manager'`) are inflexible.

**Solution:** Permissions evaluated at runtime via metadata.

```python
# ❌ WRONG
if user.role == 'manager':
    allow_action()

# ✅ CORRECT
RBACService.require_permission(user, 'inventory.approve')
```

**Features:**
- Conditional permissions (JSONLogic)
- Row-level security
- Scope restrictions (business unit, location)
- No hard-coded checks

### 3. Workflow Engine

**Problem:** Hard-coded approval flows are inflexible.

**Solution:** State machine defined in database.

**Features:**
- Metadata-driven states and transitions
- Conditional transitions
- Approver role requirements
- Audit trail
- Action execution on transition

### 4. Document Engine

**Problem:** Each document type (PO, SO, Invoice) needs custom code.

**Solution:** Generic document framework configured via metadata.

**Features:**
- Document types defined in DB
- Line-item support
- Workflow integration
- Numbering integration
- Inventory integration

### 5. Numbering Engine

**Problem:** `max(id)+1` is not concurrency-safe.

**Solution:** Configurable, scoped, locked sequences.

**Features:**
- Format patterns
- Scoped by year/month/location
- Concurrency-safe via `select_for_update`
- Never uses `max(id)+1`

### 6. Rule Engine

**Problem:** Validation logic scattered in serializers/views.

**Solution:** Rules stored in database, evaluated via engine.

**Features:**
- Pre-save and pre-submit validations
- Reusable across entities
- JSONLogic expressions
- Centralized management

## Data Model Patterns

### Base Models

All entities inherit from `BaseModel`:

```python
class BaseModel(models.Model):
    id = UUIDField(primary_key=True)
    status = CharField(choices=STATUS_CHOICES)
    version = IntegerField()  # Optimistic locking
    created_at = DateTimeField()
    updated_at = DateTimeField()
    created_by = ForeignKey(User)
    updated_by = ForeignKey(User)
```

### Tenant-Aware Models

Multi-tenant entities inherit from `TenantAwareModel`:

```python
class TenantAwareModel(BaseModel):
    company = ForeignKey(Company)
```

### Soft Delete

**Never physically delete business data:**

```python
entity.soft_delete()  # Sets status='deleted'
```

### Optimistic Locking

Version field prevents concurrent update conflicts:

```python
# Version incremented on each save
# Concurrent updates detected and rejected
```

## Product Hierarchy

```
Company
  └── Product (design/concept level)
      └── Style (optional grouping)
          └── SKU (sellable unit)
              └── Inventory Balance (by location)
```

**CRITICAL:** Inventory ALWAYS references SKU, never Product.

## Logical Data Separation

Single physical PostgreSQL database with logical schemas:

### metadata schema
- Attribute definitions
- Workflows
- Rules
- Permissions
- Configuration

### transactions schema
- Master data (Company, User, Product, SKU)
- Documents
- Inventory movements

### audit schema
- Immutable audit logs
- Append-only
- 7-year retention

### analytics schema
- Reporting tables
- Aggregations
- ETL results

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

**Never vague errors like "Stock unavailable".**

## Transaction Management

All business operations use ACID transactions:

```python
@transaction.atomic
def create_sales_order(data):
    # Create document
    # Reserve inventory
    # Update workflow
    # Create audit log
    # If ANY step fails, ALL rollback
```

## Event System

Lightweight domain events:

```python
# Emit events on important actions
event_bus.emit('inventory.reserved', {
    'sku_id': sku.id,
    'quantity': quantity,
    'document_id': document.id
})

# Handlers can be sync or async
@event_handler('inventory.reserved')
def update_analytics(event):
    # Update reporting tables
```

## Frontend Architecture

```
React + TypeScript
  ├── Dynamic Form Rendering (from backend metadata)
  ├── Redux Toolkit (state management)
  ├── MUI/Ant Design (components)
  └── React Hook Form (form handling)
```

**Forms are rendered dynamically based on backend metadata.**

## Security

### Authentication
- JWT tokens
- OAuth support
- Separate from authorization

### Authorization
- RBAC engine
- Runtime evaluation
- No hard-coded checks

### Audit
- All changes logged
- Immutable trail
- IP address tracking

## Performance Considerations

### ERP Correctness > Performance

**But we still optimize:**

1. **Database Indexes**
   - All foreign keys indexed
   - Composite indexes for common queries
   - Status fields indexed

2. **Query Optimization**
   - `select_related` for foreign keys
   - `prefetch_related` for reverse relations
   - Avoid N+1 queries

3. **Caching (Optional)**
   - Redis for session data
   - NOT required for correctness
   - Never cache business data

4. **Background Jobs**
   - Celery for long-running tasks
   - ETL jobs
   - Report generation

## Deployment Architecture

```
┌─────────────┐
│   Nginx     │  (Reverse Proxy)
└─────────────┘
       │
┌─────────────┐
│  Gunicorn   │  (WSGI Server)
└─────────────┘
       │
┌─────────────┐
│   Django    │  (Application)
└─────────────┘
       │
┌─────────────┐
│ PostgreSQL  │  (Database)
└─────────────┘

┌─────────────┐
│   Celery    │  (Background Jobs)
└─────────────┘
       │
┌─────────────┐
│    Redis    │  (Message Broker)
└─────────────┘

┌─────────────┐
│Elasticsearch│  (Search - Optional)
└─────────────┘
```

## Scalability

### Horizontal Scaling
- Stateless application servers
- Load balancer in front
- Shared database

### Vertical Scaling
- PostgreSQL can handle significant load
- Proper indexing is key
- Connection pooling

### Read Replicas
- For reporting queries
- Separate OLTP from OLAP

## Testing Strategy

### Unit Tests
- Service layer logic
- Engine logic
- Validation rules

### Integration Tests
- API endpoints
- Database transactions
- Workflow transitions

### End-to-End Tests
- Critical business flows
- Order-to-cash
- Procure-to-pay

## Monitoring

### Application Monitoring
- Sentry for error tracking
- Structured logging
- Performance metrics

### Database Monitoring
- Query performance
- Connection pool usage
- Lock contention

### Business Monitoring
- KPIs via reporting module
- Audit log analysis
- Workflow bottlenecks

## Future Enhancements

### Phase 2
- Advanced reporting builder
- Workflow designer UI
- Attribute schema designer
- Rule builder UI

### Phase 3
- Multi-currency support
- Multi-language support
- Advanced pricing engine
- Promotion engine

### Phase 4
- Mobile apps
- Offline support
- Real-time notifications
- Advanced analytics

## Forbidden Patterns

❌ Hard-coded size/color/category fields
❌ Hard-coded workflows
❌ Business rules in serializers/views
❌ `if industry == fashion`
❌ Permission checks via role strings
❌ Deleting business data
❌ `max(id)+1` sequences
❌ Denormalized data without clear reason
❌ Eventual consistency for business data

## Success Criteria

✅ Can support new industry without code changes
✅ Can add new attributes without migrations
✅ Can change workflows without deployment
✅ Can modify permissions without code
✅ All business operations are ACID
✅ Complete audit trail
✅ Structured error messages
✅ No hard-coded business logic

## Conclusion

This architecture provides a solid foundation for a production-grade, metadata-driven ERP platform that can adapt to any industry without code changes. The key is **configuration over code** and **correctness over shortcuts**.
