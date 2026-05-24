from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import extract, merge_split, compress, hyperlink

app = FastAPI(title="PDF Editor API")

ALLOWED_ORIGINS = [
    "http://localhost:5173",           # local dev
    "https://pdf-editor-pi.vercel.app", # Vercel production (cập nhật sau khi deploy)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract.router, prefix="/api/extract", tags=["Extract"])
app.include_router(merge_split.router, prefix="/api/merge-split", tags=["Merge & Split"])
app.include_router(compress.router, prefix="/api/compress", tags=["Compress"])
app.include_router(hyperlink.router, prefix="/api/hyperlink", tags=["Hyperlink"])

@app.get("/")
def root():
    return {"message": "PDF Editor API is running"}