"""User model for storing user information and authentication details."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
    Float,
    Integer,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Prediction(Base):
    """Prediction model for storing image classification results."""

    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    image_filename = Column(String(255), nullable=False)
    predicted_class = Column(String, nullable=False)
    confidence_score = Column(Float, nullable=False)
    top_predictions = Column(
        JSONB, nullable=False, default=list
    )  # Store top predictions as JSON
    processing_time_ms = Column(
        Integer, nullable=False
    )  # Time taken for prediction in milliseconds
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationship to User model.
    user = relationship("User", back_populates="predictions")
