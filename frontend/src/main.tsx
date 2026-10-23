import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/app.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// Without VITE_API_URL the app talks to an in-browser mock of the API, so the
// frontend can be deployed as a static site. Set it to use the .NET backend.
const useMock = !import.meta.env.VITE_API_URL

async function start() {
  if (useMock) {
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    })
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App mock={useMock} />
    </StrictMode>,
  )
}

start()
