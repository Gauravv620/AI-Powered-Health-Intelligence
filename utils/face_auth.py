import cv2
import os
import numpy as np
import time

def recognize_face(email):
    path = f"dataset/faces/{email}.jpg"

    if not os.path.exists(path):
        return False

    known_face = cv2.imread(path, cv2.IMREAD_GRAYSCALE)

    model = cv2.face.LBPHFaceRecognizer_create()
    model.train([known_face], np.array([1]))

    cam = cv2.VideoCapture(0)

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )

    start_time = time.time()

    while True:
        ret, frame = cam.read()
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        for (x, y, w, h) in faces:
            face = gray[y:y+h, x:x+w]

            label, confidence = model.predict(face)

            print("Confidence:", confidence)

            # GOOD MATCH
            if confidence < 60:
                cam.release()
                return True

        # ⏱️ STOP after 5 seconds
        if time.time() - start_time > 5:
            cam.release()
            return False