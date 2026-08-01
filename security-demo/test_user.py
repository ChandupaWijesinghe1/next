from main import SessionLocal
from schemas.user import UserCreate
from services.user_service import create_user

db = SessionLocal()
try:
    user = create_user(
        db,
        UserCreate(email="test22@example.com", password="secret123"),
    )
    print("Success!")
    print("ID:", user.id)
    print("Email:", user.email)
    print("Password hash:", user.password_hash)
finally:
    db.close()