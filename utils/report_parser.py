import pdfplumber
import pytesseract
import cv2
import re

# 👉 SET YOUR TESSERACT PATH (change if needed)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def extract_text_from_pdf(path):
    text = ""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text


def extract_text_from_image(path):
    img = cv2.imread(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return pytesseract.image_to_string(gray)


def extract_health_data(text):
    data = {}

    def find(pattern):
        match = re.search(pattern, text, re.IGNORECASE)
        return float(match.group(1)) if match else None

    data['glucose'] = find(r'glucose[:\s]*([\d.]+)')
    data['bmi'] = find(r'bmi[:\s]*([\d.]+)')
    data['blood_pressure'] = find(r'blood\s*pressure[:\s]*([\d.]+)')
    data['age'] = find(r'age[:\s]*([\d.]+)')
    data['pregnancies'] = find(r'pregnancies[:\s]*([\d.]+)')

    return data