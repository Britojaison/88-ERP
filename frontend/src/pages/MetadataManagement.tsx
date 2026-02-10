import { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
} from '@mui/material'
import {
  Settings,
  AccountTree,
  Rule,
  Description,
  Security,
  Download,
  Upload,
  ContentCopy,
} from '@mui/icons-material'
import AttributeDesigner from '../components/designers/AttributeDesigner'
import WorkflowDesigner from '../components/designers/WorkflowDesigner'
import RuleBuilder from '../components/designers/RuleBuilder'
import FormBuilder from '../components/designers/FormBuilder'
import PermissionDesigner from '../components/designers/PermissionDesigner'
import DependencyGraph from '../components/designers/DependencyGraph'
import ConfigDiffViewer from '../components/designers/ConfigDiffViewer'
import DocumentationGenerator from '../components/designers/DocumentationGenerator'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

const metadataCategories = [
  {
    title: 'Attributes',
    icon: <Settings sx={{ fontSize: 40 }} />,
    description: 'Define dynamic attributes for products, SKUs, and other entities',
    color: '#667eea',
    count: 0,
  },
  {
    title: 'Workflows',
    icon: <AccountTree sx={{ fontSize: 40 }} />,
    description: 'Design approval workflows and state machines',
    color: '#f093fb',
    count: 0,
  },
  {
    title: 'Rules',
    icon: <Rule sx={{ fontSize: 40 }} />,
    description: 'Create business rules and validation logic',
    color: '#4facfe',
    count: 0,
  },
  {
    title: 'Document Types',
    icon: <Description sx={{ fontSize: 40 }} />,
    description: 'Configure document types and their behavior',
    color: '#fa709a',
    count: 0,
  },
  {
    title: 'Permissions',
    icon: <Security sx={{ fontSize: 40 }} />,
    description: 'Manage roles and permissions',
    color: '#43e97b',
    count: 0,
  },
]

export default function MetadataManagement() {
  const [tabValue, setTabValue] = useState(0)

  const handleExport = () => {
    // TODO: Implement export
    console.log('Export configuration')
  }

  const handleImport = () => {
    // TODO: Implement import
    console.log('Import configuration')
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            Metadata Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure your ERP system without code
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<Upload />}
            onClick={handleImport}
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<ContentCopy />}
            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            Templates
          </Button>
        </Box>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Overview" />
          <Tab label="Attributes" />
          <Tab label="Workflows" />
          <Tab label="Rules" />
          <Tab label="Forms" />
          <Tab label="Permissions" />
          <Tab label="Dependencies" />
          <Tab label="Version Diff" />
          <Tab label="Documentation" />
          <Tab label="Import/Export" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {metadataCategories.map((category) => (
              <Grid item xs={12} md={6} lg={4} key={category.title}>
                <Card
                  sx={{
                    height: '100%',
                    background: `linear-gradient(135deg, ${category.color}15 0%, ${category.color}05 100%)`,
                    border: `1px solid ${category.color}30`,
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          backgroundColor: `${category.color}20`,
                          color: category.color,
                          mr: 2,
                        }}
                      >
                        {category.icon}
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {category.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {category.count} configured
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {category.description}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button size="small" sx={{ color: category.color }}>
                      Configure
                    </Button>
                    <Button size="small">View All</Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ mt: 3, p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Quick Actions
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'primary.light',
                      color: 'white',
                    },
                  }}
                >
                  <Typography variant="body2">Create Attribute</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'primary.light',
                      color: 'white',
                    },
                  }}
                >
                  <Typography variant="body2">Design Workflow</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'primary.light',
                      color: 'white',
                    },
                  }}
                >
                  <Typography variant="body2">Add Rule</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'primary.light',
                      color: 'white',
                    },
                  }}
                >
                  <Typography variant="body2">Apply Template</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <AttributeDesigner />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <WorkflowDesigner />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <RuleBuilder />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <FormBuilder />
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <PermissionDesigner />
        </TabPanel>

        <TabPanel value={tabValue} index={6}>
          <DependencyGraph />
        </TabPanel>

        <TabPanel value={tabValue} index={7}>
          <ConfigDiffViewer />
        </TabPanel>

        <TabPanel value={tabValue} index={8}>
          <DocumentationGenerator />
        </TabPanel>

        <TabPanel value={tabValue} index={9}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Import/Export Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Export your configuration for version control or import from templates
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom>
                  Export Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Download your current configuration as JSON or YAML
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  fullWidth
                  onClick={handleExport}
                >
                  Export Configuration
                </Button>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom>
                  Import Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Upload a configuration file to apply changes
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Upload />}
                  fullWidth
                  onClick={handleImport}
                >
                  Import Configuration
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  )
}
