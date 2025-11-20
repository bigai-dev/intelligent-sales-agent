import os
from typing import List
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from config import settings

class RAGEngine:
    def __init__(self, persist_directory: str = settings.CHROMA_PERSIST_DIRECTORY):
        self.persist_directory = persist_directory
        self.embeddings = OpenAIEmbeddings()
        self.vector_store = Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self.embeddings
        )

    def add_document(self, file_path: str) -> int:
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
        self.vector_store.add_documents(documents=splits)
        return len(splits)

    def search(self, query: str, k: int = 3) -> List[Document]:
        """Retrieves relevant documents."""
        return self.vector_store.similarity_search(query, k=k)

    def get_retriever(self):
        return self.vector_store.as_retriever()
