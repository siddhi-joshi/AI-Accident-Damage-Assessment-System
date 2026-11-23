def analyze_vehicle_damage(image_paths: list[str]) -> dict:
    """Integration seam for a licensed and evaluated model. No prediction is invented."""
    return {
        "model_status": "not_configured",
        "message": "A trained vehicle-damage model has not been configured. An assessor must review the photos.",
        "model_version": None,
        "detections": [],
        "confidence": None,
        "requires_human_review": True,
        "images_considered": len(image_paths),
    }
