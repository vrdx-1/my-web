"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // ตัวเชื่อมฐานข้อมูล

export default function AdminPage() {
  const [cars, setCars] = useState([]);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Sedan');

  // ฟังก์ชันดึงข้อมูลรถ (จะทำงานเมื่อเปิดหน้าเว็บ)
  const fetchCars = async () => {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) setCars(data || []);
  };

  useEffect(() => {
    fetchCars();
  }, []);

  // ฟังก์ชันเพิ่มข้อมูลรถ
  const addCar = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('cars')
      .insert([{ brand, model, price: parseInt(price), category }]);
    
    if (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } else {
      alert("เพิ่มรถเรียบร้อยแล้ว!");
      setBrand(''); setModel(''); setPrice('');
      fetchCars(); // โหลดรายการใหม่
    }
  };

  // ฟังก์ชันลบข้อมูลรถ
  const deleteCar = async (id: string) => {
    if (confirm("ยืนยันว่าจะลบรถคันนี้ออกจากระบบ?")) {
      const { error } = await supabase.from('cars').delete().eq('id', id);
      if (!error) fetchCars();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">ระบบจัดการหลังบ้าน (เจ้าของเท่านั้น)</h1>
        
        {/* ฟอร์มเพิ่มรถ */}
        <div className="bg-white p-6 rounded-xl shadow-sm border mb-10">
          <h2 className="text-xl font-semibold mb-4 text-blue-600">เพิ่มรถเข้าสู่หน้าเว็บ</h2>
          <form onSubmit={addCar} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="ยี่ห้อ (เช่น Toyota)" value={brand} onChange={e => setBrand(e.target.value)} className="border p-2 rounded" required />
            <input placeholder="รุ่น (เช่น Camry)" value={model} onChange={e => setModel(e.target.value)} className="border p-2 rounded" required />
            <input placeholder="ราคา (บาท)" type="number" value={price} onChange={e => setPrice(e.target.value)} className="border p-2 rounded" required />
            <select value={category} onChange={e => setCategory(e.target.value)} className="border p-2 rounded">
              <option value="Sedan">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="Pickup">Pickup</option>
            </select>
            <button type="submit" className="md:col-span-2 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">
              ลงประกาศขายรถ
            </button>
          </form>
        </div>

        {/* ตารางแสดงรายการรถเพื่อจัดการ */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-100 border-b text-gray-600">
              <tr>
                <th className="p-4">รายการรถ</th>
                <th className="p-4">หมวดหมู่</th>
                <th className="p-4">ราคา</th>
                <th className="p-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((car: any) => (
                <tr key={car.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-medium">{car.brand} {car.model}</td>
                  <td className="p-4">{car.category}</td>
                  <td className="p-4">฿{car.price.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => deleteCar(car.id)} className="text-red-500 hover:underline">
                      ลบประกาศ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
