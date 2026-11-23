from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Accord | Accident Assessment"
    database_url: str = "sqlite:///./accidents.db"
    upload_dir: str = "uploads"
    max_upload_mb: int = 10
    allowed_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
