from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
import os
import shutil
from backend.utils.security import verify_token
from backend.utils.pdf_processor import PDFProcessor
from backend.utils.llm import GroqLLM
from backend.logger import get_logger

logger = get_logger("ReportRoutes")
router = APIRouter(prefix="/api/report", tags=["Medical Reports"])

pdf_processor = PDFProcessor()
llm = GroqLLM()

@router.post("/simplify")
async def simplify_report(
    file: UploadFile = File(...),
    user_email: str = Depends(verify_token)
):
    """Upload a medical report PDF and get a simplified explanation"""
    try:
        # Validate file
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
            
        # Temporarily save
        temp_path = os.path.join(pdf_processor.upload_dir, f"temp_{file.filename}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        logger.info(f"Extracting text from report: {file.filename}")
        
        # Extract direct text
        from PyPDF2 import PdfReader
        reader = PdfReader(temp_path)
        report_text = ""
        for page in reader.pages:
            report_text += page.extract_text() + "\n"
            
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        if not report_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract any text from the PDF")
            
        # Limit text size if too large for LLM context
        if len(report_text) > 15000:
            report_text = report_text[:15000] + "... [TRUNCATED]"
            
        # Prompt LLM
        prompt = f"""
You are an expert medical interpreter. I am providing you with the text of a patient's medical laboratory report.
Please analyze the text and explain the key findings in simple, easy-to-understand English for a patient.
Avoid complex medical jargon, or explain it simply if you must use it.

Format your response as a series of simple markdown bullet points showing:
- **Test Name**: [Name]
- **Value**: [Value in report]
- **Explanation**: [What this means simply, e.g., 'Slightly low level']
- **Suggestion**: [General health advice, e.g., 'Consider iron-rich foods']

Do not diagnose any life-threatening illnesses, just interpret the numbers.

MEDICAL REPORT TEXT:
{report_text}
"""
        messages = [{"role": "user", "content": prompt}]
        logger.info(f"Sending report text to LLM ({len(report_text)} chars)")
        
        explanation = llm.chat(messages)
        
        return {
            "message": "Report analyzed successfully",
            "filename": file.filename,
            "explanation": explanation
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Report simplification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
