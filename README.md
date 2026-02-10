# 88 ERP Platform

A metadata-driven, industry-agnostic ERP system that allows businesses to model, run, and evolve their operations without changing application code.

## Overview

This ERP platform is built on the principle of **configuration over customization**. Business behavior is defined in data, not code, allowing the same core system to support fashion retail, manufacturing, distribution, services, and any future domain with no code rewrites.

## Key Features

### Metadata Management System
- **Visual Designers**: No-code configuration tools for business users
- **Attribute Designer**: Create dynamic attributes with drag-and-drop
- **Workflow Designer**: Visual state machine editor with React Flow
- **Rule Builder**: Visual business rule expression builder with JSONLogic
- **Form Builder**: Dynamic form designer with real-time preview
- **Permission Designer**: Visual permission matrix editor
- **Dependency Graph**: Visualize relationships between metadata entities
- **Configuration Diff Viewer**: Compare configuration versions
- **Documentation Generator**: Auto-generate documentation from metadata

### Core Capabilities
- **Master Data Management**: Products, SKUs, Companies, Locations, Customers, Vendors
- **Dynamic Attributes**: Define custom fields without schema changes
- **Workflow Engine**: Configurable approval workflows and state machines
- **Business Rules Engine**: JSONLogic-based validation and calculation rules
- **RBAC System**: Runtime permission evaluation with conditions
- **Document Framework**: Generic document types (PO, Sales, Transfers, etc.)
- **Inventory Management**: Immutable, SKU-based inventory tracking
- **Audit System**: Complete audit trail for all operations
- **Configuration Templates**: Pre-built industry templates (Fashion Retail, etc.)
- **Sandbox Environment**: Test metadata changes before deployment

## Technology Stack

### Backend
- Django 4.2 + Django REST Framework
- PostgreSQL (with SQLite fallback)
- Celery + Redis for async tasks
- Elasticsearch for search
- JSONLogic for rule evaluation

### Frontend
- React 18 + TypeScript
- Material-UI (MUI) for components
- Redux Toolkit for state management
- React Flow for workflow visualization
- Monaco Editor for code editing
- Dagre for graph layouts

## Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 13+ (optional, SQLite fallback available)

## Quick Start

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs at: http://127.0.0.1:8000

### Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Frontend runs at: http://localhost:5174

## Project Structure

```
88-ERP/
├── backend/
│   ├── apps/
│   │   ├── attributes/      # Dynamic attribute engine
│   │   ├── audit/           # Audit logging
│   │   ├── calendar/        # Fiscal calendars
│   │   ├── config/          # System configuration
│   │   ├── core/            # Base models & metadata management
│   │   ├── documents/       # Document framework
│   │   ├── events/          # Domain events
│   │   ├── imports/         # Data import
│   │   ├── integrations/    # External integrations
│   │   ├── inventory/       # Inventory management
│   │   ├── mdm/             # Master data
│   │   ├── numbering/       # Number sequences
│   │   ├── rbac/            # Permissions & roles
│   │   ├── reporting/       # Reports & analytics
│   │   ├── rules/           # Business rules engine
│   │   ├── search/          # Search functionality
│   │   └── workflow/        # Workflow engine
│   └── config/              # Django settings
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── designers/   # Visual metadata designers
│   │   │   └── Layout.tsx   # Main layout
│   │   ├── pages/           # Application pages
│   │   ├── services/        # API services
│   │   ├── store/           # Redux store
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Utility functions
│   └── package.json
├── ARCHITECTURE.md          # Detailed architecture documentation
└── README.md               # This file
```

## Metadata Management

Access the Metadata Management interface at `/metadata` to:

1. **Design Attributes**: Create custom fields for any entity
2. **Build Workflows**: Design approval workflows visually
3. **Define Rules**: Create business validation rules
4. **Design Forms**: Build dynamic forms with drag-and-drop
5. **Configure Permissions**: Set up role-based access control
6. **View Dependencies**: Understand metadata relationships
7. **Compare Versions**: See what changed between configurations
8. **Generate Documentation**: Auto-create documentation from metadata
9. **Import/Export**: Version control your configuration

## Configuration Templates

The system includes pre-built templates for common industries:

### Fashion Retail Template
- Attributes: Size, Color, Season, Fabric, Style
- Workflows: Product Launch, Clearance, Returns
- Rules: Markdown validation, Size chart requirements
- Document Types: PO, Transfer, Sale, Return

Apply templates from the Metadata Management interface.

## API Documentation

API endpoints are available at:
- Master Data: `/api/mdm/`
- Attributes: `/api/attributes/`
- Workflows: `/api/workflows/`
- Rules: `/api/rules/`
- Documents: `/api/documents/`
- Inventory: `/api/inventory/`
- Metadata: `/api/metadata/`
- Templates: `/api/templates/`
- Sandboxes: `/api/sandboxes/`

## Development

### Run Tests
```bash
# Backend
cd backend
python manage.py test

# Frontend
cd frontend
npm test
```

### Build for Production
```bash
# Backend
cd backend
python manage.py collectstatic

# Frontend
cd frontend
npm run build
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design, including:
- Metadata-driven architecture
- Core engines (Attributes, Workflows, Rules, RBAC)
- Data models and relationships
- API design patterns
- Security considerations

## Philosophy

This product is built on three foundational principles:

1. **Configuration over customization**: Business behavior is defined in data, not code
2. **Metadata as the source of truth**: Fields, forms, rules, workflows, and permissions are described declaratively
3. **Correctness before convenience**: The system prioritizes consistency, traceability, and control

## License

Proprietary - All rights reserved

## Support

For questions or issues, contact the development team.
