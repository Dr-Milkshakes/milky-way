from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    notion_api_key: str
    notion_database_id: str
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    gemini_api_key: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    class Config:
        env_file = ".env"

settings = Settings()
