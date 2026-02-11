import { Box, Card, CardContent, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: string
  icon: ReactNode
  note?: string
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'info'
}

export default function MetricCard({
  label,
  value,
  icon,
  note,
  tone = 'primary',
}: MetricCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {label}
            </Typography>
            <Typography variant="h4" color={`${tone}.main`}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2.5,
              bgcolor: `${tone}.main`,
              color: 'white',
              lineHeight: 0,
            }}
          >
            {icon}
          </Box>
        </Box>
        {note && (
          <Typography variant="caption" color="text.secondary">
            {note}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
