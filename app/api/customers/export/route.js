import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

export const dynamic = 'force-dynamic';

// ── Aadhaar masking: XXXX XXXX 1342 ─────────────────────────────────────────
const maskAadhar = (a) => {
  if (!a || a.length < 12) return a || '—';
  return `XXXX XXXX ${a.slice(-4)}`;
};

export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const format   = searchParams.get('format')   || '';
  const search   = searchParams.get('search')   || '';
  const scheme   = searchParams.get('scheme')   || '';
  const apy      = searchParams.get('apy')      || '';
  const vip      = searchParams.get('vip')      || '';
  const fromDate = searchParams.get('fromDate') || '';
  const toDate   = searchParams.get('toDate')   || '';

  // ── Build query — mirrors the GET list route exactly ──────────────────────
  const query = {};

  if (search) {
    query.$or = [
      { customerName: { $regex: search, $options: 'i' } },
      { accountNo:    { $regex: search, $options: 'i' } },
      { mobileNo:     { $regex: search, $options: 'i' } },
      { adharNo:      { $regex: search, $options: 'i' } },
    ];
  }

  if (scheme) query.scheme = scheme;

  if (apy === 'Yes') query.apy = true;
  if (apy === 'No')  query.apy = false;

  if (vip === 'Yes') query.vip = true;
  if (vip === 'No')  query.vip = false;

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate)   query.createdAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  const customers = await Customer.find(query).sort({ createdAt: -1 }).lean();

  // ── Active filter summary for PDF subtitle ────────────────────────────────
  const filterParts = [
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    `Total: ${customers.length}`,
    scheme   ? `Scheme: ${scheme}`   : null,
    apy      ? `APY: ${apy}`         : null,
    vip      ? `VIP: ${vip}`         : null,
    fromDate ? `From: ${fromDate}`   : null,
    toDate   ? `To: ${toDate}`       : null,
    search   ? `Search: "${search}"` : null,
  ].filter(Boolean).join('   |   ');

  // ── Excel ─────────────────────────────────────────────────────────────────
  if (format === 'excel') {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Customer Management System';
    wb.created = new Date();

    const ws = wb.addWorksheet('Customers', {
      pageSetup: { orientation: 'landscape' },
    });

    ws.columns = [
      { header: 'S.No',          key: 'sno',          width: 7  },
      { header: 'Customer Name', key: 'customerName',  width: 25 },
      { header: 'Account No',    key: 'accountNo',     width: 18 },
      { header: 'Aadhaar No',    key: 'adharNo',       width: 18 },
      { header: 'Mobile No',     key: 'mobileNo',      width: 15 },
      { header: 'Scheme',        key: 'scheme',        width: 12 },
      { header: 'APY',           key: 'apy',           width: 8  },
      { header: 'VIP',           key: 'vip',           width: 8  },
      { header: 'Created At',    key: 'createdAt',     width: 18 },
    ];

    // Header row — blue background, white bold text
    ws.getRow(1).eachCell((cell) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1D4ED8' } };
      cell.font      = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border    = { bottom: { style: 'medium', color: { argb: 'FFFFFF' } } };
    });
    ws.getRow(1).height = 28;

    customers.forEach((c, i) => {
      const row = ws.addRow({
        sno:          i + 1,
        customerName: c.customerName,
        accountNo:    c.accountNo,
        adharNo:      maskAadhar(c.adharNo),
        mobileNo:     c.mobileNo || '—',
        scheme:       c.scheme   || '—',
        apy:          c.apy ? 'Yes' : 'No',
        vip:          c.vip ? 'Yes' : 'No',
        createdAt:    new Date(c.createdAt).toLocaleDateString('en-IN'),
      });

      // Alternating row fill
      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };
        });
      }

      // VIP rows: highlight the VIP cell in yellow
      if (c.vip) {
        const vipCell = row.getCell('vip');
        vipCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF08A' } };
        vipCell.font = { bold: true, color: { argb: '92400E' } };
      }

      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      row.height = 22;
    });

    ws.autoFilter = { from: 'A1', to: 'I1' };

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="customers_${Date.now()}.xlsx"`,
      },
    });
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (format === 'pdf') {
    const {
      Document, Page, Text, View, StyleSheet, renderToBuffer, Font,
    } = await import('@react-pdf/renderer');

    Font.register({ family: 'Helvetica', fonts: [] });

    const styles = StyleSheet.create({
      page: {
        flexDirection:   'column',
        backgroundColor: '#FFFFFF',
        padding:         30,
        fontFamily:      'Helvetica',
      },
      titleSection: {
        marginBottom:  16,
        borderBottom:  '2px solid #1D4ED8',
        paddingBottom: 10,
      },
      title: {
        fontSize:     20,
        fontFamily:   'Helvetica-Bold',
        color:        '#1D4ED8',
        marginBottom: 3,
      },
      subtitle:       { fontSize: 9, color: '#6B7280' },
      table:          { width: '100%' },
      tableHeaderRow: {
        flexDirection:   'row',
        backgroundColor: '#1D4ED8',
        borderRadius:    4,
        marginBottom:    2,
      },
      tableRow: {
        flexDirection:     'row',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        minHeight:         24,
        alignItems:        'center',
      },
      tableRowEven:    { backgroundColor: '#EFF6FF' },
      tableRowOdd:     { backgroundColor: '#FFFFFF'  },
      tableRowVip:     { backgroundColor: '#FEFCE8' },
      // Header cells (widths sum to 100%)
      thSno:     { width: '5%',  padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thName:    { width: '19%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thAccount: { width: '13%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thAadhar:  { width: '15%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thMobile:  { width: '12%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thScheme:  { width: '11%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thApy:     { width: '7%',  padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thVip:     { width: '7%',  padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thDate:    { width: '11%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      // Data cells
      tdSno:     { width: '5%',  padding: '3 3', fontSize: 7, color: '#6B7280', textAlign: 'center' },
      tdName:    { width: '19%', padding: '3 3', fontSize: 7, color: '#111827', textAlign: 'left'   },
      tdAccount: { width: '13%', padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdAadhar:  { width: '15%', padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdMobile:  { width: '12%', padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdScheme:  { width: '11%', padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdApy:     { width: '7%',  padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdVipY:    { width: '7%',  padding: '3 3', fontSize: 7, color: '#92400E', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
      tdVipN:    { width: '7%',  padding: '3 3', fontSize: 7, color: '#D1D5DB', textAlign: 'center' },
      tdDate:    { width: '11%', padding: '3 3', fontSize: 7, color: '#6B7280', textAlign: 'center' },
      footer: {
        position:       'absolute',
        bottom:         20,
        left:           30,
        right:          30,
        flexDirection:  'row',
        justifyContent: 'space-between',
        borderTop:      '1px solid #E5E7EB',
        paddingTop:     6,
      },
      footerText: { fontSize: 7, color: '#9CA3AF' },
    });

    const MyDocument = () => (
      <Document title="Customer Report" author="Customer Management System">
        <Page size="A4" orientation="landscape" style={styles.page}>

          <View style={styles.titleSection}>
            <Text style={styles.title}>Customer Report</Text>
            <Text style={styles.subtitle}>{filterParts}</Text>
          </View>

          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={styles.thSno}>#</Text>
              <Text style={styles.thName}>Customer Name</Text>
              <Text style={styles.thAccount}>Account No</Text>
              <Text style={styles.thAadhar}>Aadhaar No</Text>
              <Text style={styles.thMobile}>Mobile No</Text>
              <Text style={styles.thScheme}>Scheme</Text>
              <Text style={styles.thApy}>APY</Text>
              <Text style={styles.thVip}>VIP</Text>
              <Text style={styles.thDate}>Created At</Text>
            </View>

            {/* Data rows — VIP rows get soft yellow background */}
            {customers.map((c, i) => (
              <View
                key={String(c._id)}
                style={[
                  styles.tableRow,
                  c.vip
                    ? styles.tableRowVip
                    : i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                ]}
              >
                <Text style={styles.tdSno}>{i + 1}</Text>
                <Text style={styles.tdName}>{c.customerName}</Text>
                <Text style={styles.tdAccount}>{c.accountNo}</Text>
                <Text style={styles.tdAadhar}>{maskAadhar(c.adharNo)}</Text>
                <Text style={styles.tdMobile}>{c.mobileNo || '—'}</Text>
                <Text style={styles.tdScheme}>{c.scheme   || '—'}</Text>
                <Text style={styles.tdApy}>{c.apy ? 'Yes' : 'No'}</Text>
                <Text style={c.vip ? styles.tdVipY : styles.tdVipN}>
                  {c.vip ? '★ Yes' : 'No'}
                </Text>
                <Text style={styles.tdDate}>
                  {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>Customer Management System</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            } />
          </View>

        </Page>
      </Document>
    );

    const pdfBuffer = await renderToBuffer(<MyDocument />);
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="customers_${Date.now()}.pdf"`,
      },
    });
  }

  return NextResponse.json(
    { success: false, error: 'Invalid format. Use ?format=pdf or ?format=excel' },
    { status: 400 }
  );
}