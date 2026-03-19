from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from groq import Groq
from dotenv import load_dotenv
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import Product
from schemas import AIDescriptionRequest, ChatRequest

load_dotenv()
router = APIRouter(prefix="/ai", tags=["AI"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# AI Product Description Generator
@router.post("/generate-description")
def generate_description(request: AIDescriptionRequest, db: Session = Depends(get_db)):
    prompt = f"""You are an expert e-commerce copywriter. Write a compelling, SEO-optimized product description.

Product Details:
- Name: {request.product_name}
- Category: {request.category or 'General'}
- Price: ${request.price or 'N/A'}
- Key Features: {request.key_features or 'Not specified'}

Write a 3-paragraph description:
1. Hook (exciting opening that grabs attention)
2. Features & Benefits (what makes it great)
3. Call to action (why buy now)

Keep it under 200 words. Be persuasive, clear, and natural."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.7
    )
    
    description = response.choices[0].message.content
    return {"description": description}

# Save AI description to product
@router.post("/save-description/{product_id}")
def save_ai_description(product_id: int, description: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.ai_description = description
    db.commit()
    return {"message": "AI description saved successfully"}

# Customer Support Chatbot
@router.post("/chat")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    # Get all products for context
    products = db.query(Product).all()
    product_list = "\n".join([
        f"- {p.name} | Price: ${p.price} | Stock: {p.stock} | Category: {p.category}"
        for p in products
    ])

    system_prompt = f"""You are ShopGenius AI, a friendly and helpful customer support assistant for an online store.

Current Product Catalog:
{product_list if product_list else "No products listed yet."}

Your job:
- Answer questions about products, pricing, and availability
- Help customers find the right product
- Handle order inquiries politely
- If you don't know something, say so honestly
- Keep responses concise and friendly (under 100 words)
- Always end with a helpful follow-up question"""

    # Build conversation history
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in request.conversation_history:
        messages.append(msg)
    
    messages.append({"role": "user", "content": request.message})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=200,
        temperature=0.6
    )

    reply = response.choices[0].message.content
    return {"reply": reply}

# AI Pricing Suggestion
@router.post("/suggest-price")
def suggest_price(product_name: str, category: str, db: Session = Depends(get_db)):
    # Get similar products from DB
    similar = db.query(Product).filter(Product.category == category).all()
    similar_prices = [p.price for p in similar]
    avg_price = sum(similar_prices) / len(similar_prices) if similar_prices else None

    prompt = f"""You are a pricing expert for an e-commerce store.

Product: {product_name}
Category: {category}
Similar products in our store avg price: {'$' + str(round(avg_price, 2)) if avg_price else 'No data yet'}

Suggest a competitive price range for this product. Give:
1. Minimum price
2. Recommended price  
3. Premium price
4. One sentence explaining your reasoning

Be concise and practical."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
        temperature=0.5
    )

    return {"suggestion": response.choices[0].message.content}