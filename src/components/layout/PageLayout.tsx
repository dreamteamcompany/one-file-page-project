import { ReactNode, useState } from 'react';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';

interface PageLayoutProps {
  children: ReactNode;
  menuOpen?: boolean;
  setMenuOpen?: (open: boolean) => void;
}

const PageLayout = ({ children, menuOpen: externalMenuOpen, setMenuOpen: externalSetMenuOpen }: PageLayoutProps) => {
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const menuOpen = externalMenuOpen !== undefined ? externalMenuOpen : internalMenuOpen;
  const setMenuOpen = externalSetMenuOpen || setInternalMenuOpen;
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [dictionariesOpen, setDictionariesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      setMenuOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#0f1535] [.light_&]:bg-[#f3f3f9]">
      <PaymentsSidebar
        menuOpen={menuOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        dictionariesOpen={dictionariesOpen}
        setDictionariesOpen={setDictionariesOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
      />

      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className={`${sidebarCollapsed ? 'lg:ml-[70px]' : 'lg:ml-[250px]'} p-4 md:p-6 lg:p-[30px] min-h-screen flex-1 overflow-x-hidden max-w-full transition-all duration-300 flex flex-col`}>
        {children}
      </main>
    </div>
  );
};

export default PageLayout;