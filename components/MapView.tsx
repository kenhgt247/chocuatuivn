import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Listing } from '../types';
import { Link } from 'react-router-dom';
import { formatPrice, getListingUrl } from '../utils/format';

// --- FIX LỖI ICON MẶC ĐỊNH CỦA LEAFLET TRONG REACT ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34], 
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- COMPONENT CẬP NHẬT TÂM BẢN ĐỒ ---
const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, 13); // Bay đến vị trí mới với zoom 13
    }, [center, map]);
    return null;
};

interface MapViewProps {
    listings: Listing[];
    center: [number, number]; // [vĩ độ, kinh độ]
}

const MapView: React.FC<MapViewProps> = ({ listings, center }) => {
    // Chỉ lấy những tin có tọa độ hợp lệ
    const validListings = listings.filter(l => l.lat && l.lng);

    return (
        <div className="w-full h-[500px] md:h-[600px] rounded-[2rem] overflow-hidden shadow-lg border-2 border-white relative z-0">
            <MapContainer 
                center={center} 
                zoom={13} 
                scrollWheelZoom={false} 
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapUpdater center={center} />

                {/* VẼ CÁC ĐIỂM (MARKERS) */}
                {validListings.map(listing => (
                    <Marker key={listing.id} position={[listing.lat!, listing.lng!]}>
                        <Popup>
                            <div className="min-w-[200px]">
                                <Link to={getListingUrl(listing)} className="flex gap-3 items-start group">
                                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                        <img 
                                            src={listing.images[0] || 'https://placehold.co/100'} 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                                            alt=""
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm text-slate-800 line-clamp-2 leading-tight group-hover:text-blue-600">
                                            {listing.title}
                                        </h3>
                                        <p className="text-red-500 font-black text-xs mt-1">
                                            {formatPrice(listing.price)}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                                            📍 {listing.address || listing.location}
                                        </p>
                                    </div>
                                </Link>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
            
            {/* Nút chỉ dẫn nhỏ */}
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm z-[1000] pointer-events-none">
                📍 {validListings.length} tin quanh đây
            </div>
        </div>
    );
};

export default MapView;