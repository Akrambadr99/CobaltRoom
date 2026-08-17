import { RouterProvider } from 'react-router-dom'

import { AppProviders } from './app/providers/AppProviders'
import { browserRouter } from './app/router'

function App() {
  return (
    <AppProviders>
      <RouterProvider router={browserRouter} />
    </AppProviders>
  )
}

export default App
