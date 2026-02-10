# 88 ERP Platform Architecture

## Overview

Production-grade, metadata-driven ERP platform designed to be industry-agnostic. The system operates on the principle that **configuration drives behavior, not code**.

---

## Core Principles

### 1. Metadata-Driven Design
Everything important is configurable:
- **Fields** → Attribute Engine
- **Forms** → Dynamic rendering from metadata
- **Validations** → Rule Engine
- **Workflows** → Workflow Engine
- **Permissions** → RBAC Engine
- **Numbering** → Numbering Engine

**Code = Engine Only**
- No domain assumptions
- No fashion-specific logic
- No industry conditionals
- Everything configurable via database

### 2. Industry-Agnostic
Support any industry without code changes:
- Fashion (today)
- Manufacturing (tomorrow)
- Distribution (next week)
- Any other industry

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

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (DRF)                           │
│  • JWT Authentication                                        │
│  • Dynamic Permissions (RBAC)                                │
│  • Structured Error Handling                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  • Business Logic                                            │
│  • Transaction Management                                    │
│  • Event Emission                                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Engine Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Attribute   │  │   Workflow   │  │     RBAC     │      │
│  │   Engine     │  │    Engine    │  │    Engine    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     Rule     │  │  Numbering   │  │    Audit     │      │
│  │   Engine     │  │    Engine    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌────────────────────────────────────────────────────┐     │
│  │        PostgreSQL (Single Physical DB)             │     │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐   │     │
│  │  │  metadata  │  │transactions│  │   audit    │   │     │
│  │  │   schema   │  │   schema   │  │   schema   │   │     │
│  │  └────────────┘  └────────────┘  └────────────┘   │     │
│  │  ┌────────────┐                                    │     │
│  │  │ analytics  │                                    │     │
│  │  │   schema   │                                    │     │
│  │  └────────────┘                                    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Structure

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

---

## Key Engines

### 1. Attribute Engine

**Problem:** Hard-coded fields make system inflexible.

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

**Problem:** Hard-coded role checks are inflexible.

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

**Problem:** Each document type needs custom code.

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

**Problem:** Validation logic scattered everywhere.

**Solution:** Rules stored in database, evaluated via engine.

**Features:**
- Pre-save and pre-submit validations
- Reusable across entities
- JSONLogic expressions
- Centralized management

---

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

Never physically delete business data:

```python
entity.soft_delete()  # Sets status='deleted'
```

### Optimistic Locking

Version field prevents concurrent update conflicts:

```python
# Version incremented on each save
# Concurrent updates detected and rejected
```

---

## Product Hierarchy

```
Company
  └── Product (design/concept level)
      └── Style (optional grouping)
          └── SKU (sellable unit)
              └── Inventory Balance (by location)
```

**CRITICAL:** Inventory ALWAYS references SKU, never Product.

---

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

---

## Error Handling

All errors use structured format:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "SKU A123 size M has only 2 units at Store X",
    "details": {
      "sku_code": "A123",
      "location": "Store X",
      "requested": 5,
      "available": 2
    }
  }
}
```

**Never vague errors.**

---

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

---

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

---

## Frontend Architecture

```
React + TypeScript
  ├── Dynamic Form Rendering (from backend metadata)
  ├── Redux Toolkit (state management)
  ├── Material-UI (components)
  └── React Hook Form (form handling)
```

**Forms are rendered dynamically based on backend metadata.**

---

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

---

## Performance Considerations

**ERP Correctness > Performance**

But we still optimize:

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

---

## Deployment Architecture

```
┌─────────────┐
│   Nginx     │  (Reverse Proxy)
└─────────────┘
       ↓
┌─────────────┐
│  Gunicorn   │  (WSGI Server)
└─────────────┘
       ↓
┌─────────────┐
│   Django    │  (Application)
└─────────────┘
       ↓
┌─────────────┐
│ PostgreSQL  │  (Database)
└─────────────┘

┌─────────────┐
│   Celery    │  (Background Jobs)
└─────────────┘
       ↓
┌─────────────┐
│    Redis    │  (Message Broker)
└─────────────┘
```

---

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

---

## Success Criteria

✅ Support new industry without code changes  
✅ Add new attributes without migrations  
✅ Change workflows without deployment  
✅ Modify permissions without code  
✅ All business operations are ACID  
✅ Complete audit trail  
✅ Structured error messages  
✅ No hard-coded business logic  

---

## Conclusion

This architecture provides a solid foundation for a production-grade, metadata-driven ERP platform that can adapt to any industry without code changes. The key is **configuration over code** and **correctness over shortcuts**.
