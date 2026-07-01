import { supabase } from './supabase';
import type { StreamServer } from './streamService';

export interface EventServerRow {
    id: number;
    stream_id: string;
    display_name: string | null;
    url: string;
    type: string | null;
    force_proxy: boolean | null;
    priority: number | null;
    is_active: boolean;
    internal_note?: string | null;
}

export const getActiveEventServers = async (
    streamId: string,
    baseServerCount = 0
): Promise<StreamServer[]> => {
    const { data, error } = await supabase
        .from('ykn_event_servers')
        .select('id, stream_id, display_name, url, type, force_proxy, priority, is_active')
        .eq('stream_id', streamId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

    if (error) {
        console.warn('[EventServers] gagal ambil server tambahan:', error.message);
        return [];
    }

    return (data || []).map((item, index) => ({
        name: `Server ${baseServerCount + index + 1}`,
        url: item.url,
        type: item.type || 'hls',
        forceProxy: item.force_proxy === true,
    }));
};