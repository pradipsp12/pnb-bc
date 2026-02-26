// app/api/records/export/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Account from '@/lib/models/Account';

export const dynamic = 'force-dynamic';

// ── Helpers ───────────────────────────────────────────────────────────────────
const maskAadhar = (a) => (!a || a.length < 12) ? (a || '—') : `XXXX XXXX ${a.slice(-4)}`;
const toDDMMYYYY = (yyyymmdd) => { if (!yyyymmdd) return null; const [y,m,d] = yyyymmdd.split('-'); return `${d}-${m}-${y}`; };
const toDateGte  = (yyyymmdd) => new Date(`${yyyymmdd}T00:00:00.000Z`);
const toDateLte  = (yyyymmdd) => new Date(`${yyyymmdd}T23:59:59.999Z`);

export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const format   = searchParams.get('format')   || '';
  const search   = searchParams.get('search')   || '';
  const fromDate = searchParams.get('fromDate') || '';
  const toDate   = searchParams.get('toDate')   || '';
  const scheme   = searchParams.get('scheme')   || '';
  const apy      = searchParams.get('apy')      || '';
  const unfreeze = searchParams.get('unfreeze') || ''; // 'done' | 'pending'
  const passbook = searchParams.get('passbook') || ''; // 'issued' | 'pending'

  // ── Build query ───────────────────────────────────────────────────────────
  const query = {};

  if (search.trim()) {
    const re = { $regex: search.trim(), $options: 'i' };
    query.$or = [
      { customerName: re }, { accountNo: re }, { customerId: re },
      { mobileNo: re },     { aadhaarNo: re }, { referenceNo: re },
    ];
  }

  if (scheme)        query.scheme = scheme;
  if (apy === 'Yes') query.apy    = true;
  if (apy === 'No')  query.apy    = false;

  // ── Unfreeze / Passbook ───────────────────────────────────────────────────
  if (unfreeze === 'done')    query.unfreezeStatus = true;
  if (unfreeze === 'pending') query.unfreezeStatus = false;
  if (passbook === 'issued')  query.passbookIssued = true;
  if (passbook === 'pending') query.passbookIssued = false;

  // ── Date filter on accountOpenDate ("DD-MM-YYYY") ─────────────────────────
  if (fromDate || toDate) {
    const dateExpr = {
      $dateFromString: {
        dateString: '$accountOpenDate',
        format:     '%d-%m-%Y',
        onError:    new Date(0),
        onNull:     new Date(0),
      },
    };
    const conditions = [];
    if (fromDate) conditions.push({ $gte: [dateExpr, toDateGte(fromDate)] });
    if (toDate)   conditions.push({ $lte: [dateExpr, toDateLte(toDate)]   });
    query.$expr = conditions.length === 1 ? conditions[0] : { $and: conditions };
  }

  const records = await Account.find(query)
    .select('-rawText -photoBase64')
    .sort({ createdAt: -1 })
    .lean();

  // ── Excel ─────────────────────────────────────────────────────────────────
  if (format === 'excel') {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'PNB Form Data Extractor';
    wb.created = new Date();

    const ws = wb.addWorksheet('Records', { pageSetup: { orientation: 'landscape' } });

    ws.columns = [
      { header: 'S.No',          key: 'sno',            width: 6  },
      { header: 'Open Date',     key: 'accountOpenDate', width: 14 },
      { header: 'Customer Name', key: 'customerName',    width: 24 },
      { header: 'Account No',    key: 'accountNo',       width: 18 },
      { header: 'Customer ID',   key: 'customerId',      width: 16 },
      { header: 'Aadhaar No',    key: 'aadhaarNo',       width: 18 },
      { header: 'Mobile No',     key: 'mobileNo',        width: 14 },
      { header: 'Sex',           key: 'sex',             width: 6  },
      { header: 'Date of Birth', key: 'dateOfBirth',     width: 14 },
      { header: 'Scheme',        key: 'scheme',          width: 10 },
      { header: 'APY',           key: 'apy',             width: 8  },
      { header: 'Unfreeze',      key: 'unfreezeStatus',  width: 10 },
      { header: 'Passbook',      key: 'passbookIssued',  width: 10 },
    ];

    ws.getRow(1).eachCell((cell) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1D4ED8' } };
      cell.font      = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.getRow(1).height = 26;

    records.forEach((r, i) => {
      const row = ws.addRow({
        sno:             i + 1,
        accountOpenDate: r.accountOpenDate || '—',
        customerName:    r.customerName    || '—',
        accountNo:       r.accountNo       || '—',
        customerId:      r.customerId      || '—',
        aadhaarNo:       maskAadhar(r.aadhaarNo),
        mobileNo:        r.mobileNo        || '—',
        sex:             r.sex             || '—',
        dateOfBirth:     r.dateOfBirth     || '—',
        scheme:          r.scheme          || '—',
        apy:             r.apy ? 'Yes' : 'No',
        unfreezeStatus:  r.unfreezeStatus  ? 'Done'   : 'Pending',
        passbookIssued:  r.passbookIssued  ? 'Issued' : 'Pending',
      });
      if (i % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };
        });
      }
      row.eachCell(cell => { cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
      row.height = 20;
    });

    ws.autoFilter = { from: 'A1', to: 'M1' };

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="records_${Date.now()}.xlsx"`,
      },
    });
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (format === 'pdf') {
    const { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } =
      await import('@react-pdf/renderer');

    Font.register({ family: 'Helvetica', fonts: [] });

    const S = StyleSheet.create({
      page:     { padding: 28, backgroundColor: '#fff', fontFamily: 'Helvetica' },
      titleSec: { marginBottom: 12, borderBottom: '2px solid #1D4ED8', paddingBottom: 8 },
      title:    { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1D4ED8', marginBottom: 2 },
      subtitle: { fontSize: 8, color: '#6B7280' },
      table:    { width: '100%' },
      hRow:     { flexDirection: 'row', backgroundColor: '#1D4ED8', borderRadius: 3, marginBottom: 1 },
      row:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', minHeight: 20, alignItems: 'center' },
      rowEven:  { backgroundColor: '#EFF6FF' },
      rowOdd:   { backgroundColor: '#FFFFFF' },
      footer:   { position: 'absolute', bottom: 18, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: 5 },
      fText:    { fontSize: 7, color: '#9CA3AF' },
      // header cells
      hSno:  { width:'4%',  padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hDate: { width:'9%',  padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hName: { width:'17%', padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hAcc:  { width:'12%', padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hCid:  { width:'11%', padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hAadh: { width:'13%', padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hMob:  { width:'10%', padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hSch:  { width:'8%',  padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hApy:  { width:'5%',  padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hUnf:  { width:'6%',  padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      hPb:   { width:'5%',  padding:'3 2', fontSize:6, fontFamily:'Helvetica-Bold', color:'#fff', textAlign:'center' },
      // data cells
      dSno:  { width:'4%',  padding:'2 2', fontSize:6, color:'#9CA3AF', textAlign:'center' },
      dDate: { width:'9%',  padding:'2 2', fontSize:6, color:'#374151', textAlign:'center' },
      dName: { width:'17%', padding:'2 2', fontSize:6, color:'#111827', textAlign:'left'   },
      dAcc:  { width:'12%', padding:'2 2', fontSize:6, color:'#374151', textAlign:'center' },
      dCid:  { width:'11%', padding:'2 2', fontSize:6, color:'#374151', textAlign:'center' },
      dAadh: { width:'13%', padding:'2 2', fontSize:6, color:'#374151', textAlign:'center' },
      dMob:  { width:'10%', padding:'2 2', fontSize:6, color:'#374151', textAlign:'center' },
      dSch:  { width:'8%',  padding:'2 2', fontSize:6, color:'#374151', textAlign:'center' },
      dApy:  { width:'5%',  padding:'2 2', fontSize:6, color:'#374151', textAlign:'center' },
      dUnf:  { width:'6%',  padding:'2 2', fontSize:6, color:'#374151', textAlign:'center' },
      dPb:   { width:'5%',  padding:'2 2', fontSize:6, color:'#374151', textAlign:'center' },
    });

    // Build subtitle showing all active filters
    const filterParts = [
      `Generated: ${new Date().toLocaleString('en-IN')}`,
      `Total: ${records.length}`,
      scheme   ? `Scheme: ${scheme}`            : null,
      apy      ? `APY: ${apy}`                  : null,
      unfreeze ? `Unfreeze: ${unfreeze}`         : null,
      passbook ? `Passbook: ${passbook}`         : null,
      fromDate ? `From: ${toDDMMYYYY(fromDate)}` : null,
      toDate   ? `To: ${toDDMMYYYY(toDate)}`     : null,
      search   ? `Search: "${search}"`           : null,
    ].filter(Boolean).join('   |   ');

    const MyDoc = () => (
      <Document title="Records Report" author="PNB Form Data Extractor">
        <Page size="A4" orientation="landscape" style={S.page}>

          <View style={S.titleSec}>
            <Text style={S.title}>Records Report</Text>
            <Text style={S.subtitle}>{filterParts}</Text>
          </View>

          <View style={S.table}>
            <View style={S.hRow}>
              <Text style={S.hSno}>#</Text>
              <Text style={S.hDate}>Open Date</Text>
              <Text style={S.hName}>Customer Name</Text>
              <Text style={S.hAcc}>Account No</Text>
              <Text style={S.hCid}>Customer ID</Text>
              <Text style={S.hAadh}>Aadhaar No</Text>
              <Text style={S.hMob}>Mobile No</Text>
              <Text style={S.hSch}>Scheme</Text>
              <Text style={S.hApy}>APY</Text>
              <Text style={S.hUnf}>Unfreeze</Text>
              <Text style={S.hPb}>PBook</Text>
            </View>

            {records.map((r, i) => (
              <View key={String(r._id)} style={[S.row, i % 2 === 0 ? S.rowEven : S.rowOdd]}>
                <Text style={S.dSno}>{i + 1}</Text>
                <Text style={S.dDate}>{r.accountOpenDate || '—'}</Text>
                <Text style={S.dName}>{r.customerName    || '—'}</Text>
                <Text style={S.dAcc}>{r.accountNo        || '—'}</Text>
                <Text style={S.dCid}>{r.customerId       || '—'}</Text>
                <Text style={S.dAadh}>{maskAadhar(r.aadhaarNo)}</Text>
                <Text style={S.dMob}>{r.mobileNo         || '—'}</Text>
                <Text style={S.dSch}>{r.scheme           || '—'}</Text>
                <Text style={S.dApy}>{r.apy ? 'Yes' : 'No'}</Text>
                <Text style={S.dUnf}>{r.unfreezeStatus ? '✓' : '—'}</Text>
                <Text style={S.dPb}>{r.passbookIssued  ? '✓' : '—'}</Text>
              </View>
            ))}
          </View>

          <View style={S.footer} fixed>
            <Text style={S.fText}>PNB Form Data Extractor</Text>
            <Text style={S.fText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>

        </Page>
      </Document>
    );

    const pdfBuf = await renderToBuffer(<MyDoc />);
    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="records_${Date.now()}.pdf"`,
      },
    });
  }

  return NextResponse.json({ success: false, error: 'Invalid format' }, { status: 400 });
}