"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // ตัวเชื่อมฐานข้อมูลที่เรากำลังจะสร้าง

export default function HomePage() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  // ฟังก์ชันดึงข้อมูลรถจากฐานข้อมูล
  const fetchCars = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false }); // เอารถใหม่ขึ้นก่อน

    if (!error) {
      setCars(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCars();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ส่วนหัวเว็บ (Header) */}
      <nav className="bg-blue-800 text-white p-5 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">JACK CARS MARKET</h1>
          <span className="bg-blue-700 px-3 py-1 rounded-full text-sm">ซื้อ-ขายรถเจ้าของมือเดียว</span>
        </div>
      </nav>

      {/* ส่วนเนื้อหาหลัก */}
      <main className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">รถพร้อมขาย</h2>
          <div className="text-gray-500">{cars.length} รายการทั้งหมด</div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500 text-xl">กำลังโหลดข้อมูลรถ...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cars.map((car) => (
              <div key={car.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-200">
                {/* รูปภาพ (ตอนนี้ใช้สีพื้นไปก่อนจนกว่าจะอัปโหลดรูปจริง) */}
                <div className="h-56 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <span className="text-gray-400">รูปภาพ {car.brand}</span>
                </div>

                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{car.brand} {car.model}</h3>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">ว่าง</span>
                  </div>
                  <p className="text-gray-500 mb-4">ประเภท: {car.category || 'ทั่วไป'}</p>
                  <div className="flex justify-between items-center border-t pt-4">
                    <span className="text-2xl font-black text-blue-600">฿{car.price?.toLocaleString()}</span>
                    <button className="bg-gray-900 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-600 transition">
                      ดูข้อมูลเพิ่มเติม
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* กรณีไม่มีรถในระบบ */}
        {!loading && cars.length === 0 && (
          <div className="bg-white p-12 text-center rounded-xl shadow-inner">
            <p className="text-gray-400 text-lg">ขณะนี้ยังไม่มีรถในรายการ</p>
          </div>
        )}
      </main>
    </div>
  );
}
