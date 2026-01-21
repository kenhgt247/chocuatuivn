import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ListingCard from '../components/ListingCard';
import ShareModal from '../components/ShareModal';
import ReviewSection from '../components/ReviewSection';
import OfferModal from '../components/OfferModal';
import AuctionBox from '../components/AuctionBox';
import { CATEGORIES } from '../constants';
import ProductZoom from '../components/ProductZoom';
import SwapModal from '../components/SwapModal';

// --- IMPORT FIREBASE FOR REALTIME STATUS ---
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

// --- IMPORT LEAFLET MAP ---
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// ⚠️ ĐÃ LOẠI BỎ LUCIDE-REACT ĐỂ TRÁNH LỖI CRASH
// --- BỘ ICON VẼ TAY (SVG THUẦN) ---
const IconHome = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconChevronRight = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IconChevronLeft = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const IconVolume2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>;
const IconVolumeX = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>;
const IconMaximize2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
const IconPlay = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IconPause = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const IconFlag = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
const IconMapPin = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconClock = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconEye = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconBadgeCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>;
const IconEdit = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconExternalLink = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
const IconTag = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
const IconRefreshCcw = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/></svg>;
const IconMessageCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
const IconPhone = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IconHeart = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IconShare2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
const IconFlame = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;
const IconBedDouble = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2-2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>;
const IconBath = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-1C5.5 2.5 5 5.5 5 9c0 3.5 2.5 6 5 6H19a3 3 0 0 0 3-3V9H9Z"/><line x1="5" y1="21" x2="19" y2="21"/><line x1="5" y1="15" x2="5" y2="21"/><line x1="19" y1="12" x2="19" y2="21"/></svg>;
const IconGauge = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>;
const IconCalendar = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconFuel = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>;
const IconSettings = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconHardDrive = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>;
const IconBanknote = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>;
const IconBriefcase = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
const IconInfo = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const IconScaling = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3 9 15"/><path d="M12 3H3v18h18v-9"/><path d="M16 3h5v5"/><path d="M14 15H9v-5"/></svg>;
const IconShieldCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
const IconAlertTriangle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconX = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;

// Fix Leaflet default icon issue
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const REPORT_REASONS = [
  "Lừa đảo, giả mạo",
  "Hàng giả, hàng nhái",
  "Thông tin không chính xác",
  "Hàng cấm buôn bán",
  "Sản phẩm đã bán",
  "Lý do khác"
];

const STATIC_LINKS = [
  { slug: 'gioi-thieu', title: 'Giới thiệu' },
  { slug: 'quy-che-hoat-dong', title: 'Quy chế' },
  { slug: 'chinh-sach-bao-mat', title: 'Bảo mật' },
  { slug: 'meo-mua-ban-an-toan', title: 'An toàn' },
];

// --- HELPER: GET DYNAMIC ATTRIBUTE ICON ---
const getAttributeIcon = (key: string): React.ReactNode => {
    const k = key.toLowerCase();
    const style = "w-5 h-5";

    if (k.includes('area') || k.includes('size')) return <IconScaling className={style} />;
    if (k.includes('bed')) return <IconBedDouble className={style} />;
    if (k.includes('bath')) return <IconBath className={style} />;
    if (k.includes('mileage') || k.includes('odo')) return <IconGauge className={style} />;
    if (k.includes('year') || k.includes('age')) return <IconCalendar className={style} />;
    if (k.includes('fuel') || k.includes('battery')) return <IconFuel className={style} />;
    if (k.includes('gear')) return <IconSettings className={style} />;
    if (k.includes('storage') || k.includes('ram') || k.includes('cpu')) return <IconHardDrive className={style} />;
    if (k.includes('salary') || k.includes('price') || k.includes('deposit')) return <IconBanknote className={style} />;
    if (k.includes('job') || k.includes('position')) return <IconBriefcase className={style} />;
    
    return <IconInfo className={style} />;
};

const ListingDetail: React.FC<{ user: User | null }> = ({ user }) => {
  const { slugWithId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<User | null>(null);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [activeMedia, setActiveMedia] = useState(0); 
  const [userFavorites, setUserFavorites] = useState<string[]>([]);
  
  // [NEW] Realtime Online Status State
  const [isSellerOnline, setIsSellerOnline] = useState(false);

  // Modals State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isPhoneVisible, setIsPhoneVisible] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Video Controls
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  const id = useMemo(() => {
    if (!slugWithId) return null;
    const parts = slugWithId.split('-');
    return parts[parts.length - 1];
  }, [slugWithId]);

  const mediaList = useMemo(() => {
    if (!listing) return [];
    const list = [...listing.images];
    if (listing.videoUrl) {
        list.unshift(listing.videoUrl); 
    }
    return list;
  }, [listing]);

  // -----------------------------------------------------------
  // 1. [SỬA LỖI] EFFECT RIÊNG ĐỂ TĂNG VIEW (CHỈ CHẠY 1 LẦN KHI CÓ ID)
  // -----------------------------------------------------------
  useEffect(() => {
    if (id) {
        db.incrementListingView(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // <--- QUAN TRỌNG: Chỉ phụ thuộc vào ID, bỏ 'user' ra khỏi đây để tránh lặp

  // -----------------------------------------------------------
  // 2. EFFECT ĐỂ LOAD DỮ LIỆU (CHẠY KHI ID HOẶC USER THAY ĐỔI)
  // -----------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    
    const loadListing = async () => {
        const l = await db.getListingById(id);
        if (l) {
            setListing(l);
            db.getUserById(l.sellerId).then(setSeller);
            
            // Cần user để biết đã favorite chưa
            if (user) db.getFavorites(user.id).then(setUserFavorites);
            
            db.getListings().then(setAllListings);
        }
    };
    loadListing();
    window.scrollTo(0, 0);
  }, [id, user]); // Effect này vẫn cần user để load favorite

  // Realtime Online Status Listener
  useEffect(() => {
    if (!listing?.sellerId) return;

    const dbInstance = getFirestore();
    const sellerRef = doc(dbInstance, "users", listing.sellerId);

    const unsubscribe = onSnapshot(sellerRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const isOnline = data.isOnline === true;
            
            // Check last active time (within 5 minutes)
            let isActiveRecently = true;
            if (data.lastActiveAt) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const lastActiveTime = (data.lastActiveAt as any).toMillis ? (data.lastActiveAt as any).toMillis() : new Date(data.lastActiveAt).getTime();
                const now = Date.now();
                if (now - lastActiveTime > 5 * 60 * 1000) {
                    isActiveRecently = false;
                }
            }

            setIsSellerOnline(isOnline && isActiveRecently);
        }
    });

    return () => unsubscribe();
  }, [listing?.sellerId]);

 // --- SMART RECOMMENDATION LOGIC ---
  const similarListings = useMemo(() => {
    if (!listing) return [];
    const LIMIT = 12;

    const getScore = (item: Listing, isSameCategory: boolean) => {
        let score = 0;
        if (isSameCategory) score += 1000;
        if (item.location === listing.location) score += 500;
        if (item.tier === 'pro') score += 50;
        else if (item.tier === 'basic') score += 20;
        score += new Date(item.createdAt).getTime() / 10000000000000; 
        return score;
    };
    
    const candidates = allListings.filter(l => l.id !== listing.id && l.status === 'approved');
    const sorted = candidates.sort((a, b) => {
        const scoreA = getScore(a, a.category === listing.category);
        const scoreB = getScore(b, b.category === listing.category);
        return scoreB - scoreA;
    });

    return sorted.slice(0, LIMIT);
  }, [allListings, listing]);

  if (!listing) return null;

  const categoryConfig = CATEGORIES.find(c => c.id === listing.category);
  const isVideoActive = listing.videoUrl && activeMedia === 0;
  const isOwner = user && user.id === listing.sellerId;

  // --- ACTIONS ---
  const handleToggleFav = async (targetId?: string) => {
    if (!user) return navigate('/login');
    const idToToggle = (typeof targetId === 'string') ? targetId : listing.id;
    await db.toggleFavorite(user.id, idToToggle);
    db.getFavorites(user.id).then(setUserFavorites);
  };

  const handleStartChat = async () => {
    if (!user) return navigate('/login');
    if (isOwner) return; 
    setIsChatLoading(true);
    try {
        const roomId = await db.createChatRoom(listing, user);
        navigate(`/chat/${roomId}`);
    } catch (e) { alert("Lỗi kết nối chat."); }
    finally { setIsChatLoading(false); }
  };

  const handleMakeOffer = async (offerPrice: number) => {
    if (!user) { alert("Vui lòng đăng nhập!"); return navigate('/login'); }
    if (isOwner) { alert("Bạn không thể mặc cả sản phẩm của chính mình!"); return; }

    setShowOfferModal(false);
    const result = await db.createOffer(listing, user, offerPrice);
    if (result.success) {
        alert(`✅ Đã gửi đề nghị giá ${offerPrice.toLocaleString()}đ thành công!`);
    } else {
        alert("Lỗi: " + result.message);
    }
  };

  const handleSwapSubmit = async (selectedItem: Listing, cashTopUp: number) => {
    if (!user) return;
    setIsChatLoading(true);

    try {
        const roomId = await db.createChatRoom(listing, user);
        const cashText = cashTopUp > 0 
            ? ` (bù ${formatPrice(cashTopUp)})` 
            : (cashTopUp < 0 ? ` (nhận lại ${formatPrice(Math.abs(cashTopUp))})` : "");
        const textSummary = `🔄 Đề nghị đổi: ${selectedItem.title}${cashText}`;

        const messageData = {
            senderId: user.id,
            text: textSummary, 
            type: 'swap', 
            swapData: {
                offeredItemName: selectedItem.title,
                offeredItemImage: selectedItem.images[0],
                cashTopUp: cashTopUp
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.addMessage(roomId, messageData as any);
        setShowSwapModal(false);
        alert("✅ Đã gửi đề nghị đổi đồ thành công!");
        navigate(`/chat/${roomId}`);

    } catch (e) {
        console.error(e);
        alert("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleReport = async () => {
    if (!user) return navigate('/login');
    if (!reportReason) return alert("Vui lòng chọn lý do báo cáo");
    await db.reportListing({ listingId: listing.id, userId: user.id, reason: reportReason, details: reportDetails });
    alert("Báo cáo của bạn đã được gửi.");
    setShowReportModal(false);
  };

  const handleVideoPlayPause = () => {
      if (videoRef.current) {
          if (videoRef.current.paused) {
              videoRef.current.play();
              setIsPlaying(true);
          } else {
              videoRef.current.pause();
              setIsPlaying(false);
          }
      }
  };

  return (
    <div className="max-w-7xl mx-auto md:px-4 lg:px-8 py-0 md:py-8 space-y-6 pb-24 font-sans">
      
      {/* SEO HELMET */}
      <Helmet>
        <title>{listing.title} | Chợ Của Tui</title>
        <meta property="og:title" content={listing.title} />
        <meta property="og:description" content={listing.description.substring(0, 150) + "..."} />
        <meta property="og:image" content={listing.images[0]} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="product" />
      </Helmet>

      {/* BREADCRUMB */}
      <nav className="flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 px-4 md:px-0">
        <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
            <IconHome className="w-3 h-3 mb-0.5" /> Trang chủ
        </Link>
        <IconChevronRight className="w-3 h-3 text-gray-300" />
        {categoryConfig && (
            <>
                <Link to={`/danh-muc/${categoryConfig.slug}`} className="hover:text-primary transition-colors">{categoryConfig.name}</Link>
                <IconChevronRight className="w-3 h-3 text-gray-300" />
            </>
        )}
        <span className="text-gray-900 truncate max-w-[200px]">{listing.title}</span>
      </nav>

      <div className="grid lg:grid-cols-12 gap-0 md:gap-8">
        
       {/* LEFT: MEDIA GALLERY & DETAILS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 1. Main Media (Video/Image) */}
          <div className={`relative w-full aspect-square md:aspect-video md:rounded-xl group shadow-sm border border-gray-100 z-20 overflow-hidden ${isVideoActive ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}>
            
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden select-none">
                <div className="transform -rotate-45 leading-none pointer-events-none">
                    <span className="text-white/40 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] text-sm md:text-lg font-black uppercase tracking-widest whitespace-nowrap px-4 py-2">
                        ⚡ Chợ Của Tui
                    </span>
                </div>
            </div>
            
            {isVideoActive ? (
                // VIDEO PLAYER
                <div className="relative w-full h-full cursor-pointer" onClick={handleVideoPlayPause}>
                    <video ref={videoRef} src={listing.videoUrl || ""} poster={listing.images[0] || ""} className="w-full h-full object-contain bg-black" autoPlay loop muted={isMuted} playsInline />
                    <div className="absolute bottom-6 left-6 right-6 z-30 flex justify-between items-end">
                        <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="pointer-events-auto bg-black/60 backdrop-blur-md text-white p-3 rounded-full hover:bg-primary transition-all">
                            {isMuted ? <IconVolumeX className="w-5 h-5" /> : <IconVolume2 className="w-5 h-5" />}
                        </button>
                        <div className="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse shadow-lg flex items-center gap-1">
                            {isPlaying ? <IconPlay className="w-3 h-3" /> : <IconPause className="w-3 h-3" />} Video
                        </div>
                    </div>
                </div>
            ) : (
                // IMAGE VIEWER (ĐÃ SỬA: CÓ KÍNH LÚP CHO DESKTOP)
                <>
                    {/* MOBILE: Hiển thị ảnh thường + Click mở Lightbox */}
                    <div 
                        className="md:hidden w-full h-full relative" 
                        onClick={() => setIsLightboxOpen(true)}
                    >
                        <img 
                            src={mediaList[activeMedia]} 
                            className="w-full h-full object-contain" 
                            alt={listing.title} 
                        />
                        <div className="absolute bottom-4 right-4 bg-black/50 text-white p-2 rounded-full pointer-events-none backdrop-blur-sm">
                            <IconMaximize2 className="w-4 h-4" />
                        </div>
                    </div>

                    {/* DESKTOP: Dùng ProductZoom (Kính lúp) + Click mở Lightbox */}
                    <div 
                        className="hidden md:block w-full h-full cursor-zoom-in"
                        onClick={() => setIsLightboxOpen(true)} // <--- THÊM SỰ KIỆN CLICK VÀO BAO NGOÀI
                    >
                        {/* Component này tạo hiệu ứng kính lúp */}
                        <ProductZoom src={mediaList[activeMedia]} alt={listing.title} />
                        
                        {/* Icon phóng to gợi ý */}
                        <div className="absolute bottom-4 right-4 bg-black/50 text-white p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <IconMaximize2 className="w-5 h-5" />
                        </div>
                    </div>
                </>
            )}
            
            {/* Navigation Buttons (Previous/Next) */}
            {mediaList.length > 1 && (
              <>
                <button 
                    onClick={(e) => { e.stopPropagation(); setActiveMedia(prev => prev > 0 ? prev - 1 : mediaList.length - 1); }} 
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-primary transition-all z-30 shadow-xl opacity-0 group-hover:opacity-100 hidden md:block"
                >
                    <IconChevronLeft className="w-6 h-6" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setActiveMedia(prev => prev < mediaList.length - 1 ? prev + 1 : 0); }} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-primary transition-all z-30 shadow-xl opacity-0 group-hover:opacity-100 hidden md:block"
                >
                    <IconChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* ================================================================================= */}
          {/* 2. Thumbnails List - ĐÃ FIX: ẨN TUYỆT ĐỐI THANH CUỘN + MŨI TÊN HOVER */}
          {/* ================================================================================= */}
          
          <div className="mt-4 w-full relative group">
            
            {/* CSS ĐẶC BIỆT: Bắt buộc ẩn thanh cuộn trên mọi trình duyệt */}
            <style>{`
              #thumbnails-container::-webkit-scrollbar {
                display: none; /* Ẩn cho Chrome/Safari/Opera */
              }
              #thumbnails-container {
                -ms-overflow-style: none;  /* Ẩn cho IE/Edge */
                scrollbar-width: none;  /* Ẩn cho Firefox */
              }
            `}</style>

            {/* MŨI TÊN TRÁI (Ẩn đi, chỉ hiện khi Hover chuột vào khu vực ảnh) */}
            <button 
              onClick={(e) => {
                e.preventDefault();
                const container = document.getElementById('thumbnails-container');
                if (container) container.scrollBy({ left: -200, behavior: 'smooth' });
              }}
              className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-30 w-9 h-9 bg-white shadow-lg rounded-full items-center justify-center text-gray-700 hover:text-primary hover:scale-110 transition-all border border-gray-100 opacity-0 group-hover:opacity-100 duration-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>

            {/* CONTAINER CHÍNH */}
            <div className="w-full max-w-[calc(100vw-32px)] md:max-w-full overflow-hidden">
              <div 
                id="thumbnails-container"
                // Đã xóa pb-4 xuống còn pb-1 để sát đáy hơn, không chừa chỗ cho thanh cuộn
                className="flex gap-3 overflow-x-auto pb-1 snap-x touch-pan-x scroll-smooth"
                style={{ WebkitOverflowScrolling: 'touch' }} 
              >
                {mediaList.map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveMedia(idx)} 
                    className={`
                      relative flex-shrink-0 
                      w-16 h-16 md:w-24 md:h-24 
                      rounded-xl overflow-hidden border-2 
                      snap-start transition-all duration-200
                      ${activeMedia === idx 
                        ? 'border-primary ring-2 ring-primary/20 scale-105 z-10 shadow-md' 
                        : 'border-transparent opacity-70 hover:opacity-100 hover:border-gray-300'
                      }
                    `}
                  >
                    <img 
                      src={listing.videoUrl && idx === 0 ? listing.images[0] : item} 
                      className="w-full h-full object-cover" 
                      alt={`Thumbnail ${idx}`} 
                      loading="lazy"
                    />
                    
                    {/* SVG PLAY ICON */}
                    {listing.videoUrl && idx === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600 ml-0.5">
                              <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                          </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* MŨI TÊN PHẢI (Ẩn đi, chỉ hiện khi Hover) */}
            <button 
              onClick={(e) => {
                e.preventDefault();
                const container = document.getElementById('thumbnails-container');
                if (container) container.scrollBy({ left: 200, behavior: 'smooth' });
              }}
              className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-30 w-9 h-9 bg-white shadow-lg rounded-full items-center justify-center text-gray-700 hover:text-primary hover:scale-110 transition-all border border-gray-100 opacity-0 group-hover:opacity-100 duration-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>

          </div>
          {/* ================================================================================= */}

        {/* Attributes - Vector Icons */}
          {(() => {
            const validAttributes = categoryConfig?.attributes?.filter(attr => {
                const val = listing.attributes?.[attr.key];
                return val !== null && val !== undefined && String(val).trim() !== '';
            }) || [];

            if (validAttributes.length === 0) return null;

            return (
              <div className="bg-white md:rounded-xl p-6 border border-gray-100 shadow-sm">
                <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6 border-l-4 border-primary pl-4">
                  ⚡ Thông số kỹ thuật
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                  {validAttributes.map((attr) => {
                    const value = listing.attributes?.[attr.key];
                    return (
                      <div key={attr.key} className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0 flex items-center justify-center border border-blue-100 group-hover:bg-primary group-hover:text-white transition-colors">
                          {getAttributeIcon(attr.key)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            {attr.label}
                          </p>
                          <p className="text-sm font-bold text-gray-800 truncate" title={String(value)}>
                            {value} {attr.suffix || ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {/* Description */}
          <div className="bg-white md:rounded-xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <IconEdit className="w-4 h-4 text-gray-400" /> Mô tả sản phẩm
            </h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm font-medium border-l-4 border-gray-100 pl-6 py-2">{listing.description}</p>
          </div>

          {/* Reviews */}
          <div className="bg-white md:rounded-xl p-6 border border-gray-100 shadow-sm">
            <ReviewSection targetId={listing.id} targetType="listing" currentUser={user} />
          </div>
        </div>

        {/* RIGHT: SIDEBAR */}
        <div className="lg:col-span-4 p-4 md:p-0">
          <div className="bg-white md:rounded-xl p-6 border border-gray-100 shadow-xl space-y-6 sticky top-24">
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-gray-800 leading-snug uppercase">{listing.title}</h1>
              {listing.isAuction ? (
                  <AuctionBox listing={listing} user={user} />
              ) : (
                  <p className="text-4xl font-black tracking-tighter text-primary">{listing.price > 0 ? formatPrice(listing.price) : 'Liên hệ'}</p>
              )}
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-50">
                <div className="flex items-start gap-3 text-gray-500 font-bold text-xs">
                    <IconMapPin className="w-4 h-4 text-gray-400 mt-0.5" /> <span>{listing.address || listing.location}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                    <IconClock className="w-3 h-3" /> <span>{formatTimeAgo(listing.createdAt)}</span> • 
                    <IconEye className="w-3 h-3" /> <span>{listing.viewCount} xem</span>
                </div>
              </div>
            </div>

           {/* SELLER INFO - [UPDATED: Realtime Online Status] */}
            <Link to={`/seller/${listing.sellerId}`} className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:border-primary/30 transition-all group">
                <div className="relative">
                    <img src={listing.sellerAvatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md" alt="" />
                    {/* Online Status */}
                    <div 
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors ${
                            isSellerOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                        }`}
                        title={isSellerOnline ? "Đang Online" : "Đang Offline"}
                    ></div>
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 group-hover:text-primary">{listing.sellerName}</p>
                    {seller?.verificationStatus === 'verified' ? 
                        <p className="text-[10px] font-black text-blue-500 uppercase mt-1 flex items-center gap-1"><IconBadgeCheck className="w-3 h-3" /> Đã xác thực</p> : 
                        <p className="text-[10px] font-bold text-gray-400 mt-1">Thành viên mới</p>
                    }
                </div>
            </Link>

             <div className="space-y-3">
              {(isOwner || user?.role === 'admin') ? (
                  <Link to={`/edit/${listing.id}`} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                      <IconEdit className="w-5 h-5" /> Chỉnh sửa tin này
                  </Link>
              ) : (
                  !listing.isAuction && (
                    <>
                      {listing.affiliateLink ? (
                        <a href={listing.affiliateLink} target="_blank" rel="nofollow" className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-black text-xs shadow-xl animate-bounce flex items-center justify-center gap-2">
                            <IconExternalLink className="w-5 h-5" /> MUA NGAY
                        </a>
                      ) : (
                        <div className="flex gap-2">
                            {/* 1. Nút Trả giá */}
                            <button 
                                onClick={() => { 
                                    if(!user) return navigate('/login'); 
                                    setShowOfferModal(true); 
                                }} 
                                className="flex-1 bg-green-50 text-green-600 border border-green-200 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-green-100 transition-colors flex flex-col items-center justify-center gap-1"
                            >
                                <IconTag className="w-5 h-5" />
                                <span>Trả giá</span>
                            </button>
                            
                            {/* 2. Nút Đổi đồ */}
                            <button 
                                onClick={() => { 
                                    if(!user) return navigate('/login');
                                    setShowSwapModal(true); 
                                }} 
                                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-none py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-purple-200 hover:shadow-purple-400 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-1 group"
                            >
                                <IconRefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                                <span>Đổi đồ</span>
                            </button>

                            {/* 3. Nút Chat */}
                            <button onClick={handleStartChat} disabled={isChatLoading} className="flex-[1.5] bg-primary hover:bg-primaryHover text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-primary/30 flex flex-col items-center justify-center gap-1">
                                {isChatLoading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <IconMessageCircle className="w-5 h-5" />
                                )}
                                <span>{isChatLoading ? 'Đang kết nối...' : 'Chat ngay'}</span>
                            </button>
                        </div>
                      )}

                      {/* Nút Hiện số điện thoại */}
                      {!listing.affiliateLink && seller?.phone && (
                        <button 
                            onClick={() => {
                                if(!user) return navigate('/login');
                                if(isPhoneVisible) window.location.href=`tel:${seller.phone}`;
                                else setIsPhoneVisible(true);
                            }} 
                            className="w-full bg-white border-2 border-green-500 text-green-600 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-green-50 transition-colors"
                        >
                            <IconPhone className="w-5 h-5" />
                            {isPhoneVisible ? seller.phone : 'Hiện số điện thoại'}
                        </button>
                      )}
                    </>
                  )
              )}
            </div>


            <div className="flex gap-3">
              <button 
                onClick={() => handleToggleFav(listing.id)} 
                className={`flex-1 py-4 border border-gray-200 bg-gray-50 rounded-2xl text-[10px] font-black uppercase transition-colors flex items-center justify-center gap-2 ${userFavorites.includes(listing.id) ? 'text-red-500 border-red-200 bg-red-50' : 'text-gray-500 hover:text-red-500'}`}
              >
                <IconHeart className={`w-5 h-5 ${userFavorites.includes(listing.id) ? 'fill-current' : ''}`} />
                {userFavorites.includes(listing.id) ? 'Đã lưu' : 'Lưu tin'}
              </button>
              
              <button onClick={() => setIsShareModalOpen(true)} className="flex-1 py-4 border border-gray-200 bg-gray-50 rounded-2xl text-[10px] font-black uppercase text-gray-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2">
                <IconShare2 className="w-5 h-5" /> Chia sẻ
              </button>
            </div>

            {listing.lat && listing.lng && (
                <div className="w-full h-48 rounded-2xl overflow-hidden relative border border-gray-200 mt-4 z-0">
                    <MapContainer center={[listing.lat, listing.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
                        <Marker position={[listing.lat, listing.lng]}><Popup>{listing.address || "Vị trí"}</Popup></Marker>
                    </MapContainer>
                </div>
            )}
            
            <button onClick={() => setShowReportModal(true)} className="w-full text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-red-400 transition-colors text-center pt-2 flex items-center justify-center gap-1">
                <IconFlag className="w-3 h-3" /> Báo cáo tin này
            </button>
          </div>
        </div>
      </div>

      {/* SIMILAR LISTINGS */}
      <div className="px-4 md:px-0 pt-10">
        <div className="flex items-center justify-between mb-8 px-2 border-b border-gray-100 pb-4">
          <h2 className="text-xl font-black text-gray-800 uppercase flex items-center gap-2">
            <IconFlame className="w-6 h-6 text-orange-500 fill-orange-500 animate-pulse" /> Có thể bạn thích
          </h2>
          <Link to={`/?category=${listing.category}`} className="text-xs font-black text-primary hover:underline flex items-center gap-1">
            Xem tất cả <IconChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-5">
          {similarListings.map(l => (
            <ListingCard 
                key={l.id} 
                listing={l} 
                isFavorite={userFavorites.includes(l.id)} 
                onToggleFavorite={() => handleToggleFav(l.id)} 
            />
          ))}
        </div>
      </div>

       {/* 6. FOOTER - PHIÊN BẢN PREMIUM */}
      <footer className="hidden md:block pt-20 pb-10 px-4 md:px-0 mt-10">
         <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[3rem] p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden group">
            
            {/* Hiệu ứng nền trang trí (Blob) */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60 pointer-events-none transition-opacity group-hover:opacity-100"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-yellow-50 to-orange-50 rounded-full blur-3xl -ml-20 -mb-20 opacity-40 pointer-events-none"></div>

            <div className="relative z-10 flex items-center justify-between mb-10">
               {/* Logo Footer - Đồng bộ Gradient Tech */}
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-blue-500/30">
                    <IconZap className="w-5 h-5 fill-current" />
                  </div>
                  <span className="font-black text-2xl tracking-tighter bg-gradient-to-r from-blue-700 via-blue-500 to-yellow-500 bg-clip-text text-transparent">
                    Chợ của tui
                  </span>
               </div>

               {/* Links - Style tinh tế hơn */}
               <div className="flex gap-8">
                  {STATIC_LINKS.map(link => (
                    <Link key={link.slug} to={`/page/${link.slug}`} className="text-[11px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest hover:underline decoration-2 underline-offset-4">
                        {link.title}
                    </Link>
                  ))}
               </div>
            </div>

            {/* Copyright */}
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    © 2026 ChoCuaTui.vn - Nền tảng rao vặt AI miễn phí.
                </p>
                <div className="flex gap-2 mt-2 md:mt-0">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-green-600">Đang chừo cấp phép</span>
                </div>
            </div>
         </div>
      </footer>

     {/* MODALS */}
      {showReportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative border border-gray-200">
            <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <IconAlertTriangle className="w-6 h-6 text-red-500" /> Báo cáo vi phạm
            </h3>
            <div className="space-y-5">
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 font-bold text-sm">
                  <option value="">-- Chọn lý do --</option>
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <textarea rows={3} placeholder="Chi tiết thêm..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm" />
                <div className="flex gap-3 pt-4">
                    <button onClick={() => setShowReportModal(false)} className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase bg-gray-100 text-gray-500">Hủy</button>
                    <button onClick={handleReport} className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase bg-red-500 text-white shadow-lg shadow-red-200">Gửi báo cáo</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center" onClick={() => setIsLightboxOpen(false)}>
            <button className="absolute top-4 right-4 text-white p-4 z-50 bg-white/10 rounded-full" onClick={() => setIsLightboxOpen(false)}>
                <IconX className="w-6 h-6" />
            </button>

            <img 
                src={mediaList[activeMedia]} 
                className="max-w-full max-h-full object-contain transition-transform duration-200" 
                alt="Fullscreen"
                onClick={(e) => e.stopPropagation()} 
            />
            
            {mediaList.length > 1 && (
                <>
                    <button onClick={(e) => { e.stopPropagation(); setActiveMedia(prev => prev > 0 ? prev - 1 : mediaList.length - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 p-3 text-white bg-white/10 rounded-full">
                        <IconChevronLeft className="w-8 h-8" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setActiveMedia(prev => prev < mediaList.length - 1 ? prev + 1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-white bg-white/10 rounded-full">
                        <IconChevronRight className="w-8 h-8" />
                    </button>
                </>
            )}
            
            <p className="absolute bottom-8 text-white font-bold text-sm bg-black/50 px-4 py-2 rounded-full">{activeMedia + 1} / {mediaList.length}</p>
        </div>
      )}

      {/* Modal Đổi đồ */}
      {listing && user && (
          <SwapModal 
            isOpen={showSwapModal} 
            onClose={() => setShowSwapModal(false)} 
            targetListing={listing} 
            currentUser={user} 
            onSubmit={handleSwapSubmit} 
          />
      )}
      {listing && <OfferModal isOpen={showOfferModal} onClose={() => setShowOfferModal(false)} onSubmit={handleMakeOffer} originalPrice={listing.price} productName={listing.title} />}
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} url={getListingUrl(listing)} title={listing.title} />
    </div>
  );
};

export default ListingDetail;
