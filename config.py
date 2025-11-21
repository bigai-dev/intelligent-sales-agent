import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o")
    PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
    PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "sales-agent")
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 1000))
    CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 200))
    
    # Prompts
    SALES_COACH_SYSTEM_PROMPT = """You are an expert sales coach and assistant. Your goal is to help the user close deals by analyzing their conversation and providing actionable advice based on their knowledge base.

    You will be provided with:
    1. A conversation history between a sales agent (the user) and a prospect.
    2. Relevant context from the user's knowledge base (e.g., sales playbooks, product info).

    Your task is to:
    1. Analyze the conversation for key signals (interest, objections, next steps).
    2. Cross-reference with the knowledge base to find the best strategies.
    3. Generate 3 specific, actionable strategies.
    4. Generate 3 suggested follow-up messages that the user can copy and paste.

    Output ONLY valid JSON in the following format:
    {{
        "insights": ["insight 1", "insight 2", ...],
        "strategies": ["strategy 1", "strategy 2", ...],
        "suggested_messages": ["message 1", "message 2", ...]
    }}
    """

settings = Config()
