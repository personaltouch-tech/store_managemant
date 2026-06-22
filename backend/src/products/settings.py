from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DB_CONNECTION: str
    SECRET_KEY: str
    ALGORITHM: str
    EXP_TIME: int
    BREVO_API_KEY: str
    SENDER_EMAIL: str
    SHOP_NAME: str

    class Config:
        env_file = ".env"

settings = Settings()