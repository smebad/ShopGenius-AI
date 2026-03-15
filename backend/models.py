from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.sql import func
from database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    stock = Column(Integer, default=0)
    category = Column(String(100))
    sku = Column(String(100), unique=True)
    ai_description = Column(Text) # AI generated SEO description
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(200), nullable=False)
    customer_email = Column(String(200), nullable=False)
    product_id = Column(Integer, nullable=False)
    product_name = Column(String(200))
    quantity = Column(Integer, default=1)
    total_price = Column(Float, nullable=False)
    status = Column(String(50), default="pending") # pending, shipped, delivered
    created_at = Column(DateTime, server_default=func.now())