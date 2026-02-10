import { useCallback, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import {
  Box,
  Paper,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { useState } from 'react'

interface DependencyNode {
  id: string
  type: string
  label: string
  dependencies: string[]
}

const sampleData: DependencyNode[] = [
  {
    id: 'attr_size',
    type: 'attribute',
    label: 'Size Attribute',
    dependencies: [],
  },
  {
    id: 'attr_color',
    type: 'attribute',
    label: 'Color Attribute',
    dependencies: [],
  },
  {
    id: 'sku_1',
    type: 'sku',
    label: 'SKU Variants',
    dependencies: ['attr_size', 'attr_color'],
  },
  {
    id: 'rule_size_req',
    type: 'rule',
    label: 'Size Required Rule',
    dependencies: ['attr_size'],
  },
  {
    id: 'wf_product',
    type: 'workflow',
    label: 'Product Workflow',
    dependencies: ['rule_size_req'],
  },
  {
    id: 'search_1',
    type: 'search',
    label: 'Product Search',
    dependencies: ['attr_size', 'attr_color'],
  },
]

const nodeColors: Record<string, string> = {
  attribute: '#667eea',
  sku: '#4facfe',
  rule: '#fa709a',
  workflow: '#f093fb',
  search: '#43e97b',
}

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 60 })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 180, height: 60 })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 90,
        y: nodeWithPosition.y - 30,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

export default function DependencyGraph() {
  const [selectedType, setSelectedType] = useState<string>('all')
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const buildGraph = useCallback(() => {
    const filteredData =
      selectedType === 'all'
        ? sampleData
        : sampleData.filter((d) => d.type === selectedType || d.dependencies.some((dep) => dep.startsWith(selectedType)))

    const graphNodes: Node[] = filteredData.map((item) => ({
      id: item.id,
      type: 'default',
      data: {
        label: (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
              {item.label}
            </Typography>
            <Chip
              label={item.type}
              size="small"
              sx={{
                mt: 0.5,
                height: 16,
                fontSize: '0.65rem',
                bgcolor: 'white',
                color: nodeColors[item.type],
              }}
            />
          </Box>
        ),
      },
      position: { x: 0, y: 0 },
      style: {
        background: nodeColors[item.type],
        color: 'white',
        border: `2px solid ${nodeColors[item.type]}`,
        borderRadius: 8,
        padding: 10,
        width: 180,
      },
    }))

    const graphEdges: Edge[] = []
    filteredData.forEach((item) => {
      item.dependencies.forEach((dep) => {
        if (filteredData.find((d) => d.id === dep)) {
          graphEdges.push({
            id: `${dep}-${item.id}`,
            source: dep,
            target: item.id,
            type: 'smoothstep',
            animated: true,
          })
        }
      })
    })

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(graphNodes, graphEdges)
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [selectedType, setNodes, setEdges])

  useEffect(() => {
    buildGraph()
  }, [buildGraph])

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Dependency Graph
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Type</InputLabel>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            label="Filter by Type"
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="attribute">Attributes</MenuItem>
            <MenuItem value="rule">Rules</MenuItem>
            <MenuItem value="workflow">Workflows</MenuItem>
            <MenuItem value="sku">SKUs</MenuItem>
            <MenuItem value="search">Searches</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Paper sx={{ height: '600px', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const type = sampleData.find((d) => d.id === node.id)?.type || 'attribute'
              return nodeColors[type]
            }}
          />
        </ReactFlow>
      </Paper>

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Legend
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {Object.entries(nodeColors).map(([type, color]) => (
            <Chip
              key={type}
              label={type.charAt(0).toUpperCase() + type.slice(1)}
              sx={{ bgcolor: color, color: 'white' }}
            />
          ))}
        </Box>
      </Paper>
    </Box>
  )
}
