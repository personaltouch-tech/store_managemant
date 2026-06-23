from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.utils.db import Base, engine
from src.admin.model import admin, OTPVerification
from src.admin.router import admin
from src.categories.model import categories
from src.categories.router import categories_route
from src.products.model import products
from src.products.router import products_route
from src.customer.router import customer_route
from src.bill.router import bill_route
from fastapi.staticfiles import StaticFiles
import os
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(engine)

app.include_router(admin)
app.include_router(categories_route)
app.include_router(products_route)
app.include_router(customer_route)
app.include_router(bill_route)

@app.get("/")
def home():
    print("Home")