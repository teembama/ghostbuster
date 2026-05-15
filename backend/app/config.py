# Application configuration loaded from environment variables
# TODO: Define Settings class using pydantic-settings (BaseSettings) to load:
#   - SUPABASE_URL, SUPABASE_KEY
#   - SQUAD_API_KEY, SQUAD_BASE_URL
#   - ENVIRONMENT
#   - ALLOWED_ORIGINS (parse comma-separated list)
#   - MOCK_SQUAD (bool)
# Expose a cached settings() accessor.

from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    squad_api_key: str
    squad_base_url: str = "https://sandbox-api-d.squadco.com"
    environment: str = "development"
    allowed_origins: list[str] = ["http://localhost:3000"]
    mock_squad: bool = True
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()