import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase project test
const supabaseUrl = 'https://amdhbxowpnpwhtxxayuj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZGhieG93cG5wd2h0eHhheXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzQ0NzIsImV4cCI6MjA4Nzg1MDQ3Mn0.SW4U3CS-GrChptrtKyZnKy5x-wiIaNIXHULPGO56DFo';

// Set to true to disable Supabase and avoid network errors when client is over quota limits
const DISABLE_SUPABASE = true;

const createMockSupabase = () => {
  const dummyBuilder: any = {
    select: () => dummyBuilder,
    insert: () => dummyBuilder,
    update: () => dummyBuilder,
    upsert: () => dummyBuilder,
    delete: () => dummyBuilder,
    eq: () => dummyBuilder,
    neq: () => dummyBuilder,
    order: () => dummyBuilder,
    single: () => dummyBuilder,
    limit: () => dummyBuilder,
    range: () => dummyBuilder,
    then: (resolve: any) => resolve({ data: [], error: null }),
    catch: () => {},
  };

  const dummyChannel: any = {
    on: () => dummyChannel,
    subscribe: (callback?: (status: any) => void) => {
      if (callback) {
        setTimeout(() => callback('SUBSCRIBED'), 0);
      }
      return dummyChannel;
    },
    track: () => Promise.resolve(),
    unsubscribe: () => {},
    presenceState: () => ({}),
  };

  return {
    from: () => dummyBuilder,
    rpc: () => Promise.resolve({ data: [], error: null }),
    channel: () => dummyChannel,
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      }),
    }
  } as any;
};

export const supabase: any = DISABLE_SUPABASE
  ? createMockSupabase()
  : createClient(supabaseUrl, supabaseKey);
