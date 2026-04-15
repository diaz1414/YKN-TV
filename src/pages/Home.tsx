import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ChannelCard from '../components/ChannelCard';
import { getChannels, searchAndFilterChannels } from '../services/streamService';
import type { Channel } from '../services/streamService';
import { Zap, Tv, ShieldCheck, Search, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Home = () => {
  const navigate = useNavigate();
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    const fetchChannels = async () => {
      setLoading(true);
      const data = await getChannels();
      setAllChannels(data);
      setLoading(false);
    };
    fetchChannels();
  }, []);

  const filteredChannels = useMemo(() => {
    return searchAndFilterChannels(allChannels, searchTerm, activeCategory);
  }, [allChannels, searchTerm, activeCategory]);

  const displayedChannels = useMemo(() => {
    return filteredChannels.slice(0, limit);
  }, [filteredChannels, limit]);

  const handleChannelClick = (id: string) => {
    navigate(`/watch/${id}`);
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Jala-Style Hero */}
        <section className="relative h-[400px] rounded-[2.5rem] overflow-hidden group shadow-2xl ring-1 ring-white/10">
          <img 
            src="https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80&w=2000" 
            alt="Sports Stadium" 
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />
          
          <div className="absolute inset-x-0 bottom-0 p-12 flex flex-col items-start translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            <div className="flex items-center gap-2 py-1.5 px-4 bg-primary text-dark rounded-full mb-6 shadow-[0_0_30px_rgba(0,255,136,0.6)] animate-pulse">
              <Zap size={14} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-widest">Dynamic Aggregator</span>
            </div>
            <h2 className="text-6xl font-display font-black leading-none mb-6 tracking-tighter uppercase italic">
              YKN <span className="text-primary">GLOBAL</span> IPTV
            </h2>
            <div className="flex items-center gap-8">
              <StatItem icon={<Tv size={18} />} label="Channels" value={`${allChannels.length}+`} />
              <StatItem icon={<ShieldCheck size={18} />} label="Status" value="Verified" />
            </div>
          </div>
        </section>

        {/* Discovery Controls */}
        <section className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-10 bg-primary rounded-full shadow-[0_0_20px_rgba(0,255,136,0.5)]" />
              <h3 className="text-4xl font-display font-black uppercase tracking-tighter italic">Discovery</h3>
            </div>

            {/* Search Bar */}
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
              <input 
                type="text"
                placeholder="Search channel name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-sm font-bold focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-white/10"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 p-1.5 bg-surface rounded-2xl border border-white/5">
              {['All', 'Sports', 'Indonesia'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setLimit(20);
                  }}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    activeCategory === cat 
                      ? 'bg-primary text-dark shadow-lg shadow-primary/20 scale-105' 
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="text-primary animate-spin" size={48} />
              <p className="text-white/40 font-bold uppercase tracking-[0.2em] text-xs">Fetching Global Index...</p>
            </div>
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                <motion.div 
                  layout
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                  {displayedChannels.map((channel, i) => (
                    <motion.div
                      key={channel.id + i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChannelCard 
                        channel={channel} 
                        onClick={() => handleChannelClick(channel.id)} 
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {filteredChannels.length > limit && (
                <div className="flex justify-center pt-8">
                  <button 
                    onClick={() => setLimit(prev => prev + 20)}
                    className="px-8 py-4 bg-surface hover:bg-surface-hover border border-white/5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95"
                  >
                    Load More Channels
                  </button>
                </div>
              )}

              {!loading && filteredChannels.length === 0 && (
                <div className="py-24 text-center">
                  <p className="text-white/20 text-xl font-bold italic italic-shadow uppercase">No Channels Found</p>
                  <button onClick={() => setSearchTerm('')} className="text-primary font-bold mt-2 hover:underline">Clear Search</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </MainLayout>
  );
};

const StatItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary border border-white/10">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-lg font-black leading-none">{value}</p>
    </div>
  </div>
);

export default Home;
