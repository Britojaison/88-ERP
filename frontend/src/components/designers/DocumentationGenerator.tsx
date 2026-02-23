import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
} from '@mui/material'
import {
  Download,
  Description,
  Code,
} from '@mui/icons-material'

interface DocumentationSection {
  title: string
  content: string
  type: 'attribute' | 'workflow' | 'rule' | 'permission'
}

const sampleDocumentation: DocumentationSection[] = [
  {
    title: 'Product Attributes',
    type: 'attribute',
    content: `
# Product Attributes

## Size (string, Required)
- **Entity Type**: SKU
- **Data Type**: String
- **Variant Dimension**: Yes
- **Options**: XS, S, M, L, XL, XXL
- **Used In**: 
  - SKU Variants
  - Size Charts
  - Product Search Filters
- **Validation**: Must be one of the predefined options

## Color (string, Required)
- **Entity Type**: SKU
- **Data Type**: String
- **Variant Dimension**: Yes
- **Options**: Red, Blue, Green, Black, White
- **Used In**:
  - SKU Variants
  - Product Images
  - Search Filters
`,
  },
  {
    title: 'Purchase Order Workflow',
    type: 'workflow',
    content: `
# Purchase Order Approval Workflow

## States
1. **Draft** (Initial State)
   - Allow Edit: Yes
   - Allow Delete: Yes
   
2. **Pending Approval**
   - Allow Edit: No
   - Allow Delete: No
   
3. **Approved** (Final State)
   - Allow Edit: No
   - Allow Delete: No

## Transitions
- **Submit for Approval**: Draft → Pending Approval
  - Condition: amount > 0 AND all_items_valid
  - Requires Approval: Yes
  - Approver Role: Manager
  
- **Approve**: Pending Approval → Approved
  - Condition: amount < 10000 OR approver_is_director
  - Requires Approval: Yes
  - Approver Role: Manager (< ₹10k), Director (≥ ₹10k)
`,
  },
  {
    title: 'Business Rules',
    type: 'rule',
    content: `
# Business Rules

## Size Required for Apparel
- **Type**: Validation
- **Trigger**: Before Save
- **Entity**: SKU
- **Condition**: category == 'apparel'
- **Error**: "Size is required for apparel items"
- **Blocking**: Yes

## Price Range Validation
- **Type**: Validation
- **Trigger**: Before Submit
- **Entity**: Product
- **Condition**: price >= 0 AND price <= 999999
- **Error**: "Price must be between 0 and 999,999"
- **Blocking**: Yes
`,
  },
  {
    title: 'Role Permissions',
    type: 'permission',
    content: `
# Role Permissions Matrix

## Administrator
- Full system access
- All permissions granted
- Can manage users and roles

## Manager
- View/Create/Edit Products
- View/Create/Edit SKUs
- Approve Documents (< ₹10,000)
- View Reports
- Export Data

## User
- View Products
- View SKUs
- Create Documents
- View own Reports

## Viewer
- View Products (Read-only)
- View SKUs (Read-only)
- View Reports (Read-only)
`,
  },
]

export default function DocumentationGenerator() {
  const [selectedType, setSelectedType] = useState<string>('all')
  const [format, setFormat] = useState<string>('markdown')

  const filteredDocs =
    selectedType === 'all'
      ? sampleDocumentation
      : sampleDocumentation.filter((doc) => doc.type === selectedType)

  const handleExport = () => {
    const content = filteredDocs.map((doc) => doc.content).join('\n\n---\n\n')
    const exportContent =
      format === 'html'
        ? `<!doctype html><html><head><meta charset="utf-8"><title>Configuration Documentation</title></head><body><pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`
        : content
    const blob = new Blob([exportContent], { type: format === 'html' ? 'text/html' : 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `configuration-documentation.${format === 'markdown' ? 'md' : 'html'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Documentation Generator
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Format</InputLabel>
            <Select value={format} onChange={(e) => setFormat(e.target.value)} label="Format">
              <MenuItem value="markdown">Markdown</MenuItem>
              <MenuItem value="html">HTML</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleExport}
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            Export Documentation
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Filter Documentation
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Documentation Type</InputLabel>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            label="Documentation Type"
          >
            <MenuItem value="all">All Documentation</MenuItem>
            <MenuItem value="attribute">Attributes</MenuItem>
            <MenuItem value="workflow">Workflows</MenuItem>
            <MenuItem value="rule">Rules</MenuItem>
            <MenuItem value="permission">Permissions</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      <Grid container spacing={3}>
        {filteredDocs.map((doc, index) => (
          <Grid item xs={12} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Description color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {doc.title}
                    </Typography>
                  </Box>
                  <Chip
                    label={doc.type}
                    size="small"
                    color={
                      doc.type === 'attribute'
                        ? 'primary'
                        : doc.type === 'workflow'
                          ? 'secondary'
                          : doc.type === 'rule'
                            ? 'error'
                            : 'success'
                    }
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Box
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                    bgcolor: 'grey.50',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  {doc.content}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Auto-Generated Documentation Features
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Code sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="body2">
                Automatically extracts metadata from your configuration
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Description sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="body2">
                Generates human-readable documentation
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Download sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="body2">
                Export in multiple formats (Markdown, HTML)
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Code sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="body2">
                Includes usage examples and relationships
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
