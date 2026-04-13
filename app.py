from flask import Flask, render_template, request, jsonify, session, redirect
import pickle
import numpy as np
import logging
import sqlite3
import bcrypt

# FACE SYSTEM
from utils.face_register import capture_face
from utils.face_auth import recognize_face

app = Flask(__name__)
app.secret_key = "super_secret_key"

logging.basicConfig(level=logging.INFO)

# ------------------ DATABASE INIT ------------------

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

# ------------------ LOAD MODEL ------------------

try:
    model = pickle.load(open("model/disease_model.pkl", "rb"))
    logging.info("Model loaded successfully")
except Exception as e:
    model = None
    logging.warning(f"Model not loaded: {e}")

# ------------------ ROUTES ------------------

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
    return "Dashboard Loaded"

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

# ------------------ SIGNUP ------------------

@app.route('/signup-user', methods=['POST'])
def signup_user():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"success": False, "message": "Fill all fields"})

        conn = sqlite3.connect('users.db')
        c = conn.cursor()

        # CHECK USER FIRST
        c.execute("SELECT * FROM users WHERE email=?", (email,))
        if c.fetchone():
            conn.close()
            return jsonify({"success": False, "message": "User already exists"})

        # HASH PASSWORD
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # INSERT USER
        c.execute("INSERT INTO users (email, password) VALUES (?, ?)", (email, hashed))
        conn.commit()
        conn.close()

        # CAPTURE FACE AFTER SUCCESS
        capture_face(email)

        return jsonify({"success": True})

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"success": False, "message": "Server error"})

# ------------------ LOGIN ------------------

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

        stored_password = user[0]

        if bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8')):
            session['user'] = email
            return jsonify({"success": True})

        return jsonify({"success": False, "message": "Wrong password"})

    except Exception as e:
        logging.error(e)
        return jsonify({"success": False})

# ------------------ FACE LOGIN (REAL MATCH) ------------------

@app.route('/face-login', methods=['POST'])
def face_login():
    try:
        data = request.get_json()
        email = data.get("email")

        if not email:
            return jsonify({"success": False, "message": "Enter email"})

        result = recognize_face(email)

        if result:
            session['user'] = email
            return jsonify({"success": True})

        return jsonify({"success": False})

    except Exception as e:
        logging.error(e)
        return jsonify({"success": False})

# ------------------ ML PREDICTION ------------------

@app.route('/predict', methods=['POST'])
def predict():
    try:
        if model is None:
            return jsonify({"status": "error", "message": "Model not loaded"})

        data = request.get_json()
        features = np.array([list(map(float, data.values()))])

        prediction = model.predict(features)[0]

        return jsonify({"status": "success", "prediction": int(prediction)})

    except Exception as e:
        logging.error(e)
        return jsonify({"status": "error"})
    


@app.route('/google-login', methods=['POST'])
def google_login():
    data = request.get_json()
    email = data.get("email")

    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    c.execute("SELECT * FROM users WHERE email=?", (email,))
    user = c.fetchone()

    if not user:
        c.execute("INSERT INTO users (email, password) VALUES (?, ?)", (email, "google_user"))
        conn.commit()

    conn.close()

    session['user'] = email
    return jsonify({"success": True})

# ------------------ ERROR ------------------

@app.errorhandler(404)
def not_found(e):
    return render_template("index.html")

# ------------------ RUN ------------------

if __name__ == "__main__":
    app.run(debug=True)