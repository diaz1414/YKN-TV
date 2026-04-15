import React from 'react';
import Sidebar from '../components/Sidebar';
import { Search, Bell } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-dark text-white">
      <Sidebar />
      
      <main className="flex-1 ml-64 flex flex-col">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 sticky top-0 bg-dark/80 backdrop-blur-md z-50">
          <div className="flex items-center gap-4 bg-white/5 px-4 py-2.5 rounded-2xl w-96 border border-white/5 group focus-within:border-primary/50 transition-all">
            <Search size={18} className="text-white/40 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search matches, teams or leagues..." 
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/20"
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-full transition-all">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-dark" />
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-white/10 group cursor-pointer">
              <div className="text-right">
                <p className="text-sm font-semibold">Diaz Ngoding</p>
                <p className="text-[10px] text-white/40 font-medium">Premium Member</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-tr from-primary to-emerald-400 rounded-xl flex items-center justify-center font-bold text-dark group-hover:scale-110 transition-transform">
                DN
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
