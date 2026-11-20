from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routes.quiz import router as quiz_router
from app.routes.assistant import router as assistant_router

settings=get_settings()
app=FastAPI(title=settings.app_name,description="Firebase-authenticated BitSecure adaptive quiz API",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=settings.allowed_origins,allow_credentials=True,
                   allow_methods=["GET","POST","OPTIONS"],allow_headers=["Authorization","Content-Type"])
app.include_router(quiz_router)
app.include_router(assistant_router)

@app.get("/")
async def root():
    return {"name":settings.app_name,"health":"/health","docs":"/docs"}

@app.get("/health")
async def health():
    return {"status":"ok","service":"bitsecure-fastapi"}
