import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import AuthNotifier from './AuthNotifier'
import WelcomeModal from './WelcomeModal'
import ScrollToTop from './ScrollToTop'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <AuthNotifier />
      <WelcomeModal />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
