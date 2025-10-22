import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  companyInfo: {
    flex: 1,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666',
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  companyDetails: {
    fontSize: 9,
    color: '#666',
    marginBottom: 1,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clientInfo: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    marginBottom: 15,
  },
  table: {
    marginTop: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    padding: 8,
    fontWeight: 'bold',
    borderBottom: 1,
    borderColor: '#dee2e6',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: 1,
    borderColor: '#dee2e6',
  },
  tableCol1: { width: '50%' },
  tableCol2: { width: '15%', textAlign: 'right' },
  tableCol3: { width: '15%', textAlign: 'right' },
  tableCol4: { width: '20%', textAlign: 'right' },
  totalsSection: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 10,
  },
  totalValue: {
    fontSize: 10,
    textAlign: 'right',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    marginTop: 5,
    paddingTop: 5,
    borderTop: 2,
    borderColor: '#000',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  paymentInstructions: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
  },
  paymentTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paymentDetail: {
    fontSize: 9,
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
    borderTop: 1,
    borderColor: '#dee2e6',
    paddingTop: 10,
  },
})

interface InvoiceData {
  invoice: {
    invoice_number: string
    issue_date: string
    due_date: string
    status: string
    subtotal: string
    gst_amount: string
    total_amount: string
    paid_amount: string
    payment_terms: string
    notes: string
    footer_text: string
    organization_name: string
    company_name: string | null
    first_name: string | null
    last_name: string | null
    is_company: boolean
    client_email: string
    client_phone: string
    billing_address_line1: string | null
    billing_address_line2: string | null
    billing_city: string | null
    billing_state: string | null
    billing_postcode: string | null
    job_number: string | null
    job_title: string | null
  }
  lineItems: Array<{
    item_type: string
    description: string
    quantity: string
    unit_price: string
    line_total: string
  }>
  organization: {
    name: string
    abn: string | null
    phone: string | null
    email: string | null
    address_line1: string | null
    address_line2: string | null
    city: string | null
    state: string | null
    postcode: string | null
    bank_name: string | null
    bank_bsb: string | null
    bank_account_number: string | null
    bank_account_name: string | null
  }
}

export const InvoicePDF: React.FC<{ data: InvoiceData }> = ({ data }) => {
  const { invoice, lineItems, organization } = data

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `$${num.toFixed(2)}`
  }

  const getClientName = () => {
    if (invoice.is_company && invoice.company_name) {
      return invoice.company_name
    }
    return [invoice.first_name, invoice.last_name].filter(Boolean).join(' ')
  }

  const getClientAddress = () => {
    const parts = [
      invoice.billing_address_line1,
      invoice.billing_address_line2,
      invoice.billing_city,
      invoice.billing_state,
      invoice.billing_postcode,
    ].filter(Boolean)
    return parts.join(', ')
  }

  const outstandingBalance = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || '0')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{organization.name}</Text>
              {organization.abn && <Text style={styles.companyDetails}>ABN: {organization.abn}</Text>}
              {organization.address_line1 && (
                <Text style={styles.companyDetails}>{organization.address_line1}</Text>
              )}
              {organization.address_line2 && (
                <Text style={styles.companyDetails}>{organization.address_line2}</Text>
              )}
              {(organization.city || organization.state || organization.postcode) && (
                <Text style={styles.companyDetails}>
                  {[organization.city, organization.state, organization.postcode].filter(Boolean).join(' ')}
                </Text>
              )}
              {organization.phone && <Text style={styles.companyDetails}>Phone: {organization.phone}</Text>}
              {organization.email && <Text style={styles.companyDetails}>Email: {organization.email}</Text>}
            </View>
            <View style={{ textAlign: 'right' }}>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
              <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            </View>
          </View>

          {/* Invoice Details */}
          <View style={styles.row}>
            <View>
              <Text style={{ fontSize: 9, color: '#666' }}>Issue Date</Text>
              <Text style={{ fontSize: 10, marginBottom: 5 }}>{formatDate(invoice.issue_date)}</Text>
              <Text style={{ fontSize: 9, color: '#666' }}>Due Date</Text>
              <Text style={{ fontSize: 10 }}>{formatDate(invoice.due_date)}</Text>
            </View>
            {invoice.job_number && (
              <View>
                <Text style={{ fontSize: 9, color: '#666' }}>Job Number</Text>
                <Text style={{ fontSize: 10, marginBottom: 5 }}>{invoice.job_number}</Text>
                {invoice.job_title && (
                  <>
                    <Text style={{ fontSize: 9, color: '#666' }}>Job</Text>
                    <Text style={{ fontSize: 10 }}>{invoice.job_title}</Text>
                  </>
                )}
              </View>
            )}
            <View>
              <Text style={{ fontSize: 9, color: '#666' }}>Payment Terms</Text>
              <Text style={{ fontSize: 10 }}>{invoice.payment_terms || 'Net 30'}</Text>
            </View>
          </View>
        </View>

        {/* Client Information */}
        <View style={styles.clientInfo}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>{getClientName()}</Text>
          {getClientAddress() && <Text style={{ fontSize: 9, marginBottom: 1 }}>{getClientAddress()}</Text>}
          {invoice.client_email && <Text style={{ fontSize: 9, marginBottom: 1 }}>Email: {invoice.client_email}</Text>}
          {invoice.client_phone && <Text style={{ fontSize: 9 }}>Phone: {invoice.client_phone}</Text>}
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCol1}>Description</Text>
            <Text style={styles.tableCol2}>Qty</Text>
            <Text style={styles.tableCol3}>Unit Price</Text>
            <Text style={styles.tableCol4}>Amount</Text>
          </View>
          {lineItems.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={styles.tableCol1}>
                <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>
                  {item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1)}
                </Text>
                <Text style={{ fontSize: 9, color: '#666' }}>{item.description}</Text>
              </View>
              <Text style={styles.tableCol2}>{parseFloat(item.quantity).toFixed(2)}</Text>
              <Text style={styles.tableCol3}>{formatCurrency(item.unit_price)}</Text>
              <Text style={styles.tableCol4}>{formatCurrency(item.line_total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (10%):</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.gst_amount)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total_amount)}</Text>
          </View>
          {parseFloat(invoice.paid_amount || '0') > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Paid:</Text>
                <Text style={styles.totalValue}>-{formatCurrency(invoice.paid_amount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={{ ...styles.totalLabel, fontWeight: 'bold' }}>Balance Due:</Text>
                <Text style={{ ...styles.totalValue, fontWeight: 'bold' }}>{formatCurrency(outstandingBalance)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Payment Instructions */}
        {organization.bank_account_number && (
          <View style={styles.paymentInstructions}>
            <Text style={styles.paymentTitle}>Payment Details</Text>
            {organization.bank_name && <Text style={styles.paymentDetail}>Bank: {organization.bank_name}</Text>}
            {organization.bank_bsb && <Text style={styles.paymentDetail}>BSB: {organization.bank_bsb}</Text>}
            {organization.bank_account_number && (
              <Text style={styles.paymentDetail}>Account: {organization.bank_account_number}</Text>
            )}
            {organization.bank_account_name && (
              <Text style={styles.paymentDetail}>Account Name: {organization.bank_account_name}</Text>
            )}
            <Text style={{ ...styles.paymentDetail, marginTop: 5 }}>
              Please use invoice number {invoice.invoice_number} as payment reference
            </Text>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={{ marginTop: 15 }}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ fontSize: 9, color: '#666' }}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{invoice.footer_text || 'Thank you for your business!'}</Text>
        </View>
      </Page>
    </Document>
  )
}
