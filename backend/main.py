from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import products, orders, ai

# Create all database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ShopGenius AI",
    description="AI-Powered E-Commerce Intelligence Platform",
    version="1.0.0"
)

# CORS (allows my frontend to talk to the backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(ai.router)

@app.get("/")
def root():
    return {
        "message": "Welcome to ShopGenius AI 🛒",
        "docs": "/docs",
        "status": "running"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}