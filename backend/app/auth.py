from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.firebase import verify_token
bearer = HTTPBearer(auto_error=False)

def require_user(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "A Firebase bearer token is required.")
    try: decoded = verify_token(credentials.credentials)
    except ValueError: raise HTTPException(401, "Invalid or expired Firebase ID token.")
    return {"uid": decoded["uid"]}
