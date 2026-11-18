import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import NotificationMenu from '../components/NotificationMenu';
import { db } from '../services/db';
import {
  community, kindLabels, nextStatuses, statusLabels,
  type CommunityKind, type CommunityIntent, type CommunityListing,
  type CommunityRequest, type CommunityStatus
} from '../services/community';
import type { User } from '../types';

const choices: {key:CommunityKind; icon:string; hint:string; color:string}[] = [
  {key:'gift',icon:'🎁',hint:'Đồ còn tốt để tặng',color:'bg-emerald-50 text-emerald-800'},
  {key:'borrow',icon:'🤝',hint:'Dùng rồi hoàn trả',color:'bg-blue-50 text-blue-800'},
  {key:'help',icon:'💚',hint:'Hỗ trợ một việc nhỏ',color:'bg-orange-50 text-orange-800'},
  {key:'repair',icon:'🛠️',hint:'Tìm người biết sửa',color:'bg-violet-50 text-violet-800'}
];
const commonButton = 'min-h-12 rounded-2xl px-5 font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';
const primaryButton = commonButton + ' bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60';
const lightButton = commonButton + ' bg-white border border-slate-200 text-slate-700 hover:bg-slate-50';
const inputClass = 'w-full min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600';

function ErrorMessage({message}:{message:string}) {
  return <p role="alert" className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{message}</p>;
}

function CommunityHeader({user}:{user:User|null}) {
  const [askingPush,setAskingPush]=useState(false);
  const [pushNotice,setPushNotice]=useState('');
  async function enablePush() {
    if(!user)return;
    setAskingPush(true);
    try {
      await db.requestNotificationPermission(user.id);
      setPushNotice('Đã gửi yêu cầu bật thông báo trên thiết bị.');
    } catch (_) { setPushNotice('Thiết bị hoặc trình duyệt chưa hỗ trợ thông báo.'); }
    finally {setAskingPush(false);}
  }
  return <>
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Chợ Của Tui - Trang chủ">
          <span className="grid place-items-center h-10 w-10 rounded-2xl bg-emerald-700 text-white text-2xl" aria-hidden="true">🌿</span>
          <span className="text-lg md:text-xl leading-none font-black text-emerald-900">Chợ Của Tui<span className="hidden sm:block text-xs mt-1 font-medium text-slate-500">Có gì chia sẻ, cần gì có nhau</span></span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/cong-dong/dang-tin" className="hidden sm:flex items-center justify-center rounded-xl bg-emerald-700 text-white font-bold px-4 h-10">＋ Đăng tin</Link>
          {user ? <>
            <NotificationMenu userId={user.id}/>
            <Link to="/cong-dong/yeu-cau" className="min-h-10 min-w-10 flex items-center justify-center text-xl" title="Yêu cầu của tôi">💬</Link>
            <button onClick={enablePush} disabled={askingPush} title="Bật thông báo" className="min-h-10 min-w-10 flex items-center justify-center text-xl">🔔</button>
          </> : <Link to="/login" className="rounded-xl border border-emerald-700 text-emerald-800 px-4 py-2 text-sm font-bold">Đăng nhập</Link>}
        </div>
      </div>
      {pushNotice && <p role="status" className="text-center text-xs bg-emerald-50 text-emerald-800 py-2">{pushNotice} <button className="underline" onClick={()=>setPushNotice('')}>Đóng</button></p>}
    </header>
  </>;
}
function BottomNav() {
  return <nav aria-label="Điều hướng nhanh" className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
    <Link className="flex-1 flex flex-col items-center py-2 text-xs text-slate-700" to="/"><span className="text-xl">⌂</span>Khám phá</Link>
    <Link className="flex-1 flex flex-col items-center py-2 text-xs font-bold text-emerald-800" to="/cong-dong/dang-tin"><span className="text-xl">⊕</span>Đăng tin</Link>
    <Link className="flex-1 flex flex-col items-center py-2 text-xs text-slate-700" to="/cong-dong/yeu-cau"><span className="text-xl">♡</span>Yêu cầu</Link>
  </nav>;
}
function Card({item}:{item:CommunityListing;key?:React.Key}) {
  const category = choices.find(x=>x.key===item.communityKind) || choices[0];
  return <Link to={'/cong-dong/tin/'+item.id} className="rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition">
    {item.images?.[0] ? <img src={item.images[0]} alt={item.title} className="h-44 w-full object-cover" loading="lazy"/> :
      <div className={'h-40 grid place-items-center text-6xl '+category.color}>{category.icon}</div>}
    <div className="p-4">
      <span className={'text-xs rounded-full px-3 py-1 font-semibold '+category.color}>{category.icon} {kindLabels[category.key]}</span>
      <h3 className="mt-3 font-bold text-slate-900 text-base leading-snug line-clamp-2">{item.title}</h3>
      <p className="mt-2 text-sm text-slate-500 truncate">📍 {item.location || 'Chưa có khu vực'}</p>
      <div className="mt-3 text-sm font-extrabold text-emerald-700">Miễn phí · Xem chi tiết →</div>
    </div>
  </Link>;
}
function Home() {
  const [items,setItems]=useState<CommunityListing[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [kind,setKind]=useState<CommunityKind|'all'>('all');
  const [search,setSearch]=useState('');
  const [map,setMap]=useState(false);
  useEffect(()=>{let alive=true;
    community.list().then(result=>{if(alive)setItems(result)}).catch(e=>{if(alive)setError(e?.message||'Không tải được tin')}).finally(()=>{if(alive)setLoading(false)});
    return ()=>{alive=false};
  },[]);
  const filtered = useMemo(()=>items.filter(item =>
    (kind==='all'||item.communityKind===kind) &&
    (!search.trim() || [item.title,item.description,item.location].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  ),[items,kind,search]);
  const mapped = filtered.map(x=>({...x,lat:x.lat == null?null:Math.round(x.lat*100)/100,lng:x.lng == null?null:Math.round(x.lng*100)/100}));
  const first = mapped.find(x=>x.lat!=null&&x.lng!=null);
  const center:[number,number] = first?.lat!=null&&first?.lng!=null ? [first.lat,first.lng] : [21.0,105.85];
  return <>
    <div className="bg-emerald-50 rounded-3xl px-5 py-8 md:p-12 mb-7">
      <p className="text-sm font-bold text-emerald-700">🌱 CỘNG ĐỒNG CHIA SẺ · MIỄN PHÍ 100%</p>
      <h1 className="mt-3 text-3xl md:text-5xl font-black text-emerald-900 tracking-tight leading-tight">Có gì chia sẻ,<br/>cần gì có nhau.</h1>
      <p className="mt-3 text-base text-emerald-900 max-w-lg">Tặng đồ, mượn đồ, giúp nhau và sửa đồ ngay gần nhà.</p>
      <div className="flex flex-wrap gap-2 mt-6">
        <Link to="/cong-dong/dang-tin" className={primaryButton+' inline-flex items-center justify-center'}>＋ Đăng tin miễn phí</Link>
        <a href="#tim-tin" className={lightButton+' inline-flex items-center justify-center'}>Tìm quanh tôi</a>
      </div>
    </div>
    <h2 className="font-extrabold text-xl text-slate-900 mb-3">Bạn muốn làm gì?</h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">{choices.map(x=>
      <button key={x.key} onClick={()=>{setKind(x.key);document.getElementById('tim-tin')?.scrollIntoView({behavior:'smooth'})}}
        className={'text-left rounded-2xl p-4 min-h-32 border border-transparent hover:border-current '+x.color}>
        <div className="text-3xl">{x.icon}</div><div className="font-extrabold mt-2">{kindLabels[x.key]}</div><div className="text-xs opacity-75 mt-1">{x.hint}</div>
      </button>)}</div>
    <section id="tim-tin" className="scroll-mt-24">
      <div className="flex items-center gap-2 flex-wrap justify-between mb-3">
        <h2 className="text-xl font-extrabold">Mọi người đang chia sẻ</h2>
        <button onClick={()=>setMap(v=>!v)} className={lightButton+' text-sm'}>{map?'▦ Danh sách':'🗺️ Bản đồ'}</button>
      </div>
      <input className={inputClass+' mb-3'} aria-label="Tìm kiếm" placeholder="🔎 Tìm món đồ hoặc việc cần giúp…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-2">{[{key:'all' as const,label:'Tất cả'},...choices.map(x=>({key:x.key,label:kindLabels[x.key]}))].map(x=>
        <button onClick={()=>setKind(x.key)} key={x.key} className={'whitespace-nowrap rounded-full px-4 py-2 border text-sm font-semibold '+(kind===x.key?'bg-emerald-700 text-white border-emerald-700':'bg-white text-slate-600 border-slate-200')}>{x.label}</button>)}</div>
      {loading ? <p role="status" className="py-10 text-slate-600">Đang tải các tin chia sẻ thật…</p> :
       error ? <ErrorMessage message={error}/> :
       !filtered.length ? <div className="bg-white border rounded-2xl p-8 text-center"><div className="text-5xl">🌿</div><h3 className="text-xl font-bold mt-3">Chưa có tin phù hợp</h3><p className="text-slate-500 mt-2">Hãy là người chia sẻ đầu tiên trong khu vực của bạn.</p><Link className={primaryButton+' inline-flex items-center mt-5'} to="/cong-dong/dang-tin">Đăng tin đầu tiên</Link></div> :
       map ? <MapView listings={mapped} center={center}/> :
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(item=><Card item={item} key={item.id}/>)}</div>}
    </section>
  </>;
}
function Post({user}:{user:User|null}) {
  const nav=useNavigate();
  const [intent,setIntent]=useState<CommunityIntent>('have');
  const [kind,setKind]=useState<CommunityKind>('gift');
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [location,setLocation]=useState(user?.location||'');
  const [photo,setPhoto]=useState<File|null>(null);
  const [approximateCoords,setApproximateCoords]=useState<{lat:number;lng:number}|null>(null);
  const [locating,setLocating]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  if(!user)return <AuthRequired/>;
  function askLocation() {
    if(!navigator.geolocation) {setError('Thiết bị chưa hỗ trợ định vị. Bạn vẫn có thể nhập khu vực bằng chữ.'); return;}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos=>{setApproximateCoords({lat:pos.coords.latitude,lng:pos.coords.longitude});setLocating(false);setError('');},
      ()=>{setLocating(false);setError('Chưa lấy được vị trí. Bạn vẫn có thể đăng bằng tên khu vực.');},
      {timeout:10000,enableHighAccuracy:false}
    );
  }
  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if(!user)return;
    setError('');setSaving(true);
    try{
      await community.create(user,{title,description,location,photo,kind,intent,approximateCoords});
      nav('/cong-dong/da-dang');
    }catch(e:any){setError(e?.message||'Chưa đăng được tin. Thử lại nhé.')}
    finally{setSaving(false)}
  }
  return <div className="mx-auto max-w-xl">
    <Link className="text-sm text-emerald-700 font-semibold" to="/">← Trang chủ</Link>
    <h1 className="text-3xl font-black mt-4 mb-2">Đăng tin miễn phí</h1>
    <p className="text-slate-500 mb-6">Chọn nhu cầu và viết vài chữ, không cần nhập giá.</p>
    <form onSubmit={submit} className="bg-white rounded-2xl border p-5 space-y-5">
      <fieldset><legend className="font-extrabold mb-2">1. Bạn muốn làm gì?</legend>
        <div className="grid grid-cols-2 gap-2">
          {([{key:'have',label:'🙌 Tôi có',hint:'Tôi muốn chia sẻ'},{key:'need',label:'💚 Tôi cần',hint:'Tôi đang tìm giúp đỡ'}] as const).map(x=>
          <button type="button" key={x.key} aria-pressed={intent===x.key} onClick={()=>setIntent(x.key)} className={'border-2 rounded-2xl p-4 text-left '+(intent===x.key?'border-emerald-700 bg-emerald-50':'border-slate-200')}>
            <div className="font-extrabold">{x.label}</div><p className="text-xs text-slate-500 mt-1">{x.hint}</p></button>)}
        </div>
      </fieldset>
      <fieldset><legend className="font-extrabold mb-2">2. Chọn loại chia sẻ</legend><div className="grid grid-cols-2 gap-2">{choices.map(x=>
        <button key={x.key} type="button" aria-pressed={kind===x.key} onClick={()=>setKind(x.key)}
          className={'rounded-xl min-h-14 border-2 text-sm font-semibold '+(kind===x.key?'border-emerald-700 bg-emerald-50':'border-slate-200')}>
          {x.icon} {kindLabels[x.key]}</button>)}</div>
      </fieldset>
      <div><label htmlFor="community-title" className="font-extrabold block mb-2">3. Mô tả ngắn</label>
        <input id="community-title" required minLength={5} maxLength={90} className={inputClass}
          placeholder={kind==='help'?'Ví dụ: Cần giúp hướng dẫn dùng điện thoại':'Ví dụ: Có một chiếc máy khoan muốn cho mượn'}
          value={title} onChange={e=>setTitle(e.target.value)}/>
      </div>
      <div><label htmlFor="community-description" className="font-semibold block mb-2">Thông tin thêm (không bắt buộc)</label>
        <textarea id="community-description" maxLength={900} rows={3} className={inputClass} placeholder="Tình trạng đồ, thời gian phù hợp…" value={description} onChange={e=>setDescription(e.target.value)}/>
      </div>
      <div><label htmlFor="community-area" className="font-semibold block mb-2">📍 Xã/phường hoặc khu vực</label>
        <input id="community-area" required maxLength={100} className={inputClass} placeholder="Ví dụ: Phường Chí Linh, Hải Phòng" value={location} onChange={e=>setLocation(e.target.value)}/>
        <p className="text-xs text-slate-500 mt-1">Không ghi số nhà hay địa chỉ riêng.</p>
        <button type="button" onClick={askLocation} disabled={locating} className="mt-3 text-sm font-semibold underline text-emerald-700">{locating?'Đang xác định vị trí…':approximateCoords?'✓ Đã gắn vị trí gần đúng lên bản đồ':'📍 Thêm vị trí gần đúng lên bản đồ (tùy chọn)'}</button>
        {approximateCoords&&<p className="text-xs text-slate-500">Bản đồ chỉ sử dụng tọa độ làm tròn, không lưu vị trí GPS chính xác.</p>}
      </div>
      <div><label htmlFor="community-photo" className="font-semibold block mb-2">📷 Thêm 1 ảnh (không bắt buộc)</label>
        <input id="community-photo" type="file" accept="image/*" className="block w-full rounded-xl border p-3 text-sm" onChange={e=>setPhoto(e.target.files?.[0]||null)}/>
      </div>
      {error&&<ErrorMessage message={error}/>}
      <button disabled={saving} type="submit" className={primaryButton+' w-full'}>{saving?'Đang đăng…':'Đăng tin miễn phí'}</button>
      <p className="text-center text-xs text-slate-500">Tin sẽ hiển thị sau khi được duyệt. Không có phí, VIP hoặc đặt cọc.</p>
    </form>
  </div>;
}
function AuthRequired() {
  return <div className="rounded-3xl bg-white border p-8 text-center"><div className="text-5xl">🌿</div><h1 className="text-2xl font-bold mt-3">Đăng nhập để tiếp tục</h1><p className="text-slate-500 mt-2">Xem tin không cần tài khoản, chỉ đăng tin và liên hệ mới cần đăng nhập.</p>
  <Link className={primaryButton+' inline-flex items-center mt-5'} to="/login">Đăng nhập miễn phí</Link></div>;
}
function Posted() {
  return <div className="mx-auto max-w-lg rounded-3xl bg-white border p-8 text-center"><div className="text-6xl">✅</div><h1 className="text-3xl font-black mt-4">Đã nhận tin của bạn!</h1><p className="text-slate-600 mt-3">Tin được lưu trên hệ thống và đang chờ quản trị viên duyệt. Cảm ơn bạn đã chia sẻ.</p>
  <Link className={primaryButton+' inline-flex items-center mt-6'} to="/">Về trang chủ</Link></div>;
}
function Detail({user,id}:{user:User|null;id:string}) {
  const nav=useNavigate();
  const [item,setItem]=useState<CommunityListing|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('Chào bạn, tôi muốn liên hệ về tin chia sẻ này.');
  const [sending,setSending]=useState(false);
  const [done,setDone]=useState(false);
  useEffect(()=>{let alive=true;setLoading(true);community.detail(id).then(x=>{if(alive)setItem(x)}).catch(e=>{if(alive)setError(e?.message||'Không tải được tin')}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[id]);
  if(loading)return <p>Đang tải tin thật…</p>;
  if(error)return <ErrorMessage message={error}/>;
  if(!item)return <div className="bg-white p-8 rounded-2xl">Tin không tồn tại hoặc đã ẩn. <Link className="underline" to="/">Về trang chủ</Link></div>;
  const kind=choices.find(x=>x.key===item.communityKind)||choices[0];
  async function send() {
    if(!item||!user)return nav('/login');
    setSending(true);setError('');
    try {await community.request(item,message);setDone(true)}
    catch(e:any){setError(e?.message||'Không gửi được yêu cầu')}
    finally{setSending(false)}
  }
  async function chat(){
    if(!item||!user)return nav('/login');
    setSending(true);setError('');
    try {const room=await community.startChat(item,user);nav('/chat/'+room)}
    catch(e:any){setError(e?.message||'Không mở được tin nhắn')}
    finally{setSending(false)}
  }
  return <div className="mx-auto max-w-3xl">
    <Link to="/" className="text-emerald-800 font-semibold">← Khám phá</Link>
    <article className="bg-white rounded-3xl border overflow-hidden mt-4">
      {item.images?.[0]?<img className="w-full max-h-96 object-cover" src={item.images[0]} alt={item.title}/>:
      <div className={'h-52 grid place-items-center text-7xl '+kind.color}>{kind.icon}</div>}
      <div className="p-5 md:p-8">
        <span className={'rounded-full px-3 py-1 text-sm font-bold '+kind.color}>{kind.icon} {kindLabels[kind.key]}</span>
        <h1 className="text-2xl md:text-3xl font-black mt-4">{item.title}</h1>
        <p className="text-emerald-700 font-bold mt-2">Miễn phí 100%</p>
        <p className="text-slate-500 mt-2">📍 {item.location || 'Chưa có địa bàn'}</p>
        <p className="text-slate-500 mt-1">Người đăng: {item.sellerName || 'Thành viên'}</p>
        {item.description&&<p className="whitespace-pre-wrap text-slate-700 border-t mt-5 pt-5">{item.description}</p>}
        <div className="border-t mt-6 pt-5">
          {user?.id === item.sellerId ?
            <Link to="/cong-dong/yeu-cau" className={primaryButton+' inline-flex items-center'}>Xem người liên hệ</Link>:
            done ? <div role="status" className="bg-emerald-50 p-5 rounded-xl"><p className="font-bold text-emerald-800">✅ Đã gửi yêu cầu!</p><Link to="/cong-dong/yeu-cau" className="text-emerald-700 underline">Theo dõi tại đây</Link></div> :
            <div className="space-y-3">
              <label htmlFor="request-message" className="block font-bold">Bạn muốn nhắn gì với người đăng?</label>
              <textarea id="request-message" className={inputClass} rows={2} maxLength={500} value={message} onChange={e=>setMessage(e.target.value)}/>
              <div className="flex gap-2 flex-wrap">
                <button disabled={sending} onClick={send} className={primaryButton}>{sending?'Đang gửi…':item.communityIntent==='need'?'Tôi có thể giúp':'Gửi yêu cầu miễn phí'}</button>
                {user&&<button onClick={chat} disabled={sending} className={lightButton}>💬 Nhắn tin</button>}
              </div>
              {!user&&<p className="text-sm text-slate-500">Bạn sẽ được mời đăng nhập khi liên hệ.</p>}
            </div>}
          {error&&<div className="mt-4"><ErrorMessage message={error}/></div>}
        </div>
      </div>
    </article>
  </div>;
}
function Requests({user}:{user:User|null}) {
  const nav=useNavigate();
  const [items,setItems]=useState<CommunityRequest[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [working,setWorking]=useState('');
  const [tab,setTab]=useState<'received'|'sent'>('received');
  async function refresh(){
    if(!user)return;
    setLoading(true);setError('');
    try{setItems(await community.mine())}catch(e:any){setError(e?.message||'Chưa tải được các yêu cầu')}
    finally{setLoading(false)}
  }
  useEffect(()=>{if(user){void refresh()}else setLoading(false)},[user?.id]);
  if(!user)return <AuthRequired/>;
  const visible=items.filter(x=>tab==='received'?x.ownerId===user.id:x.requesterId===user.id);
  async function change(request:CommunityRequest,status:CommunityStatus){
    setWorking(request.id);setError('');
    try{await community.updateStatus(request,status);await refresh()}
    catch(e:any){setError(e?.message||'Không cập nhật được yêu cầu')}
    finally{setWorking('')}
  }
  async function chat(request:CommunityRequest) {
    setWorking(request.id);setError('');
    try{
      const listing=await community.detail(request.listingId);
      if(!listing)throw new Error('Tin đã được ẩn.');
      const requester=request.requesterId===user!.id?user!:await db.getUserById(request.requesterId);
      if(!requester)throw new Error('Không tìm thấy thành viên.');
      const room=await db.createChatRoom(listing,requester);
      nav('/chat/'+room);
    }catch(e:any){setError(e?.message||'Không thể mở tin nhắn')}
    finally{setWorking('')}
  }
  return <div className="mx-auto max-w-3xl">
    <h1 className="text-3xl font-black mb-2">Yêu cầu của tôi</h1><p className="text-slate-500 mb-5">Theo dõi việc cho tặng, mượn và giúp đỡ.</p>
    <div className="flex gap-2 mb-5">
      <button className={tab==='received'?primaryButton:lightButton} onClick={()=>setTab('received')}>Người cần tôi</button>
      <button className={tab==='sent'?primaryButton:lightButton} onClick={()=>setTab('sent')}>Tôi đã nhờ</button>
    </div>
    {error&&<ErrorMessage message={error}/>}
    {loading?<p className="text-slate-500">Đang tải yêu cầu…</p>:!visible.length?<p className="rounded-2xl bg-white border p-6 text-slate-500">Chưa có yêu cầu nào trong mục này.</p>:
    <div className="space-y-3">{visible.map(r=><article key={r.id} className="rounded-2xl bg-white border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><Link className="text-lg font-bold hover:underline" to={'/cong-dong/tin/'+r.listingId}>{r.listingTitle}</Link><span className="text-xs bg-emerald-50 text-emerald-800 rounded-full px-3 py-2 font-bold">{statusLabels[r.status]}</span></div>
      <p className="text-sm text-slate-600 mt-2">{r.message}</p>
      <p className="text-xs text-slate-500 mt-2">{kindLabels[r.kind]}</p>
      <div className="flex gap-2 flex-wrap mt-4">{nextStatuses(r,user.id).map(status=>
        <button key={status} disabled={working===r.id} onClick={()=>change(r,status)} className={status==='declined'||status==='cancelled'?lightButton:primaryButton}>{statusLabels[status]}</button>)}
        {r.status!=='declined'&&r.status!=='cancelled'&&<button disabled={working===r.id} onClick={()=>chat(r)} className={lightButton}>💬 Nhắn tin</button>}
      </div>
    </article>)}</div>}
  </div>;
}
export default function CommunityApp({user}:{user:User|null}) {
  const route=useLocation().pathname;
  let body:React.ReactNode;
  if(route==='/cong-dong/dang-tin')body=<Post user={user}/>;
  else if(route==='/cong-dong/yeu-cau')body=<Requests user={user}/>;
  else if(route==='/cong-dong/da-dang')body=<Posted/>;
  else if(route.startsWith('/cong-dong/tin/'))body=<Detail user={user} id={decodeURIComponent(route.split('/').pop()||'')}/>;
  else body=<Home/>;
  return <div className="min-h-screen bg-[#f7faf8] text-slate-900">
    <CommunityHeader user={user}/>
    <main className="max-w-6xl mx-auto px-4 py-6 md:py-9 pb-28">{body}</main>
    <footer className="border-t bg-white p-6 mb-14 md:mb-0 text-center text-sm text-slate-500">🌿 Chợ Của Tui · Mọi người cùng chia sẻ · Hoàn toàn miễn phí</footer>
    <BottomNav/>
  </div>;
}
