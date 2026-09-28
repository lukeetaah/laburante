import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import AuthNotifier from './AuthNotifier'
import WelcomeModal from './WelcomeModal'
import IntentPromptModal from '@/components/profile/IntentPromptModal'
import ScrollToTop from './ScrollToTop'
import HelpRibbon from './HelpRibbon'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <AuthNotifier />
      <HelpRibbon />
      <WelcomeModal />
      <IntentPromptModal />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
