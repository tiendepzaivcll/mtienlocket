import React, { useState, useEffect, useCallback } from "react";
import { SonnerError, SonnerSuccess, SonnerInfo } from "@/components/ui/SonnerToast";
import { Trash2, Edit, Check, X, ShieldAlert, Users, Sparkles } from "lucide-react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc, updateDoc, query, where, getDoc } from "firebase/firestore";

// Firebase Configuration from environment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase - Check if already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [adminEmail, setAdminEmail] = useState("admin@locket.app");
  const [adminPassword, setAdminPassword] = useState("");
  
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [timeValue, setTimeValue] = useState(30);
  const [loading, setLoading] = useState(false);
  
  const [editingEmail, setEditingEmail] = useState(null);
  const [editValue, setEditValue] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      setUser(result.user);
      SonnerSuccess("Thành công", "Đăng nhập admin thành công!");
      setAdminPassword("");
    } catch (err) {
      SonnerError("Lỗi", err.message || "Đăng nhập thất bại!");
    }
    setLoading(false);
  };

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const subscriptionsCollection = collection(db, "subscriptions");
      const snapshot = await getDocs(subscriptionsCollection);
      
      const data = snapshot.docs.map(doc => {
        return {
          id: doc.id,
          email: doc.data().email,
          planDays: doc.data().planDays || doc.data().planMonths * 30 || 30,
          expireAt: doc.data().expireAt,
          createdAt: doc.data().createdAt
        };
      });
      
      setEmails(data);
    } catch (err) {
      SonnerError("Lỗi", "Không tải được dữ liệu: " + err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) fetchEmails();
  }, [user, fetchEmails]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newEmail || !timeValue) return;
    setLoading(true);
    try {
      const planDays = parseInt(timeValue);
      const normalizedEmail = newEmail.toLowerCase();
      const expireAt = Date.now() + (planDays * 24 * 60 * 60 * 1000);
      
      // Check if email already exists
      const docRef = doc(db, "subscriptions", normalizedEmail);
      const existing = await getDoc(docRef);
      
      if (existing.exists()) {
        SonnerError("Lỗi", "Email này đã có gói VIP rồi!");
        setLoading(false);
        return;
      }
      
      // Create new document with email as ID
      await setDoc(docRef, {
        email: normalizedEmail,
        planDays: planDays,
        expireAt: expireAt,
        createdAt: Date.now()
      });
      
      setNewEmail("");
      setTimeValue(30);
      SonnerSuccess("Thành công", `Đã buff VIP cho ${newEmail}!`);
      await new Promise(r => setTimeout(r, 500));
      fetchEmails();
    } catch (err) {
      SonnerError("Lỗi", "Thêm thất bại: " + err.message);
    }
    setLoading(false);
  };

  const handleDelete = async (emailToDelete, docId) => {
    if (!window.confirm(`Bạn có chắc muốn xoá ${emailToDelete}?`)) return;
    try {
      await deleteDoc(doc(db, "subscriptions", docId));
      setEmails(emails.filter((item) => item.id !== docId));
      SonnerSuccess("Thành công", "Đã tiễn khách!");
    } catch (err) {
      SonnerError("Lỗi", "Xoá thất bại: " + err.message);
    }
  };

  const handleSaveEdit = async (oldEmail, docId) => {
    try {
      const normalizedNewEmail = editValue.toLowerCase();
      
      // Check if new email already exists (if different from old)
      if (normalizedNewEmail !== docId) {
        const existing = await getDoc(doc(db, "subscriptions", normalizedNewEmail));
        if (existing.exists()) {
          SonnerError("Lỗi", "Email mới này đã có gói VIP rồi!");
          return;
        }
      }
      
      // Get old document data
      const oldDocRef = doc(db, "subscriptions", docId);
      const oldDoc = await getDoc(oldDocRef);
      const oldData = oldDoc.data();
      
      // If email changed, delete old and create new
      if (normalizedNewEmail !== docId) {
        await deleteDoc(oldDocRef);
        const newDocRef = doc(db, "subscriptions", normalizedNewEmail);
        await setDoc(newDocRef, {
          ...oldData,
          email: normalizedNewEmail
        });
      } else {
        // Email didn't change, just update
        await updateDoc(oldDocRef, {
          email: normalizedNewEmail
        });
      }
      
      fetchEmails();
      setEditingEmail(null);
      SonnerSuccess("Thành công", "Đã sửa sổ bìa đỏ!");
    } catch (err) {
      SonnerError("Lỗi", "Sửa thất bại: " + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      SonnerSuccess("Thành công", "Đã đăng xuất!");
    } catch (err) {
      SonnerError("Lỗi", "Đăng xuất thất bại!");
    }
  };

  const formatDate = (ms) => {
    if (!ms) return "Không xác định";
    const d = new Date(ms);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${date}/${month}/${d.getFullYear()} ${hours}:${minutes}`;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-4 border border-gray-700">
          <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto mb-2" />
          <h2 className="text-2xl font-bold text-center text-white">Khu Vực Tuyệt Mật</h2>
          <input
            type="email"
            placeholder="Email admin..."
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            className="input input-bordered w-full bg-gray-900 text-white placeholder-gray-500 border-gray-600 focus:border-amber-500"
            required
          />
          <input
            type="password"
            placeholder="Nhập mật khẩu..."
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="input input-bordered w-full bg-gray-900 text-white placeholder-gray-500 border-gray-600 focus:border-amber-500"
            required
          />
          <button type="submit" disabled={loading} className="btn bg-amber-500 hover:bg-amber-600 text-black border-none text-lg">
            {loading ? "Đang kết nối..." : "Mở Cổng"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold">Quản Lý Gói Subscriptions</h1>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-outline text-red-400 hover:bg-red-500 hover:text-white">
            Đăng Xuất
          </button>
        </div>

        <form onSubmit={handleAdd} className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">➕ Thêm Gói VIP Mới</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Email Input */}
            <div className="lg:col-span-2">
              <label className="block text-sm text-gray-300 mb-2">Email</label>
              <input
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="input input-bordered w-full bg-gray-900 border-gray-600 focus:border-amber-500 text-white placeholder-gray-500"
                required
              />
            </div>

            {/* Days Input */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Số Ngày</label>
              <input
                type="number"
                min="1"
                max="3650"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="input input-bordered w-full bg-gray-900 border-gray-600 focus:border-amber-500 text-white"
                required
              />
            </div>

            {/* Submit Button */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">&nbsp;</label>
              <button type="submit" disabled={loading} className="btn bg-green-600 hover:bg-green-700 text-white border-none w-full">
                {loading ? "..." : "Thêm"}
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-2">Hoặc chọn nhanh:</p>
            <div className="flex flex-wrap gap-2">
              <button 
                type="button"
                onClick={() => setTimeValue(7)}
                className="btn btn-xs btn-ghost bg-gray-700 hover:bg-gray-600 text-white border-none"
              >
                7 Ngày
              </button>
              <button 
                type="button"
                onClick={() => setTimeValue(30)}
                className="btn btn-xs btn-ghost bg-gray-700 hover:bg-gray-600 text-white border-none"
              >
                30 Ngày
              </button>
              <button 
                type="button"
                onClick={() => setTimeValue(90)}
                className="btn btn-xs btn-ghost bg-gray-700 hover:bg-gray-600 text-white border-none"
              >
                90 Ngày
              </button>
              <button 
                type="button"
                onClick={() => setTimeValue(365)}
                className="btn btn-xs btn-ghost bg-gray-700 hover:bg-gray-600 text-white border-none"
              >
                365 Ngày
              </button>
              <button 
                type="button"
                onClick={() => setTimeValue(730)}
                className="btn btn-xs btn-ghost bg-gray-700 hover:bg-gray-600 text-white border-none"
              >
                2 Năm
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto bg-gray-800 rounded-2xl border border-gray-700 shadow-xl">
          <table className="table w-full text-left">
            <thead className="text-gray-400 bg-gray-900">
              <tr>
                <th className="py-4 px-4 text-base">STT</th>
                <th className="py-4 px-4 text-base w-full">Email Đăng Ký</th>
                <th className="py-4 px-4 text-base whitespace-nowrap">Thời Hạn</th>
                <th className="py-4 px-4 text-base whitespace-nowrap">Trạng Thái</th>
                <th className="py-4 px-4 text-base whitespace-nowrap">Hết Hạn Lúc</th>
                <th className="py-4 px-4 text-base text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-8 text-white">Đang tải dữ liệu...</td></tr>
              ) : emails.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">Chưa có ai đăng ký gói!</td></tr>
              ) : (
                emails.map((item, index) => {
                  const isExpired = item.expireAt < Date.now();
                  return (
                    <tr key={item.id} className={`border-b border-gray-700 hover:bg-gray-600 ${index % 2 === 0 ? "bg-gray-750" : "bg-gray-700"} text-white`}>
                      <td className="px-4 py-3 font-semibold text-amber-400">{index + 1}</td>
                      <td className="px-4 py-3 font-medium">
                        {editingEmail === item.id ? (
                          <input type="email" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="input input-sm input-bordered w-full bg-gray-900 text-white border-amber-500" />
                        ) : item.email}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="badge badge-outline badge-sm">{item.planDays} ngày</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isExpired ? (
                          <span className="badge badge-error gap-1 text-xs">❌ Hết hạn</span>
                        ) : (
                          <span className="badge badge-success gap-1 text-xs">✅ Đang kích hoạt</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {formatDate(item.expireAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          {editingEmail === item.id ? (
                            <>
                              <button onClick={() => handleSaveEdit(item.email, item.id)} className="btn btn-sm btn-circle bg-green-600 hover:bg-green-700 text-white border-none" title="Lưu"><Check size={16}/></button>
                              <button onClick={() => setEditingEmail(null)} className="btn btn-sm btn-circle bg-gray-600 hover:bg-gray-700 text-white border-none" title="Hủy"><X size={16}/></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingEmail(item.id); setEditValue(item.email); }} className="btn btn-sm btn-circle bg-blue-600 hover:bg-blue-700 text-white border-none" title="Sửa email"><Edit size={16}/></button>
                              <button onClick={() => handleDelete(item.email, item.id)} className="btn btn-sm btn-circle bg-red-600 hover:bg-red-700 text-white border-none" title="Xoá"><Trash2 size={16}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
