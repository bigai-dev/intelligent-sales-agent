import os
from typing import List
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
from langchain_core.documents import Document
from config import settings

class RAGEngine:
    def __init__(self):
        self.embeddings = OpenAIEmbeddings()
        
        # Initialize Pinecone Client for stats
        self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        self.index = self.pc.Index(settings.PINECONE_INDEX_NAME)

        # Initialize Pinecone Vector Store
        # Note: The index must be created in Pinecone console beforehand
        self.vector_store = PineconeVectorStore(
            index_name=settings.PINECONE_INDEX_NAME,
            embedding=self.embeddings
        )

    def list_kbs(self) -> List[str]:
        """Returns a list of available Knowledge Bases (namespaces)."""
        try:
            stats = self.index.describe_index_stats()
            namespaces = list(stats.get('namespaces', {}).keys())
            return namespaces if namespaces else ["Sample"]
        except Exception as e:
            print(f"Error listing KBs: {e}")
            return ["Sample"]

    def add_document(self, file_path: str, namespace: str = "Sample") -> int:
        """
        Ingests a PDF or Text file into the vector store.
        Returns the number of chunks added.
        """
        if file_path.endswith(".pdf"):
            loader = PyPDFLoader(file_path)
            docs = loader.load()
        else:
            # Assume text file
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
            docs = [Document(page_content=text, metadata={"source": file_path})]

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE, 
            chunk_overlap=settings.CHUNK_OVERLAP
        )
        splits = text_splitter.split_documents(docs)
        self.vector_store.add_documents(documents=splits, namespace=namespace)
        return len(splits)

    def search(self, query: str, k: int = 3, namespace: str = "Sample") -> List[Document]:
        """Retrieves relevant documents."""
        return self.vector_store.similarity_search(query, k=k, namespace=namespace)

    def reset_index(self):
        """Deletes all vectors and re-uploads the sample KB."""
        try:
            # Delete all namespaces
            self.index.delete(delete_all=True)
            
            # Re-upload sample KB
            sample_path = "sample_knowledge_base.txt"
            if os.path.exists(sample_path):
                self.add_document(sample_path, namespace="Sample")
                return True
            return False
        except Exception as e:
            print(f"Error resetting index: {e}")
            raise e

    def get_retriever(self):
        return self.vector_store.as_retriever()
