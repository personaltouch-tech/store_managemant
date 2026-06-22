from fastapi import APIRouter, Depends, status
from src.customer.dtos import customerResponseScema, createCustomerSchema
from sqlalchemy.orm import Session
from src.utils.db import get_db
from src.customer import controller
customer_route = APIRouter(prefix="/customer", tags=["customer"])

@customer_route.post("/create_customer", response_model=customerResponseScema, status_code=status.HTTP_201_CREATED)
def create_customer(body : createCustomerSchema, db : Session = Depends(get_db)):
    return controller.createCustomer(body, db)

@customer_route.get("/get_all_customer")
def get_all_customer(db : Session = Depends(get_db)):
    return controller.get_all_customer(db)

@customer_route.get("/get_customer/{cid}")
def get_customer(cid : int, db : Session = Depends(get_db)):
    return controller.get_customer(cid, db)
