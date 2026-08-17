import { RouterProvider } from 'react-router-dom'

import { browserRouter } from './app/router'

function App() {
  return <RouterProvider router={browserRouter} />
}

export default App
