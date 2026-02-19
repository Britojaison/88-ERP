"""
Diagnostic script to test Shopify connection.
Run this to debug connection issues.

Usage:
    python test_shopify_connection.py
"""
import os
import sys
import django
import requests

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.integrations.shopify_models import ShopifyStore
from apps.integrations.shopify_service import ShopifyAPIClient


def test_direct_api_call():
    """Test direct API call without Django models."""
    print("\n" + "="*60)
    print("DIRECT API TEST")
    print("="*60)
    
    # Get credentials from environment
    shop_domain = os.getenv('SHOPIFY_STORE_DOMAIN', '')
    access_token = os.getenv('SHOPIFY_ACCESS_TOKEN', '')
    api_version = os.getenv('SHOPIFY_API_VERSION', '2024-01')
    
    print(f"\nShop Domain: {shop_domain}")
    print(f"API Version: {api_version}")
    print(f"Access Token: {access_token[:10]}...{access_token[-4:] if len(access_token) > 14 else ''}")
    
    if not shop_domain or not access_token:
        print("\n❌ ERROR: Missing credentials in .env file")
        print("   Required: SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN")
        return False
    
    # Construct URL
    url = f"https://{shop_domain}/admin/api/{api_version}/shop.json"
    headers = {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json',
    }
    
    print(f"\nTesting URL: {url}")
    print("\nMaking request...")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            shop = data.get('shop', {})
            print("\n✅ SUCCESS! Connected to Shopify")
            print(f"\nShop Info:")
            print(f"  Name: {shop.get('name')}")
            print(f"  Email: {shop.get('email')}")
            print(f"  Domain: {shop.get('domain')}")
            print(f"  Currency: {shop.get('currency')}")
            print(f"  Plan: {shop.get('plan_name')}")
            return True
        elif response.status_code == 401:
            print("\n❌ ERROR: Authentication failed")
            print("   - Check if your access token is correct")
            print("   - Verify the token has 'read_products' scope")
            print(f"\nResponse: {response.text}")
            return False
        elif response.status_code == 404:
            print("\n❌ ERROR: Shop not found")
            print("   - Check if shop domain is correct")
            print("   - Format should be: your-store.myshopify.com")
            print(f"\nResponse: {response.text}")
            return False
        else:
            print(f"\n❌ ERROR: Unexpected status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("\n❌ ERROR: Request timed out")
        print("   - Check your internet connection")
        print("   - Verify the shop domain is accessible")
        return False
    except requests.exceptions.ConnectionError as e:
        print("\n❌ ERROR: Connection failed")
        print(f"   {str(e)}")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {str(e)}")
        return False


def test_with_django_client():
    """Test using Django ShopifyAPIClient."""
    print("\n" + "="*60)
    print("DJANGO CLIENT TEST")
    print("="*60)
    
    # Get or create test store
    shop_domain = os.getenv('SHOPIFY_STORE_DOMAIN', '')
    access_token = os.getenv('SHOPIFY_ACCESS_TOKEN', '')
    api_version = os.getenv('SHOPIFY_API_VERSION', '2024-01')
    
    if not shop_domain or not access_token:
        print("\n⚠️  Skipping - no credentials in .env")
        return False
    
    # Find existing store or create temporary one
    store = ShopifyStore.objects.filter(shop_domain=shop_domain).first()
    
    if not store:
        print("\n⚠️  No store found in database")
        print("   Creating temporary store for testing...")
        from apps.mdm.models import Company
        company, _ = Company.objects.get_or_create(
            code='TEST',
            defaults={'name': 'Test Company', 'status': 'active'}
        )
        store = ShopifyStore(
            name='Test Store',
            shop_domain=shop_domain,
            access_token=access_token,
            api_version=api_version,
            company=company,
            status='active'
        )
    else:
        print(f"\nUsing existing store: {store.name} (ID: {store.id})")
    
    # Test connection
    print("\nTesting connection with ShopifyAPIClient...")
    try:
        client = ShopifyAPIClient(store)
        shop_info = client.test_connection()
        
        if shop_info:
            print("\n✅ SUCCESS! Django client connected")
            print(f"\nShop Info:")
            print(f"  Name: {shop_info.get('name')}")
            print(f"  Email: {shop_info.get('email')}")
            return True
        else:
            print("\n❌ FAILED: No shop info returned")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n" + "="*60)
    print("SHOPIFY CONNECTION DIAGNOSTIC TOOL")
    print("="*60)
    
    # Test 1: Direct API call
    direct_success = test_direct_api_call()
    
    # Test 2: Django client
    django_success = test_with_django_client()
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"\nDirect API Test: {'✅ PASSED' if direct_success else '❌ FAILED'}")
    print(f"Django Client Test: {'✅ PASSED' if django_success else '❌ FAILED'}")
    
    if direct_success and django_success:
        print("\n🎉 All tests passed! Your Shopify connection is working.")
    elif direct_success and not django_success:
        print("\n⚠️  Direct API works but Django client fails.")
        print("   This suggests an issue with the Django integration.")
    elif not direct_success:
        print("\n❌ Connection failed. Please check:")
        print("   1. SHOPIFY_STORE_DOMAIN in .env (format: your-store.myshopify.com)")
        print("   2. SHOPIFY_ACCESS_TOKEN in .env (must be valid)")
        print("   3. Token has required scopes (read_products, read_orders, etc.)")
        print("   4. Internet connection is working")
    
    print("\n" + "="*60 + "\n")


if __name__ == '__main__':
    main()
