export interface Permission {
    code: string
    name: string
}

export interface PermissionCategory {
    category: string
    permissions: Permission[]
}

export interface Role {
    code: string
    name: string
    permissions: string[]
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
    {
        category: 'Dashboard',
        permissions: [
            { code: 'dashboard.view', name: 'View Dashboard' },
            { code: 'dashboard.metrics', name: 'View Key Metrics' },
        ],
    },
    {
        category: 'Point of Sale (POS)',
        permissions: [
            { code: 'pos.checkout', name: 'Process Checkout' },
            { code: 'pos.returns', name: 'Process Returns' },
            { code: 'pos.history', name: 'View Transaction History' },
        ],
    },
    {
        category: 'Inventory',
        permissions: [
            { code: 'inv.view', name: 'View Inventory List' },
            { code: 'inv.receiving', name: 'Manage Receiving' },
            { code: 'inv.tracking', name: 'Product Tracking' },
            { code: 'inv.journey', name: 'View Product Journey' },
            { code: 'inv.kanban', name: 'Production Kanban' },
            { code: 'inv.transfer', name: 'Stock Transfers' },
            { code: 'inv.health', name: 'View Inventory Health' },
            { code: 'inv.barcodes', name: 'Generate Barcodes' },
        ],
    },
    {
        category: 'Organization',
        permissions: [
            { code: 'org.stores.view', name: 'View Stores' },
            { code: 'org.warehouses.view', name: 'View Warehouses' },
        ],
    },
    {
        category: 'Master Data',
        permissions: [
            { code: 'mdm.product.view', name: 'View Products' },
            { code: 'mdm.product.edit', name: 'Edit Products/Metadata' },
            { code: 'mdm.documents.view', name: 'View Documents' },
            { code: 'mdm.documents.manage', name: 'Create/Approve Documents' },
        ],
    },
    {
        category: 'Reports',
        permissions: [
            { code: 'report.sales', name: 'Daily Sales Report' },
            { code: 'report.stock', name: 'Weekly Stock Report' },
            { code: 'report.margin', name: 'Monthly Margin Report' },
            { code: 'report.channel', name: 'Channel Comparison' },
        ],
    },
    {
        category: 'Integrations',
        permissions: [
            { code: 'integration.shopify', name: 'Shopify Integration' },
        ],
    },
    {
        category: 'Administration',
        permissions: [
            { code: 'admin.users', name: 'Manage Users' },
            { code: 'admin.roles', name: 'Manage Roles' },
            { code: 'admin.config', name: 'System Configuration' },
        ],
    },
]

export const ALL_PERMISSION_CODES = PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => p.code))

export const DEFAULT_ROLES: Role[] = [
    { code: 'admin', name: 'Admin', permissions: ALL_PERMISSION_CODES },
    {
        code: 'warehouse',
        name: 'Warehouse',
        permissions: [
            'dashboard.view',
            'inv.view',
            'inv.receiving',
            'inv.transfer',
            'inv.kanban',
            'inv.barcodes',
            'inv.health',
            'org.warehouses.view',
            'mdm.product.view'
        ]
    },
    {
        code: 'store',
        name: 'Store',
        permissions: [
            'dashboard.view',
            'pos.checkout',
            'pos.returns',
            'pos.history',
            'inv.view',
            'org.stores.view',
            'mdm.product.view'
        ]
    },
    {
        code: 'designer',
        name: 'Designer',
        permissions: [
            'dashboard.view',
            'inv.view',
            'inv.journey',
            'inv.barcodes',
            'mdm.product.view'
        ]
    },
    {
        code: 'operations',
        name: 'Operations',
        permissions: ALL_PERMISSION_CODES.filter((p) => !p.startsWith('report.')),
    },
]
