import { createClient } from "@supabase/supabase-js"
import { dataProvider, liveProvider } from "@refinedev/supabase"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)

export const supabaseDataProvider = dataProvider(supabaseClient)
export const supabaseLiveProvider = liveProvider(supabaseClient)
