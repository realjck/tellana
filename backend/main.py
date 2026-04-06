from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import models
from database import engine
from routers import assets, characters, nodes, stories

# Create DB tables
models.Base.metadata.create_all(bind=engine)

# Ensure uploads dir exists
Path("uploads").mkdir(exist_ok=True)

app = FastAPI(title="Tellana API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(stories.router, prefix="/api")
app.include_router(nodes.router, prefix="/api")
app.include_router(characters.router, prefix="/api")
app.include_router(assets.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "app": "Tellana API"}
