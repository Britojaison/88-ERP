"""
Shopify Analytics API Views for Reporting.
Provides aggregated data for reports from Shopify orders, products, and customers.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Sum, Count, Avg, F, Q
from collections import defaultdict
from .shopify_models import ShopifyOrder, ShopifyProduct, ShopifyStore
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow unauthenticated access for testing
def product_performance(request):
    """
    Product performance analytics from Shopify orders.
    Returns top products by revenue, quantity sold, and order count.
    """
    user = request.user
    company_id = getattr(user, 'company_id', None)
    
    # Get orders
    orders_queryset = ShopifyOrder.objects.select_related('store')
    if company_id:
        orders_queryset = orders_queryset.filter(store__company_id=company_id)
    else:
        orders_queryset = orders_queryset.filter(store__created_by=user)
    
    # Aggregate product data from order line items
    product_stats = defaultdict(lambda: {
        'title': '',
        'sku': '',
        'quantity_sold': 0,
        'revenue': 0.0,
        'order_count': 0,
        'product_id': None,
    })
    
    for order in orders_queryset:
        if not order.shopify_data or 'line_items' not in order.shopify_data:
            continue
        
        for item in order.shopify_data['line_items']:
            product_id = item.get('product_id')
            if not product_id:
                continue
            
            key = f"{product_id}_{item.get('variant_id', '')}"
            
            product_stats[key]['title'] = item.get('title', 'Unknown Product')
            product_stats[key]['sku'] = item.get('sku', '')
            product_stats[key]['quantity_sold'] += int(item.get('quantity', 0))
            product_stats[key]['revenue'] += float(item.get('price', 0)) * int(item.get('quantity', 0))
            product_stats[key]['order_count'] += 1
            product_stats[key]['product_id'] = product_id
    
    # Convert to list and sort by revenue
    products = list(product_stats.values())
    products.sort(key=lambda x: x['revenue'], reverse=True)
    
    return Response({
        'total_products': len(products),
        'products': products[:100],  # Top 100 products
    })


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow unauthenticated access for testing
def customer_analysis(request):
    """
    Customer analytics from Shopify orders.
    Returns customer spending, order frequency, and lifetime value.
    """
    user = request.user
    company_id = getattr(user, 'company_id', None)
    
    # Get orders
    orders_queryset = ShopifyOrder.objects.select_related('store')
    if company_id:
        orders_queryset = orders_queryset.filter(store__company_id=company_id)
    else:
        orders_queryset = orders_queryset.filter(store__created_by=user)
    
    # Aggregate customer data
    customer_stats = defaultdict(lambda: {
        'name': '',
        'email': '',
        'order_count': 0,
        'total_spent': 0.0,
        'avg_order_value': 0.0,
    })
    
    for order in orders_queryset:
        email = order.customer_email
        if not email:
            email = f"guest_{order.shopify_order_id}"
        
        customer_stats[email]['name'] = order.customer_name or 'Guest'
        customer_stats[email]['email'] = order.customer_email or 'N/A'
        customer_stats[email]['order_count'] += 1
        customer_stats[email]['total_spent'] += float(order.total_price)
    
    # Calculate average order value
    for customer in customer_stats.values():
        if customer['order_count'] > 0:
            customer['avg_order_value'] = customer['total_spent'] / customer['order_count']
    
    # Convert to list and sort by total spent
    customers = list(customer_stats.values())
    customers.sort(key=lambda x: x['total_spent'], reverse=True)
    
    total_revenue = sum(c['total_spent'] for c in customers)
    
    return Response({
        'total_customers': len(customers),
        'total_revenue': total_revenue,
        'customers': customers[:100],  # Top 100 customers
    })


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow unauthenticated access for testing
def traffic_source_analysis(request):
    """
    Traffic source analytics from Shopify orders.
    Analyzes referring_site and source_name from order data.
    """
    user = request.user
    company_id = getattr(user, 'company_id', None)
    
    # Get orders
    orders_queryset = ShopifyOrder.objects.select_related('store')
    if company_id:
        orders_queryset = orders_queryset.filter(store__company_id=company_id)
    else:
        orders_queryset = orders_queryset.filter(store__created_by=user)
    
    # Aggregate by traffic source
    source_stats = defaultdict(lambda: {
        'source': '',
        'order_count': 0,
        'revenue': 0.0,
    })
    
    for order in orders_queryset:
        # Extract source from shopify_data
        source = 'direct'
        if order.shopify_data:
            referring_site = order.shopify_data.get('referring_site', '')
            source_name = order.shopify_data.get('source_name', '')
            
            if referring_site:
                # Parse domain from referring site
                if 'google' in referring_site.lower():
                    source = 'google'
                elif 'facebook' in referring_site.lower():
                    source = 'facebook'
                elif 'instagram' in referring_site.lower():
                    source = 'instagram'
                elif 'twitter' in referring_site.lower():
                    source = 'twitter'
                else:
                    source = 'referral'
            elif source_name:
                source = source_name.lower()
        
        source_stats[source]['source'] = source
        source_stats[source]['order_count'] += 1
        source_stats[source]['revenue'] += float(order.total_price)
    
    # Convert to list and sort by revenue
    sources = list(source_stats.values())
    sources.sort(key=lambda x: x['revenue'], reverse=True)
    
    return Response({
        'total_sources': len(sources),
        'sources': sources,
    })


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow unauthenticated access for testing
def inventory_summary(request):
    """
    Inventory summary from Shopify products.
    Returns stock levels, low stock alerts, and inventory value.
    """
    user = request.user
    company_id = getattr(user, 'company_id', None)
    
    # Get products
    products_queryset = ShopifyProduct.objects.select_related('store', 'erp_sku')
    if company_id:
        products_queryset = products_queryset.filter(store__company_id=company_id)
    else:
        products_queryset = products_queryset.filter(store__created_by=user)
    
    total_products = products_queryset.count()
    total_quantity = products_queryset.aggregate(
        total=Sum('shopify_inventory_quantity')
    )['total'] or 0
    
    # Calculate inventory value
    total_value = 0.0
    low_stock_items = []
    out_of_stock_items = []
    
    for product in products_queryset:
        quantity = product.shopify_inventory_quantity or 0
        price = float(product.shopify_price or 0)
        total_value += quantity * price
        
        if quantity == 0:
            out_of_stock_items.append({
                'title': product.shopify_title,
                'sku': product.shopify_sku,
                'price': price,
            })
        elif quantity < 10:  # Low stock threshold
            low_stock_items.append({
                'title': product.shopify_title,
                'sku': product.shopify_sku,
                'quantity': quantity,
                'price': price,
            })
    
    return Response({
        'total_products': total_products,
        'total_quantity': total_quantity,
        'total_value': round(total_value, 2),
        'out_of_stock_count': len(out_of_stock_items),
        'low_stock_count': len(low_stock_items),
        'out_of_stock_items': out_of_stock_items[:20],
        'low_stock_items': low_stock_items[:20],
    })


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow unauthenticated access for testing
def returns_analysis(request):
    """
    Returns and refunds analysis from Shopify orders.
    Analyzes refunds and return patterns.
    """
    user = request.user
    company_id = getattr(user, 'company_id', None)
    
    # Get orders with refunds
    orders_queryset = ShopifyOrder.objects.select_related('store')
    if company_id:
        orders_queryset = orders_queryset.filter(store__company_id=company_id)
    else:
        orders_queryset = orders_queryset.filter(store__created_by=user)
    
    total_refunds = 0.0
    refund_count = 0
    refund_reasons = defaultdict(int)
    
    for order in orders_queryset:
        if not order.shopify_data:
            continue
        
        refunds = order.shopify_data.get('refunds', [])
        if refunds:
            refund_count += 1
            for refund in refunds:
                # Sum refund amounts
                for transaction in refund.get('transactions', []):
                    if transaction.get('kind') == 'refund':
                        total_refunds += float(transaction.get('amount', 0))
                
                # Track refund reasons (note from refund)
                note = refund.get('note', 'No reason provided')
                if note:
                    refund_reasons[note] += 1
    
    # Convert reasons to list
    reasons_list = [
        {'reason': reason, 'count': count}
        for reason, count in sorted(refund_reasons.items(), key=lambda x: x[1], reverse=True)
    ]
    
    return Response({
        'total_refunds': round(total_refunds, 2),
        'refund_count': refund_count,
        'refund_rate': round((refund_count / orders_queryset.count() * 100), 2) if orders_queryset.count() > 0 else 0,
        'top_reasons': reasons_list[:10],
    })
