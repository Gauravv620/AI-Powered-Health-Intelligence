from flask import Flask, render_template, request, jsonify, session, redirect
import pickle
import sqlite3
import bcrypt
import os
import pandas as pd
import json
import logging
import pickle
import socket

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def parse_bp_systolic(bp_val):
    if not bp_val:
        return 0.0
    if isinstance(bp_val, str):
        if "/" in bp_val:
            try:
                return float(bp_val.split("/")[0])
            except ValueError:
                return 0.0
    try:
        return float(bp_val)
    except ValueError:
        return 0.0

from google import genai
import sys

# OCR
from PIL import Image
import pytesseract
from pdf2image import convert_from_bytes

# ---------------- CONFIG ----------------

app = Flask(__name__)
app.secret_key = "super_secret_key"

logging.basicConfig(level=logging.INFO)

# Set Tesseract OCR path dynamically based on OS
if sys.platform.startswith('win'):
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Initialize Gemini Client safely
try:
    # Client will automatically load GEMINI_API_KEY from environment
    client = genai.Client()
except Exception as e:
    logging.warning(f"Could not initialize Gemini Client: {e}")
    client = None




UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

last_report_data = {}

# ---------------- DATABASE ----------------

def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT
    )
    ''')

    conn.commit()
    conn.close()

init_db()


# ---------------- ROUTES ----------------

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/signup')
def signup():
    return render_template('signup.html')

@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect('/login')
    return render_template('dashboard.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

# ---------------- SIGNUP ----------------

@app.route('/signup-user', methods=['POST'])
def signup_user():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        conn = sqlite3.connect('users.db')
        c = conn.cursor()

        c.execute("SELECT * FROM users WHERE email=?", (email,))
        if c.fetchone():
            return jsonify({"success": False, "message": "User exists"})

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

        c.execute("INSERT INTO users VALUES (NULL, ?, ?)", (email, hashed))
        conn.commit()
        conn.close()

    
        return jsonify({"success": True})

    except Exception as e:
        print("SIGNUP ERROR:", e)
        return jsonify({"success": False})

# ---------------- LOGIN ----------------

@app.route('/login-user', methods=['POST'])
def login_user():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        conn = sqlite3.connect('users.db')
        c = conn.cursor()

        c.execute("SELECT password FROM users WHERE email=?", (email,))
        user = c.fetchone()
        conn.close()

        if not user:
            return jsonify({"success": False, "message": "User not found"})

        if bcrypt.checkpw(password.encode(), user[0].encode()):
            session['user'] = email
            return jsonify({"success": True})

        return jsonify({"success": False, "message": "Wrong password"})

    except Exception as e:
        print("LOGIN ERROR:", e)
        return jsonify({"success": False})



# ---------------- GOOGLE LOGIN ----------------

@app.route('/google-login', methods=['POST'])
def google_login():
    email = request.json.get("email")

    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    c.execute("SELECT * FROM users WHERE email=?", (email,))
    if not c.fetchone():
        c.execute("INSERT INTO users VALUES (NULL, ?, ?)", (email, "google"))

    conn.commit()
    conn.close()

    session['user'] = email
    return jsonify({"success": True})


# ---------------- CHECK AUTH ----------------

@app.route('/check-auth')
def check_auth():
    if 'user' in session:
        return jsonify({"logged_in": True, "user": session['user']})
    return jsonify({"logged_in": False}), 401


diabetes_model = pickle.load(open("model/diabetes.pkl","rb"))
heart_model = pickle.load(open("model/heart.pkl","rb"))
# BP LOGIC (GLOBAL)
def bp_risk_score(bp, age, bmi):
    score = 0

    # Blood Pressure contribution
    if bp < 120:
        score += 0
    elif bp < 130:
        score += 10
    elif bp < 140:
        score += 25
    else:
        score += 40

    # Age contribution
    if age > 45:
        score += 10
    if age > 60:
        score += 10

    # BMI contribution
    if bmi > 25:
        score += 10
    if bmi > 30:
        score += 10

    return min(score, 100)

def health_score(diabetes, heart, bp_score):
    score = 100

    if diabetes == 1:
        score -= 30

    if heart == 1:
        score -= 30

    # BP contribution (scaled)
    score -= int(bp_score * 0.3)

    return max(score, 0)


# dashboard route
@app.route('/multi-predict', methods=['POST'])
def multi_predict():

    data = request.json

    import pandas as pd

    # DIABETES
    d_input = pd.DataFrame([{
    "age": data.get('age', 0),
    "hypertension": data.get('hypertension', 0),
    "bmi": data.get('bmi', 0),

    # 🔥 MATCH TRAINING NAMES EXACTLY
    "HbA1c_level": data.get('hba1c', 0),
    "blood_glucose_level": data.get('glucose', 0)
}])

    diabetes = diabetes_model.predict(d_input)[0]

    # HEART
    h_input = pd.DataFrame([{
    "Age": data.get('age', 0),
    "RestingBP": data.get('bp', 0),
    "Cholesterol": data.get('cholesterol', 0),
    "MaxHR": data.get('maxhr', 0)
}])

    heart = heart_model.predict(h_input)[0]

    # BP SCORE
    bp_score = bp_risk_score(
        data.get('bp', 0),
        data.get('age', 0),
        data.get('bmi', 0)
    )

    # FINAL HEALTH SCORE
    final_score = health_score(diabetes, heart, bp_score)

    return jsonify({
        "diabetes": int(diabetes),
        "heart": int(heart),
        "bp_score": int(bp_score),
        "health_score": int(final_score)
    })



@app.route('/upload-report', methods=['POST'])
def upload_report():

    file = request.files['file']
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    extracted = {}
    records = []

    # ---------- CSV ----------
    if file.filename.endswith('.csv'):
        df = pd.read_csv(filepath)

        # 🔥 normalize column names
        df.columns = df.columns.str.lower().str.replace(" ", "").str.replace("_", "")

        def find_value(row, keywords):
            for col in row.keys():
                for key in keywords:
                    if key in col:
                        val = row[col]
                        try:
                            if isinstance(val, str) and "/" in val:
                                return float(val.split("/")[0])
                            return float(val)
                        except:
                            return 0
            return 0

        # 🔥 extract first row (for auto-fill UI)
        row = df.iloc[0]

        extracted = {
            "age": find_value(row, ["age"]),
            "bmi": find_value(row, ["bmi"]),
            "glucose": find_value(row, ["glucose"]),
            "hba1c": find_value(row, ["hba1c", "hb"]),
            "bp": find_value(row, ["bp", "pressure"]),
            "cholesterol": find_value(row, ["cholesterol"]),
            "maxhr": find_value(row, ["maxhr", "heartrate"]),
            "hypertension": find_value(row, ["hypertension"])
        }

        # 🔥 STEP 1: convert full dataset
        records = df.to_dict(orient="records")

    return jsonify({
        "first": extracted,   # for input autofill
        "data": records       # 🔥 for chart
    })
    return data




import time

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_msg = data.get("message")

        time.sleep(2)  # avoid rate spam

        if not client:
            return jsonify({"reply": "Gemini AI API key is not configured on the server."})

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=user_msg
        )

        return jsonify({"reply": response.text})

    except Exception as e:
        print("Chat Error:", e)
        return jsonify({"reply": "AI busy, try again in few seconds"})
    



from flask import send_from_directory


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)
from reportlab.platypus import PageBreak

from datetime import datetime
import os
from reportlab.platypus import ListFlowable, ListItem
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def get_parameter_status(name, val):
    try:
        if name == "BP":
            v = parse_bp_systolic(val)
        else:
            v = float(val)
    except (TypeError, ValueError):
        return "Normal", "#10b981"
        
    if name == "Age":
        return "Normal", "#10b981"
    elif name == "BMI":
        if v < 18.5:
            return "Underweight", "#f59e0b"
        elif v <= 24.9:
            return "Normal", "#10b981"
        elif v <= 29.9:
            return "Overweight", "#f59e0b"
        else:
            return "Obese (High)", "#ef4444"
    elif name == "Glucose":
        if v <= 100:
            return "Normal", "#10b981"
        elif v <= 125:
            return "Elevated", "#f59e0b"
        else:
            return "High", "#ef4444"
    elif name == "HbA1c":
        if v < 5.7:
            return "Normal", "#10b981"
        elif v <= 6.4:
            return "Elevated", "#f59e0b"
        else:
            return "High", "#ef4444"
    elif name == "BP":
        if v < 120:
            return "Normal", "#10b981"
        elif v <= 129:
            return "Elevated", "#f59e0b"
        else:
            return "High", "#ef4444"
    elif name == "Cholesterol":
        if v < 200:
            return "Normal", "#10b981"
        elif v <= 239:
            return "Borderline", "#f59e0b"
        else:
            return "High", "#ef4444"
    elif name == "Max HR":
        return "Normal", "#10b981"
        
    return "Normal", "#10b981"

def get_ref_range(name):
    if name == "Age":
        return "N/A"
    elif name == "BMI":
        return "18.5 - 24.9 kg/m²"
    elif name == "Glucose":
        return "70 - 100 mg/dL"
    elif name == "HbA1c":
        return "< 5.7 %"
    elif name == "BP":
        return "< 120/80 mmHg"
    elif name == "Cholesterol":
        return "< 200 mg/dL"
    elif name == "Max HR":
        return "60 - 100 bpm"
    return "N/A"

def create_card_badge(title, value, color_hex, styles):
    card_title_style = ParagraphStyle(
        'CardTitle',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold',
        textColor=colors.white,
        alignment=1 # Center
    )
    card_value_style = ParagraphStyle(
        'CardValue',
        parent=styles['Normal'],
        fontSize=11,
        leading=13,
        fontName='Helvetica-Bold',
        textColor=colors.white,
        alignment=1 # Center
    )
    
    badge_data = [
        [Paragraph(title, card_title_style)],
        [Paragraph(value, card_value_style)]
    ]
    t = Table(badge_data, colWidths=[110])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(color_hex)),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    return t

@app.route('/download-report', methods=['POST'])
def download_report():

    data = request.json or {}

    filename = f"health_report_{datetime.now().strftime('%H%M%S')}.pdf"
    file_path = os.path.join(UPLOAD_FOLDER, filename)

    # Standard Letter Size (612 x 792) with 54 margins (0.75 in)
    doc = SimpleDocTemplate(
        file_path,
        pagesize=(612, 792),
        leftMargin=54,
        rightMargin=54,
        topMargin=70,
        bottomMargin=70
    )
    styles = getSampleStyleSheet()
    content = []

    # ================= HEADER & FOOTER =================
    def header_footer(canvas, doc):
        canvas.saveState()

        primary_color = colors.HexColor('#0f172a')
        accent_color = colors.HexColor('#0ea5e9')

        # Header background bar
        canvas.setFillColor(primary_color)
        canvas.rect(0, 742, 612, 50, fill=1, stroke=0)

        # Sky blue accent line below header bar
        canvas.setFillColor(accent_color)
        canvas.rect(0, 738, 612, 4, fill=1, stroke=0)

        # Header Text
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawString(54, 760, "HEALTHAI CLINICAL DIAGNOSTIC PORTAL")

        canvas.setFont("Helvetica-Oblique", 8)
        canvas.drawRightString(558, 762, "Automated Digital Patient Record")

        # Footer Accent Line
        canvas.setFillColor(colors.HexColor('#e2e8f0'))
        canvas.rect(0, 52, 612, 1, fill=1, stroke=0)

        # Footer Text
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor('#64748b'))
        canvas.drawString(54, 38, "Confidential Medical Report - screening purposes only. Contact physician for diagnosis.")
        canvas.drawRightString(558, 38, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        
        # Draw page number
        canvas.drawRightString(558, 24, f"Page {doc.page}")

        canvas.restoreState()

    # Create custom Paragraph styles
    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#334155')
    )
    cell_style_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0f172a')
    )
    cell_style_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        fontName='Helvetica-Bold',
        textColor=colors.white
    )
    report_title_style = ParagraphStyle(
        'ReportHeading',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=12,
        keepWithNext=True
    )
    section_title_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )
    list_item_style = ParagraphStyle(
        'ListItemStyle',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        leftIndent=15,
        firstLineIndent=-10
    )

    # ================= PAGE 1 =================
    patient_id = f"PID-{datetime.now().strftime('%H%M%S')}"
    report_date = datetime.now().strftime("%d %B %Y")

    content.append(Spacer(1, 15))
    content.append(Paragraph("<b>Patient Diagnostic Summary</b>", report_title_style))

    # Patient Information Grid
    patient_info_data = [
        [Paragraph("<b>Patient ID:</b>", cell_style), Paragraph(patient_id, cell_style),
         Paragraph("<b>Date:</b>", cell_style), Paragraph(report_date, cell_style)],
        [Paragraph("<b>Referral:</b>", cell_style), Paragraph("HealthAI Automated Risk Check", cell_style),
         Paragraph("<b>Report Type:</b>", cell_style), Paragraph("Digital Vitals Summary", cell_style)]
    ]
    patient_info_table = Table(patient_info_data, colWidths=[90, 160, 90, 160])
    patient_info_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    content.append(patient_info_table)
    content.append(Spacer(1, 15))

    # Parameters Table
    content.append(Paragraph("<b>Laboratory & Vital Parameters</b>", section_title_style))
    
    raw_table_data = [
        ("Age", data.get('age')),
        ("BMI", data.get('bmi')),
        ("Glucose", data.get('glucose')),
        ("HbA1c", data.get('hba1c')),
        ("BP", data.get('bp')),
        ("Cholesterol", data.get('cholesterol')),
        ("Max HR", data.get('maxhr')),
    ]

    table_data = [
        [
            Paragraph("Parameter", cell_style_header),
            Paragraph("Observed Value", cell_style_header),
            Paragraph("Reference Range", cell_style_header),
            Paragraph("Clinical Status", cell_style_header)
        ]
    ]
    
    for name, val in raw_table_data:
        ref_range = get_ref_range(name)
        status, color = get_parameter_status(name, val)
        table_data.append([
            Paragraph(name, cell_style_bold),
            Paragraph(str(val) if val is not None else "--", cell_style),
            Paragraph(ref_range, cell_style),
            Paragraph(f'<font color="{color}"><b>{status.upper()}</b></font>', cell_style)
        ])

    table = Table(table_data, colWidths=[130, 110, 130, 130])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0,3), (-1,3), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0,5), (-1,5), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0,7), (-1,7), colors.HexColor('#f8fafc')),
    ]))
    content.append(table)
    content.append(Spacer(1, 15))

    # RISK BADGES
    content.append(Paragraph("<b>Cardiovascular & Metabolic Risk Assessment</b>", section_title_style))

    diabetes_text = str(data.get('diabetes', 'Normal'))
    diabetes_color = '#ef4444' if 'High' in diabetes_text else '#10b981'
    
    heart_text = str(data.get('heart', 'Normal'))
    heart_color = '#ef4444' if 'High' in heart_text else '#10b981'
    
    bp_text = str(data.get('bpRisk', '0'))
    try:
        bp_val = int(''.join(filter(str.isdigit, bp_text)))
    except:
        bp_val = 0
    bp_color = '#ef4444' if bp_val > 40 else ('#f59e0b' if bp_val > 25 else '#10b981')
    
    health_text = str(data.get('healthScore', '100'))
    if '/' in health_text:
        health_text = health_text.split('/')[0]
    try:
        health_val = int(''.join(filter(str.isdigit, health_text)))
    except:
        health_val = 100
    health_color = '#10b981' if health_val >= 80 else ('#f59e0b' if health_val >= 50 else '#ef4444')
    
    b1 = create_card_badge("Diabetes Risk", diabetes_text.upper(), diabetes_color, styles)
    b2 = create_card_badge("Heart Risk", heart_text.upper(), heart_color, styles)
    b3 = create_card_badge("BP Risk Score", f"{bp_val} / 100", bp_color, styles)
    b4 = create_card_badge("Health Score", f"{health_val} / 100", health_color, styles)
    
    badges_table = Table([[b1, b2, b3, b4]], colWidths=[126, 126, 126, 126])
    badges_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    content.append(badges_table)

    content.append(PageBreak())

    # ================= PAGE 2 =================
    content.append(Spacer(1, 15))
    content.append(Paragraph("<b>Risk Profiling & Analytics</b>", report_title_style))

    # CHART
    chart_path = os.path.join(UPLOAD_FOLDER, "chart.png")

    try:
        values = [
            100 if "High" in str(data.get('diabetes')) else 0,
            100 if "High" in str(data.get('heart')) else 0,
            bp_val
        ]
        labels = ["Diabetes", "Heart", "BP"]

        fig, ax = plt.subplots(figsize=(5.5, 3.2), facecolor='#ffffff')
        ax.set_facecolor('#ffffff')
        
        bars = ax.bar(labels, values, color=['#ef4444', '#f59e0b', '#0ea5e9'], width=0.45, edgecolor='none')
        
        for bar in bars:
            height = bar.get_height()
            ax.annotate(f'{height}%',
                        xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 3),
                        textcoords="offset points",
                        ha='center', va='bottom', fontsize=8, color='#1e293b', weight='bold')

        ax.set_title("Relative Risk Profile (%)", fontsize=10, pad=12, weight='bold', color='#0f172a')
        ax.set_ylim(0, 115)
        
        ax.grid(axis='y', linestyle='--', alpha=0.3, color='#94a3b8')
        ax.set_axisbelow(True)
        
        for spine in ['top', 'right', 'left']:
            ax.spines[spine].set_visible(False)
        ax.spines['bottom'].set_color('#cbd5e1')
        ax.spines['bottom'].set_linewidth(1.0)
        
        ax.tick_params(axis='x', colors='#0f172a', labelsize=9)
        ax.tick_params(axis='y', left=False, labelleft=True, colors='#64748b', labelsize=8)
        
        plt.tight_layout()
        plt.savefig(chart_path, dpi=250)
        plt.close()

        content.append(Image(chart_path, width=4.8*inch, height=2.8*inch))

    except Exception as e:
        print("Chart error:", e)

    content.append(Spacer(1, 15))

    # ================= AI EXPLANATION =================
    content.append(Paragraph("<b>AI Medical Explanation & Clinical Insights</b>", section_title_style))

    risk_text = "High Risk Profile" if "High" in str(data.get('diabetes')) or "High" in str(data.get('heart')) else "Moderate Risk Profile"
    content.append(Paragraph(f"<b>Overall Risk Classification:</b> {risk_text}", cell_style_bold))
    content.append(Spacer(1, 6))

    # Key Factors
    content.append(Paragraph("<b>Primary Risk Factors Detected:</b>", cell_style_bold))

    key_factors = []

    if float(data.get("glucose", 0)) > 150:
        key_factors.append("Elevated blood glucose levels exceeding metabolic limits.")

    if "High" in str(data.get("heart")):
        key_factors.append("Positive risk indicator from heart disease classification model.")

    if parse_bp_systolic(data.get("bp", 0)) > 140:
        key_factors.append("Systolic Blood pressure is elevated. Risk of hypertension.")

    if not key_factors:
        key_factors.append("No critical risk factor indices crossed safety reference marks.")

    for factor in key_factors:
        content.append(Paragraph(f"&bull; {factor}", list_item_style))
    content.append(Spacer(1, 10))

    # Recommendations
    content.append(Paragraph("<b>Evidence-Based Recommendations:</b>", cell_style_bold))

    recommendations = []

    if float(data.get("glucose", 0)) > 150:
        recommendations.append("Reduce processed sugar and carbohydrate intake. Monitor glycemic index.")

    if "High" in str(data.get("heart")):
        recommendations.append("Limit saturated and trans fats. Incorporate light aerobic cardio daily.")

    if parse_bp_systolic(data.get("bp", 0)) > 140:
        recommendations.append("Implement low-sodium diet and stress mitigation techniques (mindfulness/exercise).")

    if float(data.get("bmi", 0)) > 25:
        recommendations.append("Active caloric management, exercise routines, and dietary fiber enhancement.")

    if not recommendations:
        recommendations.append("Continue standard wellness guidelines, hydration, and regular exercise.")

    for recommendation in recommendations:
        content.append(Paragraph(f"&bull; {recommendation}", list_item_style))

    content.append(PageBreak())

    # ================= PAGE 3 =================
    content.append(Spacer(1, 15))
    content.append(Paragraph("<b>Clinical Review & Attestation</b>", report_title_style))
    content.append(Spacer(1, 15))

    review_style = ParagraphStyle(
        'ReviewStyle',
        parent=styles['Normal'],
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#334155')
    )
    
    review_data = [
        [
            Paragraph("<b>Practitioner Name:</b><br/>___________________________", review_style),
            Paragraph("<b>Verification Signature:</b><br/>___________________________", review_style),
            Paragraph("<b>Verification Date:</b><br/>___________________________", review_style)
        ]
    ]
    review_table = Table(review_data, colWidths=[160, 170, 170])
    review_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    content.append(review_table)
    content.append(Spacer(1, 50))

    disclaimer_text = Paragraph(
        "<i>Disclaimer: This document is dynamically compiled by the HealthAI diagnostics simulator. "
        "The analysis is derived from predictive machine learning models and does not substitute a "
        "professional medical diagnosis. Consult a qualified, board-certified physician for clinical evaluation.</i>",
        styles['Italic']
    )

    # QR CODE
    local_ip = get_local_ip()
    qr_data = f"http://{local_ip}:{5000}/uploads/{filename}"
    qr_code = qr.QrCodeWidget(qr_data)
    qr_code.barWidth = 1.2
    qr_code.barHeight = 1.2

    d = Drawing(80, 80)
    d.add(qr_code)

    footer_table = Table([[disclaimer_text, Table([[Paragraph("<b>Verify Online:</b>", cell_style_bold)], [d]], colWidths=[120])]], colWidths=[360, 140])
    footer_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    
    content.append(footer_table)

    # ================= BUILD =================
    doc.build(content, onFirstPage=header_footer, onLaterPages=header_footer)

    return jsonify({
        "file": f"/uploads/{filename}",
        "qr_url": qr_data
    })
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

