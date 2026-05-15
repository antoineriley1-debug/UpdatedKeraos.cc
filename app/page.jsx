import { getSessionUser } from '@/lib/auth';
import Dashboard from '@/components/Dashboard';
import LoginPage from '@/components/LoginPage';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const user = getSessionUser();
  if (!user) return <LoginPage />;
  return <Dashboard initialUser={user} />;
}
