import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import './lib/sentry'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={<div className="container py-20 text-center text-sm text-[var(--color-laburante-text-secondary)]">Ocurrió un error inesperado. Recargá la página para continuar.</div>}
      showDialog={false}
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
