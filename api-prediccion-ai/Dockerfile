FROM python:3.13-slim

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY servicio_ia/ servicio_ia/

# Los pesos se montan en ARTEFACTOS_DIR (ver docker-compose.yml); no van en la imagen.
ENV ARTEFACTOS_DIR=/app/artefactos \
    IA_DEVICE=cpu \
    PYTHONUNBUFFERED=1

RUN useradd --create-home --uid 1000 ia
USER ia

EXPOSE 8000

# La carga de los modelos y la verificacion de hashes toman unos segundos.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=4).status == 200 else 1)"

# Un solo worker: los modelos ocupan ~2 GB y las predicciones se atienden de a una.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
