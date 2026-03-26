import os
from typing import List, Dict
from PyPDF2 import PdfReader
from backend.logger import get_logger

logger = get_logger("PDFProcessor")

class PDFProcessor:
    def __init__(self, upload_dir: str = "backend/documents"):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extract all text from a PDF file
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Extracted text as a string
        """
        try:
            logger.info(f"Extracting text from: {pdf_path}")
            reader = PdfReader(pdf_path)
            
            text = ""
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                text += f"\n--- Page {page_num + 1} ---\n{page_text}"
            
            logger.info(f"Extracted {len(text)} characters from PDF")
            return text
            
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            raise Exception(f"Failed to extract text from PDF: {str(e)}")
    
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """
        Split text into chunks with overlap
        
        Args:
            text: Input text to chunk
            chunk_size: Size of each chunk in characters
            overlap: Overlap between chunks
            
        Returns:
            List of text chunks
        """
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = start + chunk_size
            chunk = text[start:end]
            
            # Try to break at sentence or word boundary
            if end < text_length:
                # Look for sentence end
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                
                if break_point > chunk_size * 0.5:  # Only break if we're past halfway
                    chunk = chunk[:break_point + 1]
                    end = start + break_point + 1
            
            chunks.append(chunk.strip())
            start = end - overlap
        
        logger.info(f"Created {len(chunks)} chunks from text")
        return chunks
    
    def process_pdf(self, pdf_path: str, chunk_size: int = 500) -> List[Dict[str, str]]:
        """
        Process a PDF into chunks with metadata (including specific page numbers)
        
        Args:
            pdf_path: Path to PDF file
            chunk_size: Size of text chunks
            
        Returns:
            List of dictionaries containing chunks and metadata
        """
        try:
            logger.info(f"Processing PDF for chunks: {pdf_path}")
            reader = PdfReader(pdf_path)
            filename = os.path.basename(pdf_path)
            
            processed_chunks = []
            chunk_idx = 0
            
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if not page_text or not page_text.strip():
                    continue
                    
                # Chunk this specific page's text
                chunks = self.chunk_text(page_text, chunk_size)
                
                for chunk in chunks:
                    processed_chunks.append({
                        "text": chunk,
                        "source": filename,
                        "page_number": page_num + 1,
                        "chunk_id": chunk_idx
                    })
                    chunk_idx += 1
            
            # Update total chunks across all dicts
            total = len(processed_chunks)
            for p in processed_chunks:
                p["total_chunks"] = total
                
            logger.info(f"Created {total} chunks with page metadata for {filename}")
            return processed_chunks
            
        except Exception as e:
            logger.error(f"PDF processing error: {e}")
            raise Exception(f"Failed to process PDF chunks: {str(e)}")