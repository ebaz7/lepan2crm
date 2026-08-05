
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical Application Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 p-6 text-center" dir="rtl">
          <div className="glass-panel p-8 rounded-2xl shadow-2xl border border-red-100 max-w-md w-full animate-fade-in">
            <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-600" size={40} />
            </div>
            <h1 className="text-2xl font-black text-gray-800 mb-2">خطای سیستمی</h1>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              متاسفانه برنامه با یک خطای غیرمنتظره مواجه شد.<br/>
              لطفاً صفحه را رفرش کنید.
            </p>
            
            <div className="bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 p-4 rounded-xl text-left dir-ltr mb-6 overflow-auto max-h-40 border border-gray-200/50 dark:border-white/10">
              <code className="text-xs text-red-600 font-mono break-all font-bold">
                {this.state.error?.message || 'Unknown Error'}
              </code>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                  onClick={() => window.location.reload()} 
                  className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95 text-sm"
              >
                  <RefreshCcw size={18} />
                  <span>تلاش مجدد (رفرش)</span>
              </button>
              
              <button 
                  onClick={() => {
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(regs => {
                        for (let reg of regs) reg.unregister();
                      });
                    }
                    if ('caches' in window) {
                      caches.keys().then(names => {
                        for (let name of names) caches.delete(name);
                      });
                    }
                    window.location.href = window.location.origin + window.location.pathname + '?nocache=' + Date.now();
                  }} 
                  className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center gap-2 transition-all text-xs"
              >
                  <span>پاک‌سازی کامل کش و بروزرسانی</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
