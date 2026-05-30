from supabase import create_client, Client
from config import settings

# Use service key for backend operations (bypasses RLS)
supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_key
)
