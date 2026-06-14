import pickle

def bp_model(bp, bmi, age):
    if bp > 140:
        return 1
    return 0

pickle.dump(bp_model, open("model/bp.pkl","wb"))

print("✅ BP model ready")