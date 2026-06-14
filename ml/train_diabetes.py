import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import pickle

# Load dataset
df = pd.read_csv("data/diabetes.csv")

# Features and target
X = df[['age', 'hypertension', 'bmi', 'HbA1c_level', 'blood_glucose_level']]
y = df['diabetes']

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42
)

# Train model
model = RandomForestClassifier(
    n_estimators=200,
    random_state=42
)

model.fit(X_train, y_train)

# Predict on test data
y_pred = model.predict(X_test)

# Calculate accuracy
accuracy = accuracy_score(y_test, y_pred)

# Save model
pickle.dump(model, open("model/diabetes.pkl", "wb"))

print("✅ Diabetes model trained")
print(f"🎯 Accuracy: {accuracy * 100:.2f}%")