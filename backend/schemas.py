from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# Product Schemas
class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    stock: int = 0
    category: Optional[str] = None
    sku: str

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    category: Optional[str] = None

class ProductResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float
    stock: int
    category: Optional[str]
    sku: str
    ai_description: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True   # Allows SQLAlchemy objects to be serialized

# Order Schemas
class OrderCreate(BaseModel):
    customer_name: str
    customer_email: str
    product_id: int
    quantity: int = 1

class OrderResponse(BaseModel):
    id: int
    customer_name: str
    customer_email: str
    product_id: int
    product_name: Optional[str]
    quantity: int
    total_price: float
    status: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

# AI Schemas
class AIDescriptionRequest(BaseModel):
    product_name: str
    category: Optional[str] = None
    price: Optional[float] = None
    key_features: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list] = []