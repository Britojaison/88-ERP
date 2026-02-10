import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material'
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
} from '@mui/icons-material'
import { diffLines, Change } from 'diff'

interface ConfigVersion {
  id: string
  version: string
  timestamp: string
  author: string
}

const sampleVersions: ConfigVersion[] = [
  { id: '1', version: 'v1.0.0', timestamp: '2024-01-15 10:00', author: 'admin@example.com' },
  { id: '2', version: 'v1.1.0', timestamp: '2024-01-20 14:30', author: 'admin@example.com' },
  { id: '3', version: 'v1.2.0', timestamp: '2024-01-25 09:15', author: 'manager@example.com' },
]

const sampleConfig1 = `{
  "workflows": [
    {
      "code": "purchase_order",
      "name": "Purchase Order Approval",
      "states": [
        {"code": "draft", "name": "Draft"},
        {"code": "pending", "name": "Pending Approval"},
        {"code": "approved", "name": "Approved"}
      ]
    }
  ],
  "rules": [
    {
      "code": "size_required",
      "name": "Size Required for Apparel",
      "condition": "category == 'apparel'"
    }
  ]
}`

const sampleConfig2 = `{
  "workflows": [
    {
      "code": "purchase_order",
      "name": "Purchase Order Approval",
      "states": [
        {"code": "draft", "name": "Draft"},
        {"code": "pending", "name": "Pending Approval"},
        {"code": "pending_finance", "name": "Pending Finance Review"},
        {"code": "approved", "name": "Approved"}
      ]
    }
  ],
  "rules": [
    {
      "code": "size_required",
      "name": "Size Required for Apparel",
      "condition": "category == 'apparel' && price > 0"
    },
    {
      "code": "color_required",
      "name": "Color Required",
      "condition": "category == 'apparel'"
    }
  ]
}`

export default function ConfigDiffViewer() {
  const [version1, setVersion1] = useState('1')
  const [version2, setVersion2] = useState('2')
  const [diffResult, setDiffResult] = useState<Change[]>([])

  const handleCompare = () => {
    // In real implementation, fetch configs from API
    const config1 = version1 === '1' ? sampleConfig1 : sampleConfig2
    const config2 = version2 === '2' ? sampleConfig2 : sampleConfig1
    
    const diff = diffLines(config1, config2)
    setDiffResult(diff)
  }

  const renderDiffLine = (change: Change, index: number) => {
    let bgcolor = 'transparent'
    let icon = null
    let color = 'text.primary'

    if (change.added) {
      bgcolor = '#e6ffed'
      icon = <AddIcon sx={{ fontSize: 16, color: '#22863a' }} />
      color = '#22863a'
    } else if (change.removed) {
      bgcolor = '#ffeef0'
      icon = <RemoveIcon sx={{ fontSize: 16, color: '#cb2431' }} />
      color = '#cb2431'
    }

    return (
      <Box
        key={index}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          bgcolor,
          px: 2,
          py: 0.5,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          borderLeft: change.added || change.removed ? '3px solid' : 'none',
          borderLeftColor: change.added ? '#22863a' : '#cb2431',
        }}
      >
        <Box sx={{ minWidth: 24, mr: 1 }}>{icon}</Box>
        <Box sx={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {change.value}
        </Box>
      </Box>
    )
  }

  const getChangeStats = () => {
    const added = diffResult.filter((c) => c.added).reduce((sum, c) => sum + (c.count || 0), 0)
    const removed = diffResult.filter((c) => c.removed).reduce((sum, c) => sum + (c.count || 0), 0)
    return { added, removed }
  }

  const stats = getChangeStats()

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
        Configuration Diff Viewer
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Compare configuration versions to see what changed
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={5}>
            <FormControl fullWidth>
              <InputLabel>Base Version</InputLabel>
              <Select
                value={version1}
                onChange={(e) => setVersion1(e.target.value)}
                label="Base Version"
              >
                {sampleVersions.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.version} - {v.timestamp}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2} sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              vs
            </Typography>
          </Grid>
          <Grid item xs={12} md={5}>
            <FormControl fullWidth>
              <InputLabel>Compare Version</InputLabel>
              <Select
                value={version2}
                onChange={(e) => setVersion2(e.target.value)}
                label="Compare Version"
              >
                {sampleVersions.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.version} - {v.timestamp}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleCompare}
              sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              Compare Versions
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {diffResult.length > 0 && (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Changes Summary:
              </Typography>
              <Chip
                icon={<AddIcon />}
                label={`${stats.added} additions`}
                size="small"
                sx={{ bgcolor: '#e6ffed', color: '#22863a' }}
              />
              <Chip
                icon={<RemoveIcon />}
                label={`${stats.removed} deletions`}
                size="small"
                sx={{ bgcolor: '#ffeef0', color: '#cb2431' }}
              />
            </Box>
          </Paper>

          <Paper sx={{ overflow: 'hidden' }}>
            <Box
              sx={{
                bgcolor: 'grey.100',
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Configuration Diff
              </Typography>
            </Box>
            <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
              {diffResult.map((change, index) => renderDiffLine(change, index))}
            </Box>
          </Paper>

          <Paper sx={{ p: 3, mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Key Changes Detected
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AddIcon sx={{ fontSize: 16, color: '#22863a', mr: 1 }} />
                <Typography variant="body2">
                  Added state: "Pending Finance Review" to Purchase Order workflow
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <EditIcon sx={{ fontSize: 16, color: '#0366d6', mr: 1 }} />
                <Typography variant="body2">
                  Modified condition in "Size Required" rule
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AddIcon sx={{ fontSize: 16, color: '#22863a', mr: 1 }} />
                <Typography variant="body2">
                  Added new rule: "Color Required"
                </Typography>
              </Box>
            </Box>
          </Paper>
        </>
      )}
    </Box>
  )
}
