from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class createCustomerSchema(BaseModel):
    cname : str
    cphone : Optional[str] = "" 
    cmail : Optional[str] = ""
    currently_due_amount : Optional[int] = 0
    last_paid_amount : Optional[int] = 0

class customerResponseScema(BaseModel):
    cid : int
    cname : str
    cphone : Optional[str] = ""
    cmail : Optional[str] = ""
    currently_due_amount : int
    last_paid_amount : int
    created_at : datetime