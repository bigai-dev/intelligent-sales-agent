from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import os
import shutil
import tempfile
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from rag_engine import RAGEngine
from config import settings
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Allow CORS for Chrome Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = RAGEngine()
llm = ChatOpenAI(model=settings.MODEL_NAME)

prompt = ChatPromptTemplate.from_messages([
    ("system", settings.SALES_COACH_SYSTEM_PROMPT),
    ("human", """Context from Knowledge Base:
    {context}

    Conversation History:
    {conversation}
    """)
])

class AnalysisRequest(BaseModel):
    text: str = Field(..., min_length=10, description="The conversation text to analyze")
    kb_name: Optional[str] = "default"

@app.get("/")
def read_root():
    return {"status": "Sales Agent Backend Running"}

@app.post("/analyze")
def analyze_conversation(request: AnalysisRequest):
    try:
        logger.info(f"Analyzing conversation (length: {len(request.text)} chars)")
        
        # 1. Retrieve relevant context from KB
        docs = rag.search(request.text, namespace=request.kb_name)
        context = "\n\n".join([doc.page_content for doc in docs])
        
        # Get sources to show user which KB is being used
        sources = list(set([doc.metadata.get("source", "Unknown") for doc in docs]))
        logger.info(f"Retrieved {len(docs)} documents from sources: {sources}")
        
        chain = prompt | llm | JsonOutputParser()
        result = chain.invoke({"context": context, "conversation": request.text})
        
        # Add sources to the result
        result["kb_sources"] = sources
        
        logger.info("Analysis completed successfully")
        return result
    except Exception as e:
        logger.error("Analysis failed", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/upload-kb")
async def upload_knowledge_base(file: UploadFile = File(...), kb_name: str = Form("default")):
    logger.info(f"Received file upload: {file.filename} for KB: {kb_name}")
    # Create a temporary file to store the upload
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    
    try:
        num_chunks = rag.add_document(tmp_path, namespace=kb_name)
        logger.info(f"Successfully added {num_chunks} chunks from {file.filename} to {kb_name}")
        return {"status": "success", "chunks_added": num_chunks, "kb_name": kb_name}
    except Exception as e:
        logger.error(f"Upload failed for {file.filename}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    finally:
        # Clean up the temporary file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.get("/knowledge-bases")
def get_kbs():
    """Returns a list of available Knowledge Bases."""
    return {"kbs": rag.list_kbs()}

