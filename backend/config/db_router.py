"""
Database router for logical separation of data stores.
Uses PostgreSQL schemas for separation without multiple physical databases.
"""

class LogicalDatabaseRouter:
    """
    Routes database operations to appropriate schemas based on app label.
    
    Logical separation:
    - metadata: Configuration, attributes, workflows, rules
    - transactions: Documents, inventory movements
    - audit: Immutable audit logs
    - analytics: Reporting, aggregations
    """
    
    SCHEMA_MAPPING = {
        # Metadata schema
        'attributes': 'metadata',
        'rbac': 'metadata',
        'workflow': 'metadata',
        'config': 'metadata',
        'rules': 'metadata',
        'numbering': 'metadata',
        'calendar': 'metadata',
        
        # Transactional schema
        'mdm': 'transactions',
        'documents': 'transactions',
        'inventory': 'transactions',
        'imports': 'transactions',
        
        # Audit schema (append-only)
        'audit': 'audit',
        
        # Analytics schema
        'reporting': 'analytics',
    }
    
    def db_for_read(self, model, **hints):
        """All reads go to default database (different schemas)."""
        return 'default'
    
    def db_for_write(self, model, **hints):
        """All writes go to default database (different schemas)."""
        return 'default'
    
    def allow_relation(self, obj1, obj2, **hints):
        """Allow relations between all apps (same physical DB)."""
        return True
    
    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """Allow migrations on default database."""
        return db == 'default'
    
    @classmethod
    def get_schema_for_app(cls, app_label):
        """Get schema name for app label."""
        return cls.SCHEMA_MAPPING.get(app_label, 'public')
