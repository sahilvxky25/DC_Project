"""BitSecure API.  Run:  uvicorn app.main:app --reload --port 8001"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, engine
from .routers import auth, progress, route, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)  # creates the users table on first start
    yield


app = FastAPI(title="BitSecure API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(progress.router)
app.include_router(route.router)


@app.get("/health")
def health():
    return {"status": "ok"}
