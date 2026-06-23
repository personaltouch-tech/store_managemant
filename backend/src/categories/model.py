from src.utils.db import Base
from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, func, Boolean

class categories(Base):
    __tablename__ = "categories"
    cid = Column(Integer, primary_key=True)
    cname = Column(String(100))
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(
        TIMESTAMP(timezone=True), 
        nullable=False, 
        server_default=func.now()
    )