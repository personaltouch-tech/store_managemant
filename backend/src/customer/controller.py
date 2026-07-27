from fastapi import HTTPException
from src.customer.dtos import createCustomerSchema
from src.customer.model import customer
from sqlalchemy.orm import Session
from src.bill.model import bill, bill_items
from src.products.model import products

def createCustomer(body: createCustomerSchema, db: Session):
    existing_customer = db.query(customer).filter(customer.cphone == str(body.cphone), customer.cname != "Cash Customer").first()
    if existing_customer:
        raise HTTPException(400, detail="Customer is already existing")
    new_Customer = customer(
        cname=body.cname,
        cphone=body.cphone,
        cmail=body.cmail,
        currently_due_amount=body.currently_due_amount,
        last_paid_amount=body.last_paid_amount
    )
    db.add(new_Customer)
    db.commit()
    db.refresh(new_Customer)
    return new_Customer

def get_all_customer(db: Session):
    customers = db.query(customer).all()
    return customers


def get_monthly_customers(db: Session):
    # return customers who have at least one bill with payment_type 'Monthly Account'
    monthly_customers = (
        db.query(customer)
        .join(bill, bill.cid == customer.cid)
        .filter(bill.payment_type == "Monthly Account")
        .distinct()
        .all()
    )
    return monthly_customers

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
                    "unit_price": float(item.unit_price),
                    "subtotal": float(item.subtotal),
                    "created_at": item.created_at
                }
                bill_group.append(bill_item)
                bill_item_rows.append(bill_item)
            bills.append(bill_group)

    customer_data = db.query(customer).filter(customer.cid == cid).first()

    # get all bills with total for this customer
    customer_bills = []
    for Bill in bill_value:
        customer_bills.append({
            "bid": Bill.bid,
            "total_amount": float(Bill.total_amount),
            "payment_type": Bill.payment_type,
            "created_at": Bill.created_at
        })

    return {
        "Bills": bills,
        "BillItems": bill_item_rows,
        "CustomerBills": customer_bills,
        "Customer": {
            "cid": customer_data.cid,
            "cname": customer_data.cname,
            "cphone": customer_data.cphone,
            "cmail": customer_data.cmail,
            "currently_due_amount": float(customer_data.currently_due_amount),
            "last_paid_amount": float(customer_data.last_paid_amount)
        }
    }

# ── PAYMENT ENTRY ─────────────────────────────────────────────
def pay_customer(cid: int, amount: float, db: Session):
    customer_data = db.query(customer).filter(customer.cid == cid).first()
    if not customer_data:
        raise HTTPException(404, detail="Customer not found")

    if amount > customer_data.currently_due_amount:
        raise HTTPException(400, detail="Amount exceeds due amount")

    customer_data.last_paid_amount   = amount
    customer_data.currently_due_amount = customer_data.currently_due_amount - amount
    db.commit()
    db.refresh(customer_data)
    return {
        "message": "Payment recorded successfully",
        "last_paid_amount": float(customer_data.last_paid_amount),
        "currently_due_amount": float(customer_data.currently_due_amount)
    }
   
def delete_bill_item(biid: int, db: Session):
    item = db.query(bill_items).filter(bill_items.biid == biid).first()
    if not item:
        raise HTTPException(404, detail="Bill item not found")

    bid = item.bid
    item_subtotal = float(item.subtotal)

    # find the parent bill + customer
    Bill = db.query(bill).filter(bill.bid == bid).first()
    if not Bill:
        raise HTTPException(404, detail="Bill not found")

    cust = db.query(customer).filter(customer.cid == Bill.cid).first()

    # delete the item
    db.delete(item)
    db.flush()  # so the next query doesn't see the deleted row

    # recompute remaining items for this bill
    remaining_items = db.query(bill_items).filter(bill_items.bid == bid).all()
    new_bill_total = sum(float(i.subtotal) for i in remaining_items)

    bill_deleted = False
    if remaining_items:
        Bill.total_amount = new_bill_total
    else:
        # no items left, drop the empty bill entirely
        db.delete(Bill)
        bill_deleted = True

    # reduce customer's due amount by exactly what was removed
    if cust:
        cust.currently_due_amount = max(0, float(cust.currently_due_amount) - item_subtotal)

    db.commit()

    return {
        "message": "Item deleted successfully",
        "bid": bid,
        "bill_deleted": bill_deleted,
        "new_bill_total": new_bill_total if not bill_deleted else 0,
        "currently_due_amount": float(cust.currently_due_amount) if cust else None
    }    
    
def delete_month_bills(cid: int, month_key: str, db: Session):
    year, month = month_key.split("-")
    from sqlalchemy import extract
    from src.history.controller import save_month_to_history

    # ── SAVE TO HISTORY FIRST ─────────────────────────────────
    save_month_to_history(cid, month_key, db)

    month_bills = db.query(bill).filter(
        bill.cid == cid,
        bill.payment_type == "Monthly Account",
        extract("year",  bill.created_at) == int(year),
        extract("month", bill.created_at) == int(month)
    ).all()

    if not month_bills:
        raise HTTPException(404, detail="No bills found for this month")

    for b in month_bills:
        db.query(bill_items).filter(bill_items.bid == b.bid).delete()
        cust = db.query(customer).filter(customer.cid == cid).first()
        if cust:
            cust.currently_due_amount = max(
                0, float(cust.currently_due_amount) - float(b.total_amount)
            )
        db.delete(b)

    db.commit()
    return {"message": "Month bills saved to history and deleted successfully"}