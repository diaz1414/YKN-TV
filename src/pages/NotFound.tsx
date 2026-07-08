import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import EmptyWatchState from '../components/EmptyWatchState';
import MainLayout from '../layouts/MainLayout';
import { getLiveSportsData, type PlayableStream } from '../services/streamService';

const NotFound = () => {
  const location = useLocation();
  const [recommendations, setRecommendations] = useState<PlayableStream[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadRecommendations = async () => {
      try {
        const data = await getLiveSportsData();
        if (!mounted) return;

        setRecommendations([
          ...data.matches,
          ...data.sportsTv,
          ...data.liveTv,
        ]);
      } catch (err) {
        console.error('Failed to load fallback recommendations:', err);
      }
    };

    loadRecommendations();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <MainLayout>
      <EmptyWatchState
        variant="route"
        requestedLabel={location.pathname}
        recommendations={recommendations}
      />
    </MainLayout>
  );
};

export default NotFound;
