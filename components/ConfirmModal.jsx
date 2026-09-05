'use client';
import React, { useEffect } from 'react';

export default function ConfirmModal({
  isOpen,
  title = '¿Estás seguro?',
  message = 'Esta acción no se puede deshacer.',
  confirmText = 'Sí, Continuar',
  cancelText = 'Cancelar',
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  icon = null,
  onConfirm,
  onCancel,
  loading = false
}) {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          iconBg: '#fef3c7',
          iconColor: '#d97706',
          defaultIcon: 'fa-triangle-exclamation',
          btnBg: '#f59e0b',
          btnHover: '#d97706',
          btnText: '#ffffff'
        };
      case 'primary':
        return {
          iconBg: '#e0f2fe',
          iconColor: '#0284c7',
          defaultIcon: 'fa-circle-info',
          btnBg: '#0284c7',
          btnHover: '#0369a1',
          btnText: '#ffffff'
        };
      case 'danger':
      default:
        return {
          iconBg: '#fee2e2',
          iconColor: '#dc2626',
          defaultIcon: 'fa-trash-can',
          btnBg: '#ef4444',
          btnHover: '#dc2626',
          btnText: '#ffffff'
        };
    }
  };

  const v = getVariantStyles();

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel?.();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 440,
          width: '100%',
          padding: '1.75rem 1.5rem',
          borderRadius: 20,
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          textAlign: 'center',
          animation: 'modalPop 0.2s ease-out'
        }}
      >
        {/* Icon Header */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: v.iconBg,
            color: v.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.45rem',
            margin: '0 auto 1.25rem'
          }}
        >
          <i className={`fa-solid ${icon || v.defaultIcon}`}></i>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '0.6rem',
            lineHeight: 1.3
          }}
        >
          {title}
        </h3>

        {/* Message */}
        <div
          style={{
            fontSize: '0.92rem',
            color: '#475569',
            lineHeight: 1.5,
            marginBottom: '1.5rem',
            textAlign: 'center',
            wordBreak: 'break-word'
          }}
        >
          {message}
        </div>

        {/* Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.9rem',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0'
            }}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '0.9rem',
              background: v.btnBg,
              color: v.btnText,
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <i className="fa-solid fa-spinner fa-spin"></i>}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
