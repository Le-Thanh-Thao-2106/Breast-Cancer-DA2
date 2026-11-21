import httpx
from sklearn.datasets import load_breast_cancer


bundle = load_breast_cancer(as_frame=True)

sample = bundle.data.iloc[0].to_dict()

response = httpx.post(
    "https://breast-cancer-da2-api.onrender.com/predict",
    json={
        "features": sample
    }
)

print("Status code:", response.status_code)

print("\nAPI response:")
print(response.json())