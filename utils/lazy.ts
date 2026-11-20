/**
 * Web vừa cập nhật mà tab cũ còn mở: các tệp JS cũ đã bị thay tên trên máy chủ.
 * Khi tải một trang chưa mở lần nào (vd. trang hồ sơ), tệp cũ không còn -> trang trắng, phải F5.
 * Ở đây: tải lỗi thì thử lại một lần, vẫn lỗi thì tự tải lại cả trang (tối đa 1 lần mỗi 15 giây).
 */
import React from 'react';

const KEY = 'ccut-reload-at';
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 15000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch (_) { /* bỏ qua */ }
  window.location.reload();
  return true;
}

export function lazyRetry<T extends React.ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return React.lazy(async () => {
    try { return await load(); }
    catch (e) {
      try { return await load(); }
      catch (e2) {
        if (reloadOnce()) return new Promise<{ default: T }>(() => {}); // đang tải lại trang
        throw e2;
      }
    }
  });
}
