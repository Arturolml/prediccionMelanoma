import os
import sys
import shutil
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse

# Add the parent directory to sys.path so we can import interpretabilidad.py
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PARENT_DIR)

from interpretabilidad import SkinCancerInferenceService

app = FastAPI(
    title="Melanoma IA API",
    description="API de explicabilidad e inferencia para detección de melanoma",
    version="1.0.0"
)

# Global variables
inference_service = None
MODEL_FILENAME = "mejor_modelo_bi_resnet50.keras"

@app.on_event("startup")
async def startup_event():
    global inference_service
    # The model should be in the parent directory where interpretabilidad.py is
    model_path = os.path.join(PARENT_DIR, MODEL_FILENAME)
    
    try:
        print(f"Iniciando carga del modelo de IA desde: {model_path}...")
        inference_service = SkinCancerInferenceService(model_path=model_path)
        print("Modelo de IA cargado exitosamente en memoria.")
    except Exception as e:
        print(f"Error cargando el modelo: {e}")
        inference_service = None


@app.post("/api/v1/predict")
async def predict_melanoma(image: UploadFile = File(...)):
    if not inference_service:
        return JSONResponse(status_code=500, content={"error": "Servicio IA no disponible (modelo no cargado)"})
        
    # Ensure a local results directory exists for artifacts
    results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resultados")
    os.makedirs(results_dir, exist_ok=True)
    
    # Save uploaded image temporarily
    temp_image_path = os.path.join(results_dir, f"tmp_{image.filename}")
    with open(temp_image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
        
    try:
        # Define output prefix for generated AI images (heatmaps, etc.)
        filename_without_ext = os.path.splitext(image.filename)[0]
        out_prefix = os.path.join(results_dir, filename_without_ext)
        
        # Inference & Explainability
        result = inference_service.infer_and_explain(
            image_path=temp_image_path,
            run_visual_xai=True,
            run_morphology=True,
            save_artifacts_prefix=out_prefix
        )
        
        return result
        
    except Exception as e:
         return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        # Clean up temporary original image
        if os.path.exists(temp_image_path):
            os.remove(temp_image_path)
