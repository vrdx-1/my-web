'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  // แก้ไขจุดนี้: เติม <any[]> เพื่อให้ Vercel ยอมรับข้อมูลจาก Database
  const [cars, setCars] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCars = async () => {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (!error) {
        setCars(data || [])
      }
      setLoading(false)
    }

    fetchCars()
  }, [])

  if (loading) return <div className="p-10 text-center">กำลังโหลดข้อมูลรถ...</div>

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">โชว์รูมรถมือสองคุณภาพ</h1>
          <div className="space-x-4 text-sm">
            <span>ติดต่อเรา: 08x-xxx-xxxx</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-white p-8 text-center border-b">
        <h2 className="text-3xl font-bold text-gray-800">ค้นหารถในฝันของคุณ</h2>
        <p className="text-gray-600 mt-2">รวมรถบ้านสภาพดี ราคาเป็นกันเอง</p>
      </div>

      {/* Car List */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cars.map((car) => (
            <div key={car.id} className="bg-white rounded-xl shadow-md overflow-hidden border hover:shadow-xl transition-shadow">
              <div className="h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                {/* ส่วนนี้อนาคตไว้ใส่รูปภาพ */}
                <span className="text-xs">ไม่มีรูปภาพ</span>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{car.brand} {car.model}</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{car.category}</span>
                  </div>
                  <p className="text-blue-600 font-bold text-lg">
                    ฿{car.price?.toLocaleString()}
                  </p>
                </div>
                <button className="w-full mt-4 bg-gray-800 text-white py-2 rounded-lg hover:bg-black transition-colors">
                  ดูรายละเอียด
                </button>
              </div>
            </div>
          ))}
        </div>

        {cars.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            ยังไม่มีรายการรถในขณะนี้
          </div>
        )}
      </div>
    </main>
  )
}