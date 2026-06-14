import pandas as pd
import pickle

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Load dataset
df = pd.read_csv("data/heart.csv")

print("Dataset Shape:", df.shape)
print("\nColumns:")
print(df.columns.tolist())

# Target column
y = df["HeartDisease"]

# Features (use only features present in dashboard input)
X = df[['Age', 'RestingBP', 'Cholesterol', 'MaxHR']]

# Convert target to integer
y = pd.to_numeric(y, errors="coerce")
y = y.fillna(0)
y = y.astype(int)

print("\nTarget Distribution:")
print(y.value_counts())

# Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

# Random Forest Model
model = RandomForestClassifier(
    n_estimators=500,
    max_depth=15,
    min_samples_split=5,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)

# Train
model.fit(X_train, y_train)

# Predictions
y_pred = model.predict(X_test)

# Accuracy
accuracy = accuracy_score(y_test, y_pred)

# Training Accuracy
train_accuracy = model.score(X_train, y_train)

# Save Model
pickle.dump(model, open("model/heart.pkl", "wb"))

# Results
print("\n[SUCCESS] Heart model trained successfully")

print(f"\nTraining Accuracy: {train_accuracy * 100:.2f}%")
print(f"Testing Accuracy : {accuracy * 100:.2f}%")

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))

print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# Feature Importance
importance = pd.DataFrame({
    "Feature": X.columns,
    "Importance": model.feature_importances_
}).sort_values(by="Importance", ascending=False)

print("\nFeature Importance:")
print(importance)