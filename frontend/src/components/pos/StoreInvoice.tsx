import { forwardRef } from 'react'

interface StoreInvoiceProps {
    saleData: any;
    cart: any[];
}

export const StoreInvoice = forwardRef<HTMLDivElement, StoreInvoiceProps>(({ saleData, cart }, ref) => {
    if (!saleData) return null;

    const invoiceNo = saleData.receipt_number || saleData.id?.split('-')[0] || "INV-001"
    const parsedDate = new Date(saleData.created_at || new Date().toISOString())
    const dateStr = parsedDate.toLocaleDateString('en-IN')
    const timeStr = parsedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

    const totalCalculatedAmt = cart.reduce((acc, item) => {
        const gross = parseFloat(item.sku.base_price || '0') * item.quantity
        const disc = (item.discountPercent || 0) / 100
        return acc + (gross * (1 - disc))
    }, 0)
    const finalAmount = parseFloat(saleData.total_amount || totalCalculatedAmt)
    const totalDiscount = parseFloat(saleData.discount_amount || '0')

    // Simulate Round off
    const roundedTotal = Math.round(finalAmount)
    const roundOff = (roundedTotal - finalAmount).toFixed(2)

    return (
        <div ref={ref} style={{
            padding: '10px',
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '13px',
            lineHeight: '1.2',
            color: '#000',
            width: '300px',
            margin: '0 auto',
            backgroundColor: 'white'
        }}>
            {/* 1. Header Section */}
            <div style={{ textAlign: 'center' }}>
                <div style={{ letterSpacing: '2px', fontWeight: 'bold' }}>INVOICE</div>
                <div>------------------------------------------</div>
                <div style={{ fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px' }}>Store Details (MMWEAR SHOP)</div>
                <div>GSTIN: 33AMQPL4373F1ZW</div>
                <div>Mobile No: 7305015217</div>
                <div>------------------------------------------</div>
            </div>

            {/* 2. Metadata Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <div>Invoice No : {invoiceNo}</div>
                <div>Date: {dateStr}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>Pay Mode : {saleData.payment_method?.toUpperCase() || 'CASH'}</div>
                <div>Time: {timeStr}</div>
            </div>
            <div style={{ textAlign: 'center' }}>------------------------------------------</div>

            {/* 3. Customer/Sales Info */}
            <div style={{ marginBottom: '2px' }}>
                <div>Customer : {saleData.customer_name || saleData.customer_mobile || '--'}</div>
                {saleData.customer_mobile && <div>Phone    : {saleData.customer_mobile}</div>}
                <div>Sales    : Admin / Counter 01</div>
            </div>
            <div style={{ textAlign: 'center' }}>------------------------------------------</div>

            {/* 4. Itemized Table */}
            <div style={{ display: 'flex', fontWeight: 'bold', marginBottom: '4px' }}>
                <div style={{ width: '45%' }}>Item</div>
                <div style={{ width: '15%', textAlign: 'center' }}>Qty</div>
                <div style={{ width: '20%', textAlign: 'right' }}>Rate</div>
                <div style={{ width: '20%', textAlign: 'right' }}>Amount</div>
            </div>

            {cart.map((item, idx) => {
                const price = parseFloat(item.sku.base_price || '0').toFixed(2)
                const amt = (parseFloat(item.sku.base_price || '0') * item.quantity).toFixed(2)
                const discPct = item.discountPercent || 0

                return (
                    <div key={idx} style={{ marginBottom: '6px' }}>
                        {/* Line 1 */}
                        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                            <div style={{ width: '45%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold' }}>
                                {item.sku.code}
                            </div>
                            <div style={{ width: '15%', textAlign: 'center' }}>{item.quantity}</div>
                            <div style={{ width: '20%', textAlign: 'right' }}>{price}</div>
                            <div style={{ width: '20%', textAlign: 'right' }}>{amt}</div>
                        </div>
                        {/* Per-item discount */}
                        {discPct > 0 && (
                            <div style={{ paddingLeft: '4px', fontSize: '11px', color: '#c00' }}>
                                Disc: -{discPct}% (-₹{(parseFloat(item.sku.base_price || '0') * item.quantity * discPct / 100).toFixed(2)})
                            </div>
                        )}
                        {/* Lines 2+: Description and attributes */}
                        <div style={{ paddingLeft: '4px', fontSize: '11px', fontStyle: 'italic', maxWidth: '85%' }}>
                            {item.sku.name}
                        </div>
                        {item.sku.size && (
                            <div style={{ paddingLeft: '4px', fontSize: '11px' }}>
                                Size: {item.sku.size}
                            </div>
                        )}
                        {item.sku.fabric_type && (
                            <div style={{ paddingLeft: '4px', fontSize: '11px' }}>
                                Type: {item.sku.fabric_type}
                            </div>
                        )}
                    </div>
                )
            })}

            <div style={{ textAlign: 'center' }}>------------------------------------------</div>

            {/* 5. Totals and Footer Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <div>Total Items : {cart.reduce((a: number, b: any) => a + b.quantity, 0)}</div>
                <div>{(finalAmount + totalDiscount).toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <div>Discount    :</div>
                <div>{totalDiscount > 0 ? `-${totalDiscount.toFixed(2)}` : '0.00'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>Round Off   :</div>
                <div>{parseFloat(roundOff) > 0 ? '+' : ''}{roundOff}</div>
            </div>
            <div style={{ textAlign: 'center' }}>------------------------------------------</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
                <div>Grand Total :</div>
                <div>{roundedTotal.toFixed(2)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>------------------------------------------</div>

            {/* Footer */}


            <div style={{ textAlign: 'center', fontSize: '11px' }}>
                Thank you for shopping with us! <br />
                Visit Again
            </div>
            <div style={{ textAlign: 'center', marginTop: '10px' }}>.</div>
        </div>
    )
})
