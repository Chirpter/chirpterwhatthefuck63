
"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signOut, 
  type User as FirebaseUser, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { logAuthEvent } from '@/lib/analytics';

interface AuthContextType {
  authUser: FirebaseUser | null; 
  loading: boolean;
  logout: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<FirebaseUser>;
  signInWithEmail: (email: string, pass: string) => Promise<FirebaseUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ✅ CRITICAL: Logic tạo session cookie được chuyển vào đây.
async function setSessionCookie(idToken: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Session creation failed: ${errorData.error || response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to set session cookie:', error);
    // Ném lại lỗi để logic gọi nó (ví dụ: signUpWithEmail) có thể bắt và xử lý.
    throw error;
  }
}

// ✅ CRITICAL: Logic xóa session cookie được chuyển vào đây.
async function clearSessionCookie(): Promise<void> {
  try {
    // Không cần chờ response, chỉ cần gửi yêu cầu đi.
    fetch('/api/auth/session', { method: 'DELETE' });
  } catch (error) {
    console.error('⚠️ Failed to clear session cookie:', error);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ FIXED: Cải tiến logic rollback để xử lý lỗi tạo session một cách an toàn.
  const signUpWithEmail = async (email: string, pass: string) => {
    let userCredential;
    
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const idToken = await userCredential.user.getIdToken();
      
      // Nếu setSessionCookie thất bại, nó sẽ ném lỗi và được bắt bởi khối catch.
      await setSessionCookie(idToken);
      
      logAuthEvent('sign_up', { method: 'email' });
      return userCredential.user;
      
    } catch (error) {
      // ✅ Rollback: Nếu có lỗi (bao gồm cả lỗi tạo session), xóa tài khoản người dùng vừa tạo.
      if (userCredential) {
        console.warn('⚠️ Rolling back user creation due to session/other failure.');
        try {
          await userCredential.user.delete();
        } catch (deleteError) {
          console.error('❌ Failed to rollback user creation:', deleteError);
        }
      }
      
      // Ném lại lỗi ban đầu để UI có thể hiển thị thông báo.
      throw error;
    }
  };
  
  // ✅ FIXED: Cải tiến logic rollback cho việc đăng nhập.
  const signInWithEmail = async (email: string, pass: string) => {
    let userCredential;
    
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const idToken = await userCredential.user.getIdToken();
      
      // Nếu setSessionCookie thất bại, nó sẽ ném lỗi.
      await setSessionCookie(idToken);
      
      logAuthEvent('login', { method: 'email' });
      return userCredential.user;
      
    } catch (error) {
      // ✅ Rollback: Nếu tạo session thất bại, đăng xuất người dùng khỏi client.
      if (userCredential) {
        console.warn('⚠️ Rolling back sign in due to session failure.');
        try {
          await signOut(auth); // Chỉ đăng xuất, không xóa cookie vì nó chưa được tạo.
        } catch (signOutError) {
          console.error('❌ Failed to rollback sign in:', signOutError);
        }
      }
      
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      // Gọi hàm đã được chuyển vào đây.
      await clearSessionCookie();
      logAuthEvent('logout');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      // Fallback: Chuyển hướng cứng về trang đăng nhập nếu có lỗi.
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    // Lắng nghe sự thay đổi trạng thái xác thực từ Firebase client.
    const unsubscribe = onAuthStateChanged(auth, (currentAuthUser) => {
      setAuthUser(currentAuthUser);
      setLoading(false);
    });

    return unsubscribe; // Cleanup listener on unmount.
  }, []);

  const value = { 
    authUser, 
    loading, 
    logout, 
    signUpWithEmail, 
    signInWithEmail, 
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
