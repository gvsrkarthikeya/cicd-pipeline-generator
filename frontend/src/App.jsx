import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import RepoDetail from './pages/RepoDetail'
import PublicSnapshot from './pages/PublicSnapshot'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/repos/:repoId"
        element={
          <ProtectedRoute>
            <RepoDetail />
          </ProtectedRoute>
        }
      />
      <Route path="/share/:shareId" element={<PublicSnapshot />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App

