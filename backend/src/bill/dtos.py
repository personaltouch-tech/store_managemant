from typing import Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, EmailStr

class createBillItemSchema(BaseModel):
    bid: int
    pid: int
    quantity: int
    unit_price: int

class BillItemResponseSchema(BaseModel):
    biid: int
    bid: int
    pid: int
    quantity: int
    unit_price: int
    subtotal: Decimal
    created_at: datetime

class createBillSchema(BaseModel):
    cid: int
    payment_type: str = "Cash"

class getAllBillResponseSchema(BaseModel):
    bid: int
    cid: int
    total_amount: Decimal
    payment_type: str = "Cash"
    created_at: datetime

class getBillResponseSchema(BaseModel):
    cname: str
    cphone: Optional[str] = ""
    bid: int
    cid: int
    total_amount: Decimal
    payment_type: str = "Cash"
    created_at: datetime

    class Config:
        from_attributes = True
  

class SendEmailSchema(BaseModel):
    to_email: EmailStr
    bill_data: dict
    items: list        