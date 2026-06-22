from fastapi import HTTPException
from src.customer.dtos import createCustomerSchema
from src.customer.model import customer
from sqlalchemy.orm import Session
from src.bill.model import bill, bill_items
from src.products.model import products
def createCustomer(body: createCustomerSchema, db : Session):
    exeisting_customer = db.query(customer).filter(customer.cphone == str(body.cphone)).first()
    if exeisting_customer:
        raise HTTPException(400, detail="Customer is already existing")
    new_Customer = customer(
                    cname = body.cname,
                    cphone = body.cphone,
                    cmail = body.cmail,
                    currently_due_amount = body.currently_due_amount,
                    last_paid_amount = body.last_paid_amount
    )
    db.add(new_Customer)
    db.commit()
    db.refresh(new_Customer)

    return new_Customer

def get_all_customer(db : Session):
    customers = db.query(customer).all()
    return customers

def get_customer(cid: int, db: Session):
    bill_value = db.query(bill).filter(bill.cid == cid).all()

    bills = []
    bill_item_rows = []

    for Bill in bill_value:
        billItems = (
            db.query(bill_items, products.product_name)
            .join(products, products.pid == bill_items.pid)
            .filter(bill_items.bid == Bill.bid)
            .all()
        )

        if billItems:
            bill_group = []

            for item, product_name in billItems:
                bill_item = {
                    "biid": item.biid,
                    "bid": item.bid,
                    "pid": item.pid,
                    "product_name": product_name,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "subtotal": item.subtotal,
                    "created_at": item.created_at
                }
                bill_group.append(bill_item)
                bill_item_rows.append(bill_item)

            bills.append(bill_group)

    customer_data = (
        db.query(
            customer.cname,
            customer.cphone,
            customer.cmail,
            customer.currently_due_amount,
            customer.last_paid_amount
        )
        .filter(customer.cid == cid)
        .first()
    )

    return {
        "Bills": bills,
        "BillItems": bill_item_rows,
        "Customer": {
            "cname": customer_data.cname,
            "cphone": customer_data.cphone,
            "cmail": customer_data.cmail,
            "currently_due_amount": customer_data.currently_due_amount,
            "last_paid_amount": customer_data.last_paid_amount
        }
    }
