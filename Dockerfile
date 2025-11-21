FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create a writable directory for ChromaDB if it doesn't exist
# (Note: In read-only environments, this might still be an issue, 
# but for pre-baked KBs, we just need to read)
RUN chmod -R 777 chroma_db

# Expose port
EXPOSE 7860

# Start the application
# Hugging Face Spaces uses port 7860 by default
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
