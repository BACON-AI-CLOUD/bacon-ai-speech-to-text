"""
Document text extraction endpoint for BACON-AI Voice Backend.

Extracts plain text from PDF, DOCX, TXT, and MD files.
Used by the Text Editor tab in the frontend.
"""
import io
import logging
from typing import Any, Dict

from fastapi import APIRouter, File, HTTPException, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload")
async def extract_text_from_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Extract plain text from an uploaded document file.

    Supports:
    - .pdf: Extracts text from all pages using pypdf
    - .docx: Extracts text from all paragraphs using python-docx
    - .txt / .md: Decodes as UTF-8

    Returns the extracted text, filename, and character count.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".pdf"):
            import pypdf  # type: ignore
            reader = pypdf.PdfReader(io.BytesIO(contents))
            pages = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    pages.append(page_text)
            text = "\n\n".join(pages)

        elif filename.endswith(".docx"):
            import docx  # type: ignore
            doc = docx.Document(io.BytesIO(contents))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            text = "\n".join(paragraphs)

        elif filename.endswith((".txt", ".md")):
            text = contents.decode("utf-8", errors="replace")

        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Supported: .pdf, .docx, .txt, .md",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Text extraction failed for %s: %s", file.filename, e)
        raise HTTPException(
            status_code=422, detail=f"Failed to extract text from file: {e}"
        ) from e

    return {
        "text": text,
        "filename": file.filename,
        "char_count": len(text),
    }
