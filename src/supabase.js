import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tuwmswxfwnxjzujuignq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1d21zd3hmd254anp1anVpZ25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDgzMDUsImV4cCI6MjA4ODgyNDMwNX0.W5vhsz6495xkNCZAel1YA3t_KA2rd7DRfGEeHy9nCI0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
