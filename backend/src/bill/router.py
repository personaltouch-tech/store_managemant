from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.responses import Response
from src.bill.dtos import createBillItemSchema, BillItemResponseSchema, createBillSchema, getAllBillResponseSchema, getBillResponseSchema
from src.utils.db import get_db
from src.utils.pdf import generate_bill_pdf
from sqlalchemy.orm import Session
from src.bill import controller

bill_route = APIRouter(prefix="/bill", tags=["bill"])

@bill_route.post("/create_billItems", response_model=BillItemResponseSchema, status_code=status.HTTP_201_CREATED)
def create_billItems(body: createBillItemSchema, db: Session = Depends(get_db)):
    return controller.createBillItems(body, db)

@bill_route.post("/create_bill", status_code=status.HTTP_201_CREATED)
def create_bill(body: createBillSchema, db: Session = Depends(get_db)):
    return controller.createBill(body, db)

@bill_route.get("/get_all_bills", response_model=list[getAllBillResponseSchema], status_code=status.HTTP_200_OK)
def get_all_bill(db: Session = Depends(get_db)):
    return controller.getAllBill(db)

@bill_route.get("/get_bill/{bill_id}", response_model=getBillResponseSchema, status_code=status.HTTP_200_OK)
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    return controller.getBill(bill_id, db)

@bill_route.post("/generate_pdf")
def generate_pdf(body: dict):
    pdf_bytes = generate_bill_pdf(body["bill_data"], body["items"])
    bid = body["bill_data"]["bid"]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Bill_{bid}.pdf"}
    )

@bill_route.post("/generate_monthly_pdf")
def generate_monthly_pdf(body: dict):
    from src.utils.monthly_pdf import generate_monthly_statement_pdf
    pdf_bytes = generate_monthly_statement_pdf(body)
    cname = body["customer"]["cname"]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Statement_{cname}.pdf"}
    )