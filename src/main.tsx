import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import EarningsDashboard from './dashboard/EarningsDashboard'
import './dashboard/dashboard.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <EarningsDashboard />
  </StrictMode>,
)
