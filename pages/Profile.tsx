import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Listing } from '../types';
import ListingCard from '../components/ListingCard';
import { LOCATIONS } from '../constants';
import { formatPrice } from '../utils/format';
import { getLocationFromCoords } from '../utils/locationHelper';
import { compressAndGetBase64 } from '../utils/imageCompression';

// Map
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Icons
import {
  Camera, Settings, Package, Heart, Shield, LogOut, Upload, MapPin,
  User as UserIcon, Mail, Phone, Crown, Diamond, CheckCircle,
  AlertTriangle, Loader2, CreditCard, ChevronRight, Edit2, ShieldCheck,
  FileText, Clock, Zap, Trash2, MessageCircle
} from 'lucide-react';

/* ---------------- MAP ICON FIX ---------------- */
L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/* ---------------- DRAG MARKER ---------------- */
const DraggableMarker = ({
  position,
  onChange,
}: {
  position: { lat: number; lng: number };
  onChange: (lat: number, lng: number) => void;
}) => {
  const ref = useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      draggable
      position={position}
      ref={ref}
      eventHandlers={{
        dragend() {
          const p = ref.current?.getLatLng();
          if (p) onChange(p.lat, p.lng);
        },
      }}
    />
  );
};

/* ================= COMPONENT ================= */
interface Props {
  user: User | null;
  onLogout: () => void;
  onUpdateUser: (u: User) => void;
}

const Profile: React.FC<Props> = ({ user, onLogout, onUpdateUser }) => {
  /* 🚫 KHÔNG USER → KHÔNG RENDER */
  if (!user) return null;

  /* ---------------- STATE ---------------- */
  const [tab, setTab] = useState<'listings' | 'favorites' | 'settings'>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---------------- FORM ---------------- */
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    location: user.location || 'TPHCM',
    address: user.address || '',
    lat: user.lat || 10.762622,
    lng: user.lng || 106.660172,
  });

  /* ---------------- LOAD DATA (SAFE) ---------------- */
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        const [all, s, favIds] = await Promise.all([
          db.getListings(true),
          db.getSettings(),
          db.getFavorites(user.id),
        ]);

        if (!alive) return;

        setSettings(s);
        setListings(all.filter(l => String(l.sellerId) === String(user.id)));
        setFavorites(all.filter(l => favIds.includes(l.id)));
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => { alive = false; };
  }, [user.id]);

  /* ---------------- SUBSCRIPTION INFO ---------------- */
  const subscription = useMemo(() => {
    if (!user.subscriptionExpires || user.subscriptionTier === 'free') {
      return { tier: 'free', days: 0, expired: true };
    }
    const exp = new Date(user.subscriptionExpires).getTime();
    const now = Date.now();
    const diff = Math.ceil((exp - now) / 86400000);
    return {
      tier: diff > 0 ? user.subscriptionTier : 'free',
      days: diff > 0 ? diff : 0,
      expired: diff <= 0,
    };
  }, [user]);

  /* ---------------- HANDLERS ---------------- */
  const saveProfile = async () => {
    const updated = await db.updateUserProfile(user.id, form);
    onUpdateUser(updated);
    alert('Đã cập nhật');
  };

  const changeLocation = async (lat: number, lng: number) => {
    const info = await getLocationFromCoords(lat, lng);
    setForm(f => ({ ...f, lat, lng, address: info.address, location: info.city }));
  };

  /* ================= RENDER ================= */
  return (
    <div className="max-w-6xl mx-auto px-4 pb-24 space-y-8 font-sans">
      {/* HEADER */}
      <div className="bg-white rounded-3xl p-8 shadow">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <img
            src={user.avatar}
            alt=""
            className="w-32 h-32 rounded-2xl object-cover shadow"
          />

          <div className="flex-1 space-y-2">
            <h1 className="text-3xl font-black">{user.name}</h1>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Mail className="w-4 h-4" /> {user.email}
            </p>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Phone className="w-4 h-4" /> {user.phone || 'Chưa có'}
            </p>
          </div>

          <button
            onClick={onLogout}
            className="text-red-500 font-bold text-sm"
          >
            <LogOut className="inline w-4 h-4 mr-1" /> Đăng xuất
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-gray-100 rounded-2xl p-1">
        {[
          ['listings', 'Tin đăng', Package],
          ['favorites', 'Đã lưu', Heart],
          ['settings', 'Cài đặt', Settings],
        ].map(([k, label, Icon]: any) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2
              ${tab === k ? 'bg-white shadow text-primary' : 'text-gray-400'}
            `}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {loading && <div className="text-center py-20">Đang tải…</div>}

      {!loading && tab === 'listings' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {listings.map(l => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

      {!loading && tab === 'favorites' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {favorites.map(l => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

      {!loading && tab === 'settings' && (
        <div className="bg-white p-8 rounded-3xl shadow space-y-8">
          <div>
            <label className="text-xs font-bold">Họ tên</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full p-4 rounded-xl bg-gray-50"
            />
          </div>

          <div>
            <label className="text-xs font-bold">Số điện thoại</label>
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full p-4 rounded-xl bg-gray-50"
            />
          </div>

          <div className="aspect-video rounded-2xl overflow-hidden">
            <MapContainer
              center={[form.lat, form.lng]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <DraggableMarker
                position={{ lat: form.lat, lng: form.lng }}
                onChange={changeLocation}
              />
            </MapContainer>
          </div>

          <button
            onClick={saveProfile}
            className="bg-primary text-white px-8 py-4 rounded-xl font-black"
          >
            Lưu thay đổi
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;
