from fastapi import HTTPException
from src.categories.dtos import createCategoriesSchema, updateCategoriesSchema
from src.utils.db import get_db
from sqlalchemy.orm import Session
from src.categories.model import categories

def create_category(body: createCategoriesSchema, db: Session):
    existing_category = db.query(categories).filter(categories.cname == body.cname).first()
    if existing_category:
        raise HTTPException(400, detail="Category with this name already exists")

    new_category = categories(
        cname=body.cname,
        description=body.description
    )
    db.add(new_category)
    db.commit()
    db.refresh(new_category)

    return {"message": "Category created successfully", "category_id": new_category.cid}

def get_categories(db: Session):
    categories_list = db.query(categories).all()
    return categories_list

def update_category(category_id: int, body: updateCategoriesSchema, db: Session):
    existing_category = db.query(categories).get(category_id)
    if not existing_category:
        raise HTTPException(404, detail="Category not found")

    existing_category.cname = body.cname
    existing_category.description = body.description
    db.commit()
    db.refresh(existing_category)
    return existing_category

def delete_category(category_id: int, db: Session):
    existing_category = db.query(categories).filter(categories.cid == category_id).first()
    if not existing_category:
        raise HTTPException(404, detail="Category not found")

    db.delete(existing_category)
    db.commit()

    return existing_category