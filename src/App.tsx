import { RouterProvider } from 'react-router-dom'

import { AppProviders } from './app/providers/AppProviders'
import { browserRouter } from './app/router'
import { createAppServices } from './app/services'
import { BrowserPreferenceStorage } from './preferences/storage'

const browserServices = createAppServices({
  preferenceStorage: new BrowserPreferenceStorage(window.localStorage),
})

function App() {
  return (
    <AppProviders services={browserServices}>
      <RouterProvider router={browserRouter} />
    </AppProviders>
  )
}

export default App
