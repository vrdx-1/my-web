'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
  // แก้ไขตรงนี้: เติม <any[]> เพื่อให้ Vercel ไม่แจ้ง Error เรื่องชนิดข้อมูล
  const [cars, setCars] = useState<any[]>([])
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Sedan')

  // ดึงข้อมูลรถจาก Database
  const fetchCars = async () => {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error) setCars(data || [])
  }

  useEffect(() => {
    fetchCars()
  }, [])

  // ฟังก์ชันเพิ่มรถ
  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('cars').insert([
      { brand, model, price: parseInt(price), category }
    ])

    if (!error) {
      alert('เพิ่มรถเรียบร้อยแล้ว!')
      setBrand('')
      setModel('')
      setPrice('')
      fetchCars()
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  // ฟังก์ชันลบรถ
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('cars').delete().eq('id', id)
    if (!error) fetchCars()
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">ระบบจัดการหลังบ้าน (เจ้าของเท่านั้น)</h1>
      
      <form onSubmit={handleAddCar} className="bg-slate-50 p-6 rounded-lg border mb-10">
        <h2 className="text-blue-700 font-semibold mb-4">เพิ่มรถเข้าสู่หน้าเว็บ</h2>
        <div className="grid grid-cols-2 gap-4">
          <input 
            className="border p-2 rounded" 
            placeholder="ยี่ห้อ (เช่น Toyota)" 
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            required
          />
          <input 
            className="border p-2 rounded" 
            placeholder="รุ่น (เช่น Camry)" 
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
          />
          <input 
            className="border p-2 rounded" 
            type="number" 
            placeholder="ราคา (บาท)" 
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <select 
            className="border p-2 rounded"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="Sedan">Sedan</option>
            <option value="SUV">SUV</option>
            <option value="Pickup">Pickup</option>
            <option value="Van">Van</option>
          </select>
        </div>
        <button type="submit" className="w-full mt-4 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          ลงประกาศขายรถ
        </button>
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3">รายการรถ</th>
              <th className="p-3">หมวดหมู่</th>
              <th className="p-3">ราคา</th>
              <th className="p-3">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => (
              <tr key={car.id} className="border-t">
                <td className="p-3">{car.brand} {car.model}</td>
                <td className="p-3">{car.category}</td>
                <td className="p-3">{car.price?.toLocaleString()} บาท</td>
                <td className="p-3">
                  <button 
                    onClick={() => handleDelete(car.id)}
                    className="text-red-500 hover:underline"
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
