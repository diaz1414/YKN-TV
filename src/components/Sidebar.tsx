import React from 'react';
import { Home, Play, Star, Settings, LogOut, Trophy, Globe, Zap } from 'lucide-react';

const Sidebar = () => {
  return (
    <aside className="w-64 min-h-screen bg-surface border-r border-white/5 flex flex-col fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
          <Play fill="currentColor" size={24} />
          YKN TV
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-8">
        <div>
          <p className="px-4 text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">Categories</p>
          <div className="space-y-1">
            <SidebarLink icon={<Home size={20} />} label="Live Events" active />
            <SidebarLink icon={<Zap size={20} />} label="beIN Sports" />
            <SidebarLink icon={<Trophy size={20} />} label="SSC Sports" />
            <SidebarLink icon={<Star size={20} />} label="Favorites" />
          </div>
        </div>

        <div>
          <p className="px-4 text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">Top Leagues</p>
          <div className="space-y-1">
            <SidebarLink icon={<Trophy size={20} />} label="Premier League" />
            <SidebarLink icon={<Globe size={20} />} label="La Liga" />
            <SidebarLink icon={<Zap size={20} />} label="Champions League" />
            <SidebarLink icon={<Star size={20} />} label="World Cup" />
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-white/5 space-y-1">
        <SidebarLink icon={<Settings size={20} />} label="Settings" />
        <SidebarLink icon={<LogOut size={20} />} label="Logout" />
      </div>
    </aside>
  );
};

const SidebarLink = ({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) => (
  <a
    href="#"
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${active
        ? 'bg-primary/10 text-primary'
        : 'text-white/60 hover:bg-white/5 hover:text-white'
      }`}
  >
    <span className={active ? 'text-primary' : 'text-white/40 group-hover:text-white transition-colors'}>
      {icon}
    </span>
    <span className="font-medium">{label}</span>
  </a>
);

export default Sidebar;
