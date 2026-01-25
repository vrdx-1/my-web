'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component for catching React errors
 * Prevents entire app from crashing when errors occur
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send error to monitoring service (e.g., Sentry) in production
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          background: '#f5f5f5',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#fff',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            maxWidth: '500px',
            width: '100%'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#e74c3c',
              marginBottom: '16px'
            }}>
              ເກີດຂໍ້ຜິດພາດ
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#666',
              marginBottom: '24px',
              lineHeight: '1.5'
            }}>
              ມີບາງຢ່າງຜິດພາດເກີດຂຶ້ນ. ກະລຸນາລອງໃໝ່ອີກຄັ້ງ.
            </p>
            <button
              onClick={this.handleReset}
              style={{
                background: '#007bff',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#0056b3'}
              onMouseOut={(e) => e.currentTarget.style.background = '#007bff'}
            >
              ລອງໃໝ່
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                marginTop: '24px',
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#666'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px', fontWeight: 'bold' }}>
                  Error Details (Development Only)
                </summary>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  marginTop: '8px',
                  fontSize: '11px'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
