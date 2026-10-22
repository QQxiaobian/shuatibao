import { Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Header from '@/components/Header';
import BottomTabBar from '@/components/BottomTabBar';
import { QBanksProvider } from '@/contexts/QBanksContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';

export function Layout() {
  return (
    <QBanksProvider>
      <FavoritesProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1 w-full pb-20 md:pb-0">
            <Outlet />
          </main>
          <BottomTabBar />
          <Toaster position="top-center" />
        </div>
      </FavoritesProvider>
    </QBanksProvider>
  );
}
