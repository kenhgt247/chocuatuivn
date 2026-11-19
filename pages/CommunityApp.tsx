import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import ShareModal from '../components/ShareModal';
import { db } from '../services/db';
import {
  community, kindLabels, nextStatuses, statusLabels, MAX_PHOTOS,
  type CommunityKind, type CommunityIntent, type CommunityListing,
  type CommunityRequest, type CommunityStatus
} from '../services/community';
import type { User } from '../types';

const choices: {key:CommunityKind; icon:string; hint:string; color:string}[] = [
  {key:'gift',icon:'🎁',hint:'Đồ còn tốt để tặng',color:'bg-emerald-50 text-emerald-800'},
  {key:'borrow',icon:'🤝',hint:'Dùng rồi hoàn trả',color:'bg-emerald-50 text-emerald-800'},
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

function Card({item}:{item:CommunityListing;key?:React.Key}) {
  const category = choices.find(x=>x.key===item.communityKind) || choices[0];
  return <Link to={'/cong-dong/tin/'+item.id} className="rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition">
    {item.images?.[0] ? <img src={item.images[0]} alt={item.title} className="h-44 w-full object-cover" loading="lazy"/> :
      <div className={'h-40 grid place-items-center text-6xl '+category.color}>{category.icon}</div>}
    <div className="p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={'text-xs rounded-full px-3 py-1 font-semibold '+category.color}>{category.icon} {kindLabels[category.key]}</span>
        <span className="text-xs rounded-full px-3 py-1 font-semibold bg-slate-100 text-slate-600">{item.communityIntent==='need'?'Tôi cần':'Tôi có'}</span>
      </div>
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
  const [search,setSearch]=useState(()=>new URLSearchParams(window.location.search).get('search')||'');
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
  const [photos,setPhotos]=useState<File[]>([]);
  const previews=useMemo(()=>photos.map(f=>URL.createObjectURL(f)),[photos]);
  useEffect(()=>()=>previews.forEach(u=>URL.revokeObjectURL(u)),[previews]);
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
      await community.create(user,{title,description,location,photos,kind,intent,approximateCoords});
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
      <div><label htmlFor="community-photo" className="font-semibold block mb-2">📷 Ảnh (tối đa {MAX_PHOTOS}, không bắt buộc)</label>
        <input id="community-photo" type="file" accept="image/*" multiple className="block w-full rounded-xl border p-3 text-sm"
          onChange={e=>{const files=Array.from(e.target.files||[]);setPhotos(prev=>[...prev,...files].slice(0,MAX_PHOTOS));e.target.value='';}}/>
        {photos.length>0&&<div className="flex gap-2 mt-3 flex-wrap">{previews.map((u,i)=>
          <div key={u} className="relative"><img src={u} alt="" className="h-20 w-20 rounded-xl object-cover border"/>
            <button type="button" aria-label="Bỏ ảnh" onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border text-xs">✕</button></div>)}</div>}
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
  const [photoIndex,setPhotoIndex]=useState(0);
  const [saved,setSaved]=useState(false);
  const [sharing,setSharing]=useState(false);
  const [reported,setReported]=useState(false);
  useEffect(()=>{if(!user)return;community.savedIds(user.id).then(ids=>setSaved(ids.includes(id)));},[user?.id,id]);
  useEffect(()=>{let alive=true;setLoading(true);community.detail(id).then(x=>{if(alive)setItem(x)}).catch(e=>{if(alive)setError(e?.message||'Không tải được tin')}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[id]);
  if(loading)return <p>Đang tải tin thật…</p>;
  if(error)return <ErrorMessage message={error}/>;
  if(!item)return <div className="bg-white p-8 rounded-2xl">Tin không tồn tại hoặc đã ẩn. <Link className="underline" to="/">Về trang chủ</Link></div>;
  const kind=choices.find(x=>x.key===item.communityKind)||choices[0];
  async function send() {
    if(!item||!user)return nav('/login');
    setSending(true);setError('');
    try {const result=await community.request(item,message); if(result.startsWith('chat:')){nav('/chat/'+result.slice(5));return;} setDone(true)}
    catch(e:any){setError(e?.message||'Không gửi được yêu cầu')}
    finally{setSending(false)}
  }
  async function toggleSave(){
    if(!user)return nav('/login');
    setSaved(v=>!v);
    try{await community.toggleSave(user.id,id)}catch(_){setSaved(v=>!v);setError('Chưa lưu được tin, thử lại nhé.')}
  }
  async function report(){
    if(!user)return nav('/login');
    const reason=window.prompt('Tin này có vấn đề gì? (ví dụ: đòi tiền, lừa đảo, nội dung xấu)');
    if(!reason||!item)return;
    try{await db.reportListing({listingId:item.id,targetUserId:item.sellerId,userId:user.id,reason:reason.slice(0,300)});setReported(true)}
    catch(_){setError('Chưa gửi được báo cáo.')}
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
      {item.images?.length?<div className="bg-slate-900">
        <img className="w-full max-h-[28rem] object-contain" src={item.images[Math.min(photoIndex,item.images.length-1)]} alt={item.title}/>
        {item.images.length>1&&<div className="flex gap-2 p-3 overflow-x-auto bg-white border-b">{item.images.map((u,i)=>
          <button key={u} onClick={()=>setPhotoIndex(i)} aria-label={'Ảnh '+(i+1)} className={'shrink-0 rounded-lg overflow-hidden border-2 '+(i===photoIndex?'border-emerald-700':'border-transparent')}><img src={u} alt="" className="h-16 w-16 object-cover"/></button>)}</div>}
      </div>:
      <div className={'h-52 grid place-items-center text-7xl '+kind.color}>{kind.icon}</div>}
      <div className="p-5 md:p-8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={'rounded-full px-3 py-1 text-sm font-bold '+kind.color}>{kind.icon} {kindLabels[kind.key]}</span>
          <span className="rounded-full px-3 py-1 text-sm font-bold bg-slate-100 text-slate-600">{item.communityIntent==='need'?'Tôi cần':'Tôi có'}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={toggleSave} className={lightButton+' !min-h-10 !px-3 text-sm'} aria-pressed={saved}>{saved?'🔖 Đã lưu':'🔖 Lưu tin'}</button>
            <button onClick={()=>setSharing(true)} className={lightButton+' !min-h-10 !px-3 text-sm'}>↗ Chia sẻ</button>
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-black mt-4">{item.title}</h1>
        <p className="text-emerald-700 font-bold mt-2">Miễn phí 100%</p>
        <p className="text-slate-500 mt-2">📍 {item.location || 'Chưa có địa bàn'}</p>
        <p className="text-slate-500 mt-1">Người đăng: <Link className="underline" to={'/profile/'+item.sellerId}>{item.sellerName || 'Thành viên'}</Link></p>
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
          {user?.id!==item.sellerId&&<p className="mt-5 text-xs text-slate-500">Không chuyển khoản hay đặt cọc cho bất kỳ ai. {reported?'Đã gửi báo cáo, cảm ơn bạn.':<button onClick={report} className="underline">Báo cáo tin này</button>}</p>}
        </div>
      </div>
    </article>
    <ShareModal isOpen={sharing} onClose={()=>setSharing(false)} url={window.location.origin+'/cong-dong/tin/'+item.id} title={item.title}/>
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
      const requester=request.requesterId===user!.id?user!:(await db.getPublicProfile(request.requesterId)) as unknown as User|null;
      if(!requester)throw new Error('Không tìm thấy thành viên.');
      const room=await db.createChatRoom(listing,requester);
      nav('/chat/'+room);
    }catch(e:any){setError(e?.message||'Không thể mở tin nhắn')}
    finally{setWorking('')}
  }
  return <div className="mx-auto max-w-3xl">
    <h1 className="text-3xl font-black mb-2">Yêu cầu của tôi</h1><p className="text-slate-500 mb-5">Theo dõi việc cho tặng, mượn và giúp đỡ. <Link to="/chat" className="text-emerald-700 underline font-semibold">Xem tin nhắn</Link></p>
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
function Saved({user}:{user:User|null}) {
  const [items,setItems]=useState<CommunityListing[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{if(!user){setLoading(false);return;}community.saved(user.id).then(setItems).finally(()=>setLoading(false));},[user?.id]);
  if(!user)return <AuthRequired/>;
  return <div>
    <h1 className="text-3xl font-black mb-2">Tin đã lưu</h1>
    <p className="text-slate-500 mb-5">Bấm "Lưu tin" ở trang chi tiết để xem lại sau.</p>
    {loading?<p className="text-slate-500">Đang tải…</p>:!items.length?<p className="rounded-2xl bg-white border p-6 text-slate-500">Chưa lưu tin nào. <Link className="underline text-emerald-700" to="/">Khám phá ngay</Link></p>:
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{items.map(item=><Card item={item} key={item.id}/>)}</div>}
  </div>;
}
export { Card };
export default function CommunityApp({user}:{user:User|null}) {
  const route=useLocation().pathname;
  let body:React.ReactNode;
  if(route==='/cong-dong/dang-tin')body=<Post user={user}/>;
  else if(route==='/cong-dong/yeu-cau')body=<Requests user={user}/>;
  else if(route==='/cong-dong/da-dang')body=<Posted/>;
  else if(route==='/cong-dong/da-luu')body=<Saved user={user}/>;
  else if(route.startsWith('/cong-dong/tin/'))body=<Detail user={user} id={decodeURIComponent(route.split('/').pop()||'')}/>;
  else body=<Home/>;
  return <>{body}</>;
}
