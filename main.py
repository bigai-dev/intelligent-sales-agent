from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import shutil
import tempfile
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from rag_engine import RAGEngine
from config import settings

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

@app.get("/")
def read_root():
    return {"status": "Sales Agent Backend Running"}

@app.post("/analyze")
def analyze_conversation(request: AnalysisRequest):
    try:
        # 1. Retrieve relevant context from KB
        docs = rag.search(request.text)
        context = "\n\n".join([doc.page_content for doc in docs])
        
        # Get sources to show user which KB is being used
        sources = list(set([doc.metadata.get("source", "Unknown") for doc in docs]))
        
        chain = prompt | llm | JsonOutputParser()
        result = chain.invoke({"context": context, "conversation": request.text})
        
        # Add sources to the result
        result["kb_sources"] = sources
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/upload-kb")
async def upload_knowledge_base(file: UploadFile = File(...)):
    # Create a temporary file to store the upload
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    
    try:
        num_chunks = rag.add_document(tmp_path)
        return {"status": "success", "chunks_added": num_chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    finally:
        # Clean up the temporary file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

