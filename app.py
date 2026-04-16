from flask import Flask, render_template, request, jsonify, session, redirect
import pickle
import sqlite3
import bcrypt
import os
import pandas as pd
import json
import logging

# OCR
from PIL import Image
import pytesseract
from pdf2image import convert_from_bytes

# AI
from openai import OpenAI

# FACE
from utils.face_register import capture_face
from utils.face_auth import recognize_face

# ---------------- CONFIG ----------------

app = Flask(__name__)
app.secret_key = "super_secret_key"

logging.basicConfig(level=logging.INFO)

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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

# ---------------- LOAD MODEL ----------------

try:
    model = pickle.load(open("model/diabetes_model.pkl", "rb"))
    scaler = pickle.load(open("model/scaler.pkl", "rb"))
    print("✅ Model loaded")
except Exception as e:
    model = None
    scaler = None
    print("❌ Model load error:", e)

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

        capture_face(email)

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

# ---------------- FACE LOGIN ----------------

@app.route('/face-login', methods=['POST'])
def face_login():
    data = request.get_json()
    email = data.get("email")

    if recognize_face(email):
        session['user'] = email
        return jsonify({"success": True})

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

# ---------------- UPLOAD REPORT ----------------

@app.route('/upload-report', methods=['POST'])
def upload_report():
    global last_report_data

    try:
        file = request.files['file']
        filename = file.filename.lower()

        text = ""

        # ---------- CSV ----------
        if filename.endswith('.csv'):
            df = pd.read_csv(file)

            first = df.iloc[0]

            data = {
                "pregnancies": int(first.get("Pregnancies", 0)),
                "glucose": float(first.get("Glucose", 0)),
                "blood_pressure": float(first.get("BloodPressure", 0)),
                "bmi": float(first.get("BMI", 0)),
                "age": int(first.get("Age", 0))
            }

            summary = {
                "avg_glucose": round(df["Glucose"].mean(), 2),
                "avg_bmi": round(df["BMI"].mean(), 2),
                "avg_bp": round(df["BloodPressure"].mean(), 2)
            }

            last_report_data = data

            return jsonify({
                "success": True,
                "data": data,
                "rows": df.to_dict(orient="records"),
                "summary": summary
            })

        # ---------- IMAGE ----------
        elif filename.endswith(('.png', '.jpg', '.jpeg')):
            image = Image.open(file.stream)
            text = pytesseract.image_to_string(image)

        # ---------- PDF ----------
        elif filename.endswith('.pdf'):
            pages = convert_from_bytes(file.read())
            for page in pages:
                text += pytesseract.image_to_string(page)

        # ---------- TXT ----------
        elif filename.endswith('.txt'):
            text = file.read().decode()

        else:
            return jsonify({"success": False, "message": "Unsupported file"})

        # ---------- AI EXTRACT ----------
        data = ai_extract(text)
        last_report_data = data

        return jsonify({"success": True, "data": data})

    except Exception as e:
        print("UPLOAD ERROR:", e)
        return jsonify({"success": False, "message": str(e)})

# ---------------- PREDICT ----------------

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        features = [
            data['pregnancies'],
            data['glucose'],
            data['blood_pressure'],
            data['bmi'],
            data['age']
        ]

        scaled = scaler.transform([features])
        proba = model.predict_proba(scaled)[0][1]

        if proba > 0.7:
            risk = "High"
        elif proba > 0.4:
            risk = "Medium"
        else:
            risk = "Low"

        return jsonify({
            "prediction": int(proba >= 0.5),
            "risk": risk,
            "score": round(float(proba), 3)
        })

    except Exception as e:
        print("PREDICT ERROR:", e)
        return jsonify({"success": False})

# ---------------- AI EXTRACT ----------------

def ai_extract(text):
    try:
        prompt = f"""
Extract ONLY JSON:
pregnancies, glucose, blood_pressure, bmi, age

TEXT:
{text}
"""

        res = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}]
        )

        content = res.choices[0].message.content

        return json.loads(content)

    except Exception as e:
        print("AI EXTRACT ERROR:", e)
        return {
            "pregnancies": 0,
            "glucose": 0,
            "blood_pressure": 0,
            "bmi": 0,
            "age": 0
        }

# ---------------- AI DOCTOR ----------------

@app.route('/ai-explain', methods=['POST'])
def ai_explain():
    try:
        data = request.json

        prompt = f"""
Patient Data:
Age: {data.get('age')}
BMI: {data.get('bmi')}
Glucose: {data.get('glucose')}
Blood Pressure: {data.get('blood_pressure')}

Explain health condition and give advice.
"""

        res = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}]
        )

        return jsonify({"text": res.choices[0].message.content})

    except:
        return jsonify({"text": "AI unavailable"})

# ---------------- CHAT ----------------

@app.route('/chat', methods=['POST'])
def chat():
    msg = request.json.get("message")

    try:
        res = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role":"system","content":"You are a helpful health assistant"},
                {"role":"user","content":msg}
            ]
        )

        return jsonify({"reply": res.choices[0].message.content})

    except:
        return jsonify({"reply": "Error"})

# ---------------- RUN ----------------

if __name__ == "__main__":
    app.run(debug=True)