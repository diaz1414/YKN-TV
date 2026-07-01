import { supabase } from './supabase';

export interface CustomEventRow {
    id: number;
    id_event: string;
    nama_event: string | null;
    player_1: string;
    player_2: string;
    logo_1: string | null;
    logo_2: string | null;
    jadwal_event: string;
    jadwal_stop: string | null;
    source_channel_id: string;
    deskripsi: string | null;
    deskripsi_en: string | null;
    is_active: boolean;
    internal_note: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface SaveCustomEventInput {
    id_event?: string;
    nama_event?: string;
    player_1: string;
    player_2: string;
    logo_1?: string;
    logo_2?: string;
    jadwal_event: string;
    jadwal_stop?: string;
    source_channel_id: string;
    deskripsi?: string;
    deskripsi_en?: string;
    is_active?: boolean;
    internal_note?: string;
}

const slugifyMini = (text: string) => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

export const getActiveCustomEvents = async (): Promise<CustomEventRow[]> => {
    const { data, error } = await supabase
        .from('ykn_custom_events')
        .select('*')
        .eq('is_active', true)
        .order('jadwal_event', { ascending: true });

    if (error) {
        console.warn('[Custom Events] gagal ambil event aktif:', error.message);
        return [];
    }

    return (data || []) as CustomEventRow[];
};

export const getCustomEventsForAdmin = async (): Promise<CustomEventRow[]> => {
    const { data, error } = await supabase
        .from('ykn_custom_events')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('[Custom Events Admin] gagal ambil list:', error.message);
        return [];
    }

    return (data || []) as CustomEventRow[];
};

export const saveCustomEvent = async (
    input: SaveCustomEventInput
): Promise<CustomEventRow | null> => {
    const idEvent =
        input.id_event ||
        `${slugifyMini(`${input.player_1}-vs-${input.player_2}`)}-${Date.now()}`;

    const payload = {
        id_event: idEvent,
        nama_event: input.nama_event || 'Live Event',
        player_1: input.player_1.trim(),
        player_2: input.player_2.trim(),
        logo_1: input.logo_1?.trim() || null,
        logo_2: input.logo_2?.trim() || null,
        jadwal_event: input.jadwal_event,
        jadwal_stop: input.jadwal_stop || null,
        source_channel_id: input.source_channel_id,
        deskripsi: input.deskripsi || null,
        deskripsi_en: input.deskripsi_en || null,
        is_active: input.is_active ?? true,
        internal_note: input.internal_note || null,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('ykn_custom_events')
        .upsert(payload, {
            onConflict: 'id_event',
        })
        .select('*')
        .single();

    if (error) throw error;

    return data as CustomEventRow;
};

export const setCustomEventActive = async (
    id: number,
    isActive: boolean
): Promise<void> => {
    const { error } = await supabase
        .from('ykn_custom_events')
        .update({
            is_active: isActive,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) throw error;
};

export const deleteCustomEvent = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('ykn_custom_events')
        .delete()
        .eq('id', id);

    if (error) throw error;
};