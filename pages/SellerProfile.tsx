/**
 * Hồ sơ công khai của một thành viên: chỉ tên, ảnh, khu vực và các tin đang chia sẻ.
 * Không hiện email, số điện thoại.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { User } from '../types';
import { db } from '../services/db';
import { community, type CommunityListing } from '../services/community';
import { Card } from './CommunityApp';

const SellerProfile: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [person, setPerson] = useState<User | null>(null);
  const [items, setItems] = useState<CommunityListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id && currentUser.id === id) { nav('/profile', { replace: true }); return; }
    let alive = true;
    setLoading(true);
    Promise.all([db.getUserById(id), community.byOwner(id)])
      .then(([u, list]) => { if (alive) { setPerson(u as User | null); setItems(list); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id, currentUser?.id]);

  if (loading) return <p className="text-slate-500">Đang tải…</p>;
  if (!person) return <div className="bg-white p-8 rounded-2xl border">Không tìm thấy thành viên này. <Link className="underline" to="/">Về trang chủ</Link></div>;

  return (
    <div className="mx-auto max-w-4xl">
      <section className="bg-white rounded-3xl border border-slate-100 p-5 md:p-8 flex gap-5 items-center">
        {person.avatar ? <img src={person.avatar} alt="" className="h-20 w-20 rounded-full object-cover border" />
          : <span className="grid place-items-center h-20 w-20 rounded-full bg-emerald-50 text-3xl">🌿</span>}
        <div className="min-w-0">
          <h1 className="text-2xl font-black truncate">{person.name || 'Thành viên'}</h1>
          <p className="text-sm text-slate-500 mt-1">📍 {person.location || 'Chưa có khu vực'}{person.joinedAt ? ' · Tham gia ' + new Date(person.joinedAt).toLocaleDateString('vi-VN') : ''}</p>
          <p className="text-sm mt-2"><b className="text-emerald-700">{items.length}</b> tin đang chia sẻ</p>
        </div>
      </section>
      <h2 className="text-xl font-extrabold mt-8 mb-3">Đang chia sẻ</h2>
      {!items.length
        ? <p className="rounded-2xl bg-white border p-6 text-slate-500">Thành viên này chưa có tin nào đang hiện.</p>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{items.map(item => <Card item={item} key={item.id} />)}</div>}
    </div>
  );
};

export default SellerProfile;
