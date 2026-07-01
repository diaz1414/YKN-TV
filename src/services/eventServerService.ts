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
    source_label?: string | null;
    created_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface SaveEventServerInput {
    stream_id: string;
    url: string;
    type?: string;
    force_proxy?: boolean;
    priority?: number;
    is_active?: boolean;
    internal_note?: string | null;
    source_label?: string | null;
    created_by?: string | null;
}

const normalizeUrl = (url: string) => {
    return url.trim();
};

const detectType = (url: string) => {
    const clean = url.toLowerCase();

    if (clean.includes('.mpd')) return 'dash';
    if (clean.includes('.m3u8')) return 'hls';

    return 'hls';
};

export const getActiveEventServers = async (
    streamId: string,
    baseServerCount = 0
): Promise<StreamServer[]> => {
    const { data, error } = await supabase
        .from('ykn_event_servers')
        .select('id, stream_id, display_name, url, type, force_proxy, priority, is_active')
        .eq('stream_id', streamId)
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .order('id', { ascending: true });

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

export const getEventServersForAdmin = async (
    streamId?: string
): Promise<EventServerRow[]> => {
    let query = supabase
        .from('ykn_event_servers')
        .select('*')
        .order('created_at', { ascending: false });

    if (streamId) {
        query = query.eq('stream_id', streamId);
    }

    const { data, error } = await query;

    if (error) {
        console.warn('[EventServers Admin] gagal ambil list:', error.message);
        return [];
    }

    return (data || []) as EventServerRow[];
};

export const saveEventServer = async (
    input: SaveEventServerInput
): Promise<EventServerRow | null> => {
    const cleanUrl = normalizeUrl(input.url);

    const payload = {
        stream_id: input.stream_id,
        display_name: 'Server',
        url: cleanUrl,
        type: input.type || detectType(cleanUrl),
        force_proxy: input.force_proxy === true,
        priority: input.priority ?? 50,
        is_active: input.is_active ?? true,
        internal_note: input.internal_note || null,
        source_label: input.source_label || 'Manual Backup',
        created_by: input.created_by || null,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('ykn_event_servers')
        .upsert(payload, {
            onConflict: 'stream_id,url',
        })
        .select('*')
        .single();

    if (error) {
        throw error;
    }

    return data as EventServerRow;
};

export const setEventServerActive = async (
    id: number,
    isActive: boolean
): Promise<void> => {
    const { error } = await supabase
        .from('ykn_event_servers')
        .update({
            is_active: isActive,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) {
        throw error;
    }
};

export const deleteEventServer = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('ykn_event_servers')
        .delete()
        .eq('id', id);

    if (error) {
        throw error;
    }
};