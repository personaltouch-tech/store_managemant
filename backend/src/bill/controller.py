from src.bill.dtos import createBillItemSchema, createBillSchema
from sqlalchemy.orm import Session
from src.customer.model import customer
from src.bill.model import bill_items, bill

def createBillItems(body : createBillItemSchema, db : Session):
    # Creating Bill Item row in BillItem Table
    subtotal = body.quantity * body.unit_price
    new_BillItems = bill_items(
        bid = body.bid,
        pid = body.pid,
        quantity = body.quantity,
        unit_price = body.unit_price,
        subtotal = subtotal
    )
    db.add(new_BillItems)
    db.commit()
    db.refresh(new_BillItems)
    # updating total_amount from bill table 

    current_bill = db.query(bill).filter(bill.bid == body.bid).first()

    if current_bill:
        current_bill.total_amount += subtotal

        # Updating currently_due_amount from customer table

        current_customer = db.query(customer).filter(customer.cid == current_bill.cid).first()

        if current_customer:
            current_customer.currently_due_amount += subtotal

    db.commit()
    return new_BillItems

def createBill(body : createBillSchema, db : Session):
    new_bill = bill(
        cid = body.cid
    )
    db.add(new_bill)
    db.commit()
    db.refresh(new_bill)
    return new_bill.bid

def getAllBill(db : Session):
    Bills = db.query(bill).all()
    return Bills

def getBill(bill_id : int ,db : Session):
    get_bill = db.query(customer.cname, bill).join(customer, customer.cid == bill.cid).filter(bill.bid == bill_id).first()

    return {
        "cname": get_bill.cname,
        "bid": get_bill.bill.bid,
        "cid": get_bill.bill.cid,
        "total_amount": get_bill.bill.total_amount,
        "created_at": get_bill.bill.created_at
    }