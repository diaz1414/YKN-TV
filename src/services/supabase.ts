import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase project details
const supabaseUrl = 'https://amdhbxowpnpwhtxxayuj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZGhieG93cG5wd2h0eHhheXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzQ0NzIsImV4cCI6MjA4Nzg1MDQ3Mn0.SW4U3CS-GrChptrtKyZnKy5x-wiIaNIXHULPGO56DFo';

export const supabase = createClient(supabaseUrl, supabaseKey);
