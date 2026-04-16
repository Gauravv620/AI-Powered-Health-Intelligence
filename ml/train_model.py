import pandas as pd
import pickle
import os

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

# CREATE MODEL FOLDER
os.makedirs("model", exist_ok=True)

# LOAD DATA
df = pd.read_csv("ml/diabetes.csv")

# 🔥 SELECT CORRECT FEATURES
X = df[['Pregnancies', 'Glucose', 'BloodPressure', 'BMI', 'Age']]
y = df['Outcome']

# SPLIT (optional but better)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# SCALE
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)

# TRAIN
model = LogisticRegression()
model.fit(X_train_scaled, y_train)

# SAVE
pickle.dump(model, open("model/diabetes_model.pkl", "wb"))
pickle.dump(scaler, open("model/scaler.pkl", "wb"))

print("Model trained & saved successfully")