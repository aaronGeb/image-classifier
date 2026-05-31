"""
Image Classification Microservice
FastAPI + TensorFlow MobileNetV2 (pre-trained on ImageNet)
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import (
    preprocess_input,
    decode_predictions,
)
from tensorflow.keras.preprocessing import image as keras_image
import numpy as np
from PIL import Image
import io
import time
import logging
from typing import List
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Image Classification API",
    description="Classify images using MobileNetV2 pre-trained on ImageNet",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model: MobileNetV2 | None = None


@app.on_event("startup")
async def load_model():
    global model
    logger.info("Loading MobileNetV2...")
    model = MobileNetV2(weights="imagenet")
    logger.info("Model ready.")


class Prediction(BaseModel):
    label: str
    class_id: str
    confidence: float


class ClassificationResult(BaseModel):
    predictions: List[Prediction]
    top_label: str
    top_confidence: float
    inference_ms: float
    image_size: List[int]


ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


def validate_upload(file: UploadFile) -> None:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type '{file.content_type}'. Use JPEG, PNG, or WebP.",
        )


def preprocess(img: Image.Image) -> np.ndarray:
    """Resize to 224×224, expand dims, and apply MobileNetV2 preprocessing."""
    img = img.convert("RGB").resize((224, 224))
    arr = keras_image.img_to_array(img)
    arr = np.expand_dims(arr, axis=0)
    return preprocess_input(arr)


@app.get("/health")
async def health():
    """Liveness check — returns model status."""
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/classify", response_model=ClassificationResult)
async def classify(file: UploadFile = File(...)):
    """
    Upload an image and receive the top-5 ImageNet predictions.

    - Accepts JPEG, PNG, WebP (max 10 MB)
    - Returns labels, confidence scores, and inference time
    """
    validate_upload(file)

    raw = await file.read()
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit.")

    try:
        img = Image.open(io.BytesIO(raw))
    except Exception:
        raise HTTPException(status_code=422, detail="Could not decode image.")

    width, height = img.size
    arr = preprocess(img)

    t0 = time.perf_counter()
    preds = model.predict(arr, verbose=0)
    inference_ms = (time.perf_counter() - t0) * 1000

    decoded = decode_predictions(preds, top=5)[0]

    predictions = [
        Prediction(class_id=cid, label=label.replace("_", " "), confidence=float(score))
        for cid, label, score in decoded
    ]

    return ClassificationResult(
        predictions=predictions,
        top_label=predictions[0].label,
        top_confidence=predictions[0].confidence,
        inference_ms=round(inference_ms, 2),
        image_size=[width, height],
    )


@app.get("/")
async def root():
    return {"message": "Image Classification API — visit /docs for Swagger UI"}
