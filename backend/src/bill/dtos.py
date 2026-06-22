from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
class createBillItemSchema(BaseModel):
    bid : int
    pid : int
    quantity : int
    unit_price : int

class BillItemResponseSchema(BaseModel):
    biid : int
    bid : int
    pid : int
    quantity : int
    unit_price : int
    subtotal : Decimal
    created_at : datetime

class createBillSchema  (BaseModel):
    cid : int

class getAllBillResponseSchema(BaseModel):
    bid : int
    cid : int
    total_amount : Decimal
    created_at : datetime
    
class getBillResponseSchema(BaseModel):
    cname : str
    bid : int
    cid : int
    total_amount : Decimal
    created_at : datetime
    
    class Config:
        from_attributes = True