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
        category: 'Operations',
        permissions: [
            { code: 'dashboard.view', name: 'Dashboard' },
            { code: 'mdm.product.view', name: 'Master Data' },

            { code: 'inv.view', name: 'Inventory' },
            { code: 'inv.barcodes', name: 'Barcodes' },
            { code: 'inv.receiving', name: 'Receiving' },
            { code: 'org.warehouses.view', name: 'Warehouses' },
            { code: 'org.stores.view', name: 'Stores' },
            { code: 'inv.transfer', name: 'Transfers' },
            { code: 'pos.checkout', name: 'Store POS' },
            { code: 'pos.returns', name: 'POS Returns' },
            { code: 'report.sales', name: 'Reports' },
        ],
    },
    {
        category: 'Design & Production',
        permissions: [
            { code: 'design.workbench', name: 'Designer Workbench' },
            { code: 'design.kanban', name: 'Production Kanban' },
            { code: 'design.orders', name: 'Production Orders' },
            { code: 'design.journey', name: 'Product Journey' },
        ],
    },
    {
        category: 'Reports Detailed',
        permissions: [
            { code: 'report.daily', name: 'Daily Sales' },
            { code: 'report.stock', name: 'Stock Velocity' },
            { code: 'report.margin', name: 'Margin Analysis' },
            { code: 'report.channel', name: 'Store vs Online' },
        ],
    },
    {
        category: 'Platform',
        permissions: [
            { code: 'integration.shopify', name: 'Shopify' },
            { code: 'admin.config', name: 'Settings' },
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
            'inv.barcodes',
            'org.warehouses.view',
            'mdm.product.view',
            'design.kanban',
        ]
    },
    {
        code: 'store',
        name: 'Store',
        permissions: [
            'dashboard.view',
            'pos.checkout',
            'pos.returns',
            'inv.view',
            'org.stores.view',
            'mdm.product.view',
            'report.sales',
        ]
    },
    {
        code: 'designer',
        name: 'Designer',
        permissions: [
            'dashboard.view',
            'inv.view',
            'design.workbench',
            'design.journey',
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
