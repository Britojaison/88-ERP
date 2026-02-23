#!/usr/bin/env python3
"""
Simple script to test if the Django backend is running and accessible.
"""
import requests
import json

def test_backend():
    base_url = "http://localhost:8000"
    
    print("Testing Django backend connectivity...")
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{base_url}/admin/", timeout=5)
        print(f"✓ Server is running (Status: {response.status_code})")
    except requests.exceptions.ConnectionError:
        print("✗ Server is not running or not accessible")
        print("Please start the backend with: python manage.py runserver")
        return False
    except Exception as e:
        print(f"✗ Error connecting to server: {e}")
        return False
    
    # Test 2: Check API endpoints
    api_endpoints = [
        "/api/mdm/products/",
        "/api/mdm/skus/",
        "/api/mdm/companies/",
        "/api/mdm/locations/",
    ]
    
    for endpoint in api_endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code == 200:
                print(f"✓ {endpoint} - OK")
            elif response.status_code == 401:
                print(f"⚠ {endpoint} - Authentication required (this is normal)")
            else:
                print(f"⚠ {endpoint} - Status: {response.status_code}")
        except Exception as e:
            print(f"✗ {endpoint} - Error: {e}")
    
    print("\nBackend test completed.")
    return True

if __name__ == "__main__":
    test_backend()