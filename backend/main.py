from fastapi import FastAPI
from src.utils.db import Base, engine
from src.admin.model import admin, OTPVerification
from src.admin.router import admin
from src.categories.model import categories
from src.categories.router import categories_route
from src.products.model import products          
from src.products.router import products_route   
from src.customer.model import customer
from src.customer.router import customer_route
from src.bill.model import bill
from src.bill.router import bill_route
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
Base.metadata.create_all(engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin)
app.include_router(categories_route)
app.include_router(products_route)              
app.include_router(customer_route)
app.include_router(bill_route)

@app.get("/")
def home():
    print("Home")