// src/components/dev/PerformanceMonitor.tsx
// Component để monitor auth performance trong development
"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/contexts/user-context';

interface PerformanceMetrics {
  authStateChanges: number;
  userStateChanges: number;
  totalRenders: number;
  lastAuthChange: number;
  lastUserChange: number;
  sessionCookieChecks: number;
}

export const PerformanceMonitor = () => {
  // ✅ FIX: Disable this component completely in production environments
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const { authUser, loading: authLoading } = useAuth();
  const { user, loading: userLoading } = useUser();
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    authStateChanges: 0,
    userStateChanges: 0,
    totalRenders: 0,
    lastAuthChange: 0,
    lastUserChange: 0,
    sessionCookieChecks: 0,
  });

  const prevAuthUserRef = useRef(authUser);
  const prevUserRef = useRef(user);
  const renderCount = useRef(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    
    const authChanged = prevAuthUserRef.current !== authUser;
    const userChanged = prevUserRef.current !== user;
    
    setMetrics(prev => ({
      authStateChanges: prev.authStateChanges + (authChanged ? 1 : 0),
      userStateChanges: prev.userStateChanges + (userChanged ? 1 : 0),
      totalRenders: renderCount.current,
      lastAuthChange: authChanged ? Date.now() - startTime.current : prev.lastAuthChange,
      lastUserChange: userChanged ? Date.now() - startTime.current : prev.lastUserChange,
      sessionCookieChecks: prev.sessionCookieChecks,
    }));

    prevAuthUserRef.current = authUser;
    prevUserRef.current = user;
  }, [authUser, user]);

  // Monitor cookie checks - This logic is the source of the CORS issue
  useEffect(() => {
    // ✅ FIX: The fetch override is removed to prevent interference with Cloud Workstation auth.
    // The component can still display other metrics, but it will no longer track fetches.
  }, []);

  const hasIssues = 
    metrics.authStateChanges > 5 || 
    metrics.userStateChanges > 5 || 
    metrics.totalRenders > 20;

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: hasIssues ? '#fee' : '#efe',
        border: `2px solid ${hasIssues ? '#f00' : '#0f0'}`,
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        maxWidth: '300px',
        zIndex: 9999,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        🔍 Auth Performance {hasIssues && '⚠️'}
      </div>
      <div style={{ display: 'grid', gap: '4px' }}>
        <div>Auth Changes: {metrics.authStateChanges}</div>
        <div>User Changes: {metrics.userStateChanges}</div>
        <div>Total Renders: {metrics.totalRenders}</div>
        <div>Cookie Checks: {metrics.sessionCookieChecks}</div>
        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ccc' }}>
          Auth: {authUser ? '✓' : '✗'} {authLoading ? '⏳' : ''}
        </div>
        <div>
          User: {user ? '✓' : '✗'} {userLoading ? '⏳' : ''}
        </div>
        {metrics.lastAuthChange > 0 && (
          <div>Last Auth: {metrics.lastAuthChange}ms</div>
        )}
        {metrics.lastUserChange > 0 && (
          <div>Last User: {metrics.lastUserChange}ms</div>
        )}
      </div>
      {hasIssues && (
        <div style={{ 
          marginTop: '8px', 
          padding: '6px', 
          background: '#fff3cd',
          borderRadius: '4px',
          color: '#856404',
        }}>
          ⚠️ Possible re-render loop detected!
        </div>
      )}
    </div>
  );
};
