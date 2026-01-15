export default function OverviewPage() {
  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Overview Summary</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#65676b', fontSize: '14px' }}>Total Active Posts</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px' }}>150</p>
        </div>
        {/* เพิ่ม Card อื่นๆ ได้ที่นี่ */}
      </div>
    </div>
  );
}
