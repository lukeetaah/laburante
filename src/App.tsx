import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import Layout from '@/components/layout/Layout'
import Home from '@/pages/Home'
import Search from '@/pages/Search'
import ProfilePage from '@/pages/ProfilePage'
import Categories from '@/pages/Categories'
import CategoryPage from '@/pages/CategoryPage'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import CreateProfile from '@/pages/CreateProfile'
import Admin from '@/pages/Admin'
import Terms from '@/pages/Terms'
import Privacy from '@/pages/Privacy'
import HowItWorks from '@/pages/HowItWorks'
import OrdersDashboard from '@/pages/OrdersDashboard'
import NotFound from '@/pages/NotFound'
import Companies from '@/pages/Companies'
import { Analytics } from '@vercel/analytics/react'

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="buscar" element={<Search />} />
          <Route path="empresas" element={<Companies />} />
          <Route path="p/:slug" element={<ProfilePage />} />
          <Route path="categorias" element={<Categories />} />
          <Route path="categorias/:slug" element={<CategoryPage />} />
          <Route path="mis-trabajos" element={<OrdersDashboard />} />
          <Route path="pedidos" element={<OrdersDashboard />} />
          <Route path="ingresar" element={<Login />} />
          <Route path="registrar" element={<Register />} />
          <Route path="crear-perfil" element={<CreateProfile />} />
          <Route path="admin" element={<Admin />} />
          <Route path="como-funciona" element={<HowItWorks />} />
          <Route path="terminos" element={<Terms />} />
          <Route path="privacidad" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Analytics />
    </BrowserRouter>
  )
}
