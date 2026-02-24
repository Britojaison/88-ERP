import requests

API_URL = "http://localhost:8000/api/mdm/skus/"
# Replace with valid token and company id from a previous successful request
HEADERS = {
    "Authorization": "Bearer <YOUR_TOKEN>",
    "Content-Type": "application/json"
}

payload = {
  "code": "MMW-999-M-TEST",
  "name": "Test Product - M",
  "product": 1, # Make sure product 1 exists
  "size": "M",
  "base_price": "100",
  "cost_price": "150",
  "weight": "",
  "is_serialized": False,
  "is_batch_tracked": False
}

print("Sending payload:", payload)
try:
    response = requests.post(API_URL, json=payload, headers=HEADERS)
    print("Status Code:", response.status_code)
    print("Response JSON:", response.json())
except Exception as e:
    print("Error:", e)
