import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ChannelCard from '../components/ChannelCard';
import MatchSchedule from '../components/MatchSchedule';
import { getChannels, searchAndFilterChannels, PLAYLIST_PRESETS } from '../services/streamService';
import type { Channel, PlaylistPreset } from '../services/streamService';
import { Zap, Tv, ShieldCheck, Search, X, Loader2, ListFilter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Home = () => {
  const navigate = useNavigate();
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // M3U Playlist Preset State
  const [presetType, setPresetType] = useState<'category' | 'country'>('category');
  const [activePreset, setActivePreset] = useState<PlaylistPreset>(PLAYLIST_PRESETS[0]); // Default to Sports
  const [activeSubCategory, setActiveSubCategory] = useState('All');
  const [limit, setLimit] = useState(20);

  // Filter presets based on Category/Country toggle
  const presetsToShow = useMemo(() => {
    return PLAYLIST_PRESETS.filter(p => p.type === presetType);
  }, [presetType]);

  // Load channels whenever the active playlist preset changes
  useEffect(() => {
    const fetchChannels = async () => {
      setLoading(true);
      try {
        const data = await getChannels(activePreset.url);
        setAllChannels(data);
      } catch (err) {
        console.error('Error fetching channels:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChannels();
    setActiveSubCategory('All');
    setLimit(20);
  }, [activePreset]);

  // Extract unique sub-categories dynamically from the loaded channels
  const subCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('All');
    allChannels.forEach(ch => {
      if (ch.category) {
        // Handle comma-separated categories or just capitalize
        const catName = ch.category.trim();
        if (catName) cats.add(catName);
      }
    });
    return Array.from(cats);
  }, [allChannels]);

  // Filter channels based on search term and sub-category
  const filteredChannels = useMemo(() => {
    return searchAndFilterChannels(allChannels, searchTerm, activeSubCategory);
  }, [allChannels, searchTerm, activeSubCategory]);

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
            src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=2000"
            alt="Sports Stadium"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-12 flex flex-col items-start translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            <div className="flex items-center gap-2 py-1.5 px-4 bg-primary text-dark rounded-full mb-6 shadow-[0_0_30px_rgba(0,255,136,0.6)] animate-pulse">
              <Zap size={14} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-widest">Live Sports Hub</span>
            </div>
            <h2 className="text-6xl font-display font-black leading-none mb-6 tracking-tighter uppercase italic">
              YKN <span className="text-primary">SPORTS</span> HD
            </h2>
            <div className="flex items-center gap-8">
              <StatItem icon={<Tv size={18} />} label="Live Stream" value="24/7" />
              <StatItem icon={<ShieldCheck size={18} />} label="Quality" value="4K UHD" />
            </div>
          </div>
        </section>

        {/* Match Schedule Section */}
        <MatchSchedule />

        {/* Discovery Controls */}
        <section className="space-y-8 pt-6 border-t border-white/5">
          <div className="flex flex-col gap-6">
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

              {/* Preset Category/Country Toggle */}
              <div className="flex items-center gap-1.5 p-1.5 bg-surface rounded-2xl border border-white/5 self-start md:self-auto">
                <button
                  onClick={() => {
                    setPresetType('category');
                    // Find first category preset
                    const firstCat = PLAYLIST_PRESETS.find(p => p.type === 'category');
                    if (firstCat) setActivePreset(firstCat);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    presetType === 'category'
                      ? 'bg-primary text-dark shadow-lg shadow-primary/20 scale-105'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Categories
                </button>
                <button
                  onClick={() => {
                    setPresetType('country');
                    // Find first country preset
                    const firstCountry = PLAYLIST_PRESETS.find(p => p.type === 'country');
                    if (firstCountry) setActivePreset(firstCountry);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    presetType === 'country'
                      ? 'bg-primary text-dark shadow-lg shadow-primary/20 scale-105'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Countries
                </button>
              </div>
            </div>

            {/* Presets List */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {presetsToShow.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setActivePreset(preset)}
                  className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                    activePreset.id === preset.id
                      ? 'bg-primary text-dark border-primary shadow-lg shadow-primary/10 scale-105 font-black'
                      : 'bg-surface text-white/60 hover:text-white hover:bg-white/5 border-white/5 font-bold'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            {/* Sub-categories Filtering */}
            {!loading && subCategories.length > 2 && (
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mr-2 flex items-center gap-1">
                  <ListFilter size={12} /> Filter:
                </span>
                {subCategories.slice(0, 12).map((subCat) => (
                  <button
                    key={subCat}
                    onClick={() => setActiveSubCategory(subCat)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                      activeSubCategory.toLowerCase() === subCat.toLowerCase()
                        ? 'bg-white/10 text-primary border-primary/30 shadow-[0_0_15px_rgba(0,255,136,0.15)] font-black'
                        : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10 border-transparent font-semibold'
                    }`}
                  >
                    {subCat}
                  </button>
                ))}
              </div>
            )}
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
