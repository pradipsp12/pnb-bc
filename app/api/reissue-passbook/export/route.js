// app/api/reissue-passbook/export/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb'; 
import ReissuePassbook from '@/lib/models/ReissuePassbook';

export const dynamic = 'force-dynamic';

// ── Aadhaar masking: XXXX XXXX 1342 ──────────────────────────────────────────
const maskAadhar = (a) => {
  if (!a || a.length < 12) return a || '—';
  return `XXXX XXXX ${a.slice(-4)}`;
};

export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const format   = searchParams.get('format')   || '';
  const search   = searchParams.get('search')   || '';
  const fromDate = searchParams.get('fromDate') || '';
  const toDate   = searchParams.get('toDate')   || '';

  // ── Build query — mirrors the GET list route exactly ─────────────────────
  const query = {};

  if (search.trim()) {
    const re = { $regex: search.trim(), $options: 'i' };
    query.$or = [
      { customerName: re },
      { accountNo:    re },
      { mobileNo:     re },
      { adharNo:      re },
    ];
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate)   query.createdAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  const records = await ReissuePassbook.find(query)
    .sort({ createdAt: -1 })
    .lean();

  // ── Active filter summary line (for PDF subtitle) ─────────────────────────
  const filterParts = [
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    `Total: ${records.length}`,
    search   ? `Search: "${search}"`     : null,
    fromDate ? `From: ${fromDate}`       : null,
    toDate   ? `To: ${toDate}`           : null,
  ].filter(Boolean).join('   |   ');

  // ── Excel ─────────────────────────────────────────────────────────────────
  if (format === 'excel') {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'PNB Form Data Extractor';
    wb.created = new Date();

    const ws = wb.addWorksheet('Reissue Passbook', {
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
      { header: 'Added On',      key: 'createdAt',     width: 18 },
    ];

    // Header row styling — identical to customer export
    ws.getRow(1).eachCell((cell) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1D4ED8' } };
      cell.font      = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border    = { bottom: { style: 'medium', color: { argb: 'FFFFFF' } } };
    });
    ws.getRow(1).height = 28;

    records.forEach((r, i) => {
      const row = ws.addRow({
        sno:         i + 1,
        customerName: r.customerName,
        accountNo:    r.accountNo,
        adharNo:      maskAadhar(r.adharNo),          // ← masked
        mobileNo:     r.mobileNo  || '—',
        scheme:       r.scheme    || '—',
        apy:          r.apy ? 'Yes' : 'No',            // ← bool → Yes/No
        createdAt:    new Date(r.createdAt).toLocaleDateString('en-IN'),
      });
      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };
        });
      }
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      row.height = 22;
    });

    ws.autoFilter = { from: 'A1', to: 'H1' };

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reissue_passbook_${Date.now()}.xlsx"`,
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
        fontSize:    20,
        fontFamily:  'Helvetica-Bold',
        color:       '#1D4ED8',
        marginBottom: 3,
      },
      subtitle: { fontSize: 9, color: '#6B7280' },
      table:    { width: '100%' },
      tableHeaderRow: {
        flexDirection:   'row',
        backgroundColor: '#1D4ED8',
        borderRadius:    4,
        marginBottom:    2,
      },
      tableRow: {
        flexDirection:    'row',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        minHeight:         24,
        alignItems:        'center',
      },
      tableRowEven: { backgroundColor: '#EFF6FF' },
      tableRowOdd:  { backgroundColor: '#FFFFFF'  },
      // Header cells
      thSno:     { width: '5%',  padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thName:    { width: '22%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thAccount: { width: '15%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thAadhar:  { width: '16%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thMobile:  { width: '13%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thScheme:  { width: '11%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thApy:     { width: '7%',  padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      thDate:    { width: '11%', padding: '4 3', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
      // Data cells
      tdSno:     { width: '5%',  padding: '3 3', fontSize: 7, color: '#6B7280', textAlign: 'center' },
      tdName:    { width: '22%', padding: '3 3', fontSize: 7, color: '#111827', textAlign: 'left'   },
      tdAccount: { width: '15%', padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdAadhar:  { width: '16%', padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdMobile:  { width: '13%', padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdScheme:  { width: '11%', padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdApy:     { width: '7%',  padding: '3 3', fontSize: 7, color: '#374151', textAlign: 'center' },
      tdDate:    { width: '11%', padding: '3 3', fontSize: 7, color: '#6B7280', textAlign: 'center' },
      footer: {
        position:          'absolute',
        bottom:            20,
        left:              30,
        right:             30,
        flexDirection:     'row',
        justifyContent:    'space-between',
        borderTop:         '1px solid #E5E7EB',
        paddingTop:        6,
      },
      footerText: { fontSize: 7, color: '#9CA3AF' },
    });

    const MyDocument = () => (
      <Document title="Reissue Passbook Report" author="PNB Form Data Extractor">
        <Page size="A4" orientation="landscape" style={styles.page}>

          <View style={styles.titleSection}>
            <Text style={styles.title}>Reissue Passbook Report</Text>
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
              <Text style={styles.thDate}>Added On</Text>
            </View>

            {/* Rows */}
            {records.map((r, i) => (
              <View
                key={String(r._id)}
                style={[styles.tableRow, i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}
              >
                <Text style={styles.tdSno}>{i + 1}</Text>
                <Text style={styles.tdName}>{r.customerName}</Text>
                <Text style={styles.tdAccount}>{r.accountNo}</Text>
                <Text style={styles.tdAadhar}>{maskAadhar(r.adharNo)}</Text>
                <Text style={styles.tdMobile}>{r.mobileNo || '—'}</Text>
                <Text style={styles.tdScheme}>{r.scheme   || '—'}</Text>
                <Text style={styles.tdApy}>{r.apy ? 'Yes' : 'No'}</Text>
                <Text style={styles.tdDate}>
                  {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>PNB Form Data Extractor — Reissue Passbook</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>

        </Page>
      </Document>
    );

    const pdfBuffer = await renderToBuffer(<MyDocument />);
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="reissue_passbook_${Date.now()}.pdf"`,
      },
    });
  }

  return NextResponse.json(
    { success: false, error: 'Invalid format. Use ?format=pdf or ?format=excel' },
    { status: 400 }
  );
}