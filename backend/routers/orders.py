from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import Order, Product
from schemas import OrderCreate, OrderResponse

router = APIRouter(prefix="/orders", tags=["Orders"])

# CREATE an order
@router.post("/", response_model=OrderResponse)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    # Check product exists and has enough stock
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock < order.quantity:
        raise HTTPException(status_code=400, detail=f"Not enough stock. Available: {product.stock}")
    
    # Calculate total price
    total = product.price * order.quantity
    
    # Deduct stock
    product.stock -= order.quantity
    
    # Create order
    db_order = Order(
        customer_name=order.customer_name,
        customer_email=order.customer_email,
        product_id=order.product_id,
        product_name=product.name,
        quantity=order.quantity,
        total_price=total
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

# READ all orders
@router.get("/", response_model=List[OrderResponse])
def get_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders

# READ single order
@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# UPDATE order status
@router.patch("/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db)):
    valid_statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {valid_statuses}")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status
    db.commit()
    return {"message": f"Order #{order_id} status updated to '{status}'"}

# GET sales analytics summary
@router.get("/analytics/summary")
def get_sales_summary(db: Session = Depends(get_db)):
    orders = db.query(Order).all()
    total_revenue = sum(o.total_price for o in orders)
    total_orders = len(orders)
    
    # Revenue by status
    by_status = {}
    for order in orders:
        by_status[order.status] = by_status.get(order.status, 0) + 1

    return {
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "orders_by_status": by_status,
        "average_order_value": round(total_revenue / total_orders, 2) if total_orders > 0 else 0
    }