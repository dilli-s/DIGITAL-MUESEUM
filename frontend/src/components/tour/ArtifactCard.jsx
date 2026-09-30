/**
 * ArtifactCard — in-tour artifact detail overlay.
 *
 * Design decisions:
 * - Rendered via React.createPortal to document.body so it never
 *   triggers a re-render of the background PSV panorama instance.
 * - Saves and restores the visitor's exact camera angle (yaw/pitch/zoom)
 *   before/after opening via the savedCamera prop.
 * - Only renders fields that have actual data (no "N/A" blanks).
 * - Mobile-first: card slides up from bottom on small screens.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import TurntableViewer from './TurntableViewer';

function getFullUrl(url) {
  if (!url || typeof url !== 'string' || url.includes('undefined')) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes(':5000/uploads/')) {
      return url.substring(url.indexOf('/uploads/'));
    }
    if (url.includes(':5000/api/')) {
      return url.substring(url.indexOf('/api/'));
    }
    return url;
  }
  return url.startsWith('/') ? url : `/${url}`;
}

const ArtifactCard = ({ object, onClose, loading }) => {
  const overlayRef = useRef(null);

  // Trap focus and ESC key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while card open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  const card = (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(11, 11, 12, 0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0',
        animation: 'fadeIn 0.25s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '92vh',
          background: 'linear-gradient(165deg, #1C1C20 0%, #121214 100%)',
          borderRadius: '24px 24px 0 0',
          overflowY: 'auto',
          animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.85)',
          border: '1px solid rgba(201, 162, 75, 0.22)',
          borderBottom: 'none',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(201, 162, 75, 0.3) transparent',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(201, 162, 75, 0.35)' }} />
        </div>

        <div style={{ padding: '0 20px 32px' }}>

          {loading ? (
            <ArtifactCardSkeleton />
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <h2 style={{
                    margin: 0,
                    fontSize: 'clamp(1.2rem, 4vw, 1.6rem)',
                    fontWeight: 700,
                    color: '#F5F3EE',
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                    fontFamily: '"Fraunces", serif',
                  }}>
                    {object.name}
                  </h2>
                  {object.category && (
                    <span style={{
                      display: 'inline-block',
                      marginTop: 6,
                      padding: '3px 12px',
                      borderRadius: 20,
                      background: 'rgba(201, 162, 75, 0.15)',
                      border: '1px solid rgba(201, 162, 75, 0.35)',
                      color: '#C9A24B',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}>
                      {object.category}
                    </span>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  aria-label="Close artifact card"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F5F3EE',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(201, 162, 75, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(201, 162, 75, 0.5)';
                    e.currentTarget.style.color = '#C9A24B';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.color = '#F5F3EE';
                  }}
                >
                  ✕
                </button>
              </div>

              {/* ── Rotate viewer or Full Uncropped Photo (visual centerpiece) ── */}
              {object.angle_photos && object.angle_photos.length > 0 ? (
                <div style={{ marginBottom: 24 }}>
                  <TurntableViewer photos={object.angle_photos.map(getFullUrl)} />
                </div>
              ) : object.image ? (
                <div style={{
                  marginBottom: 24,
                  width: '100%',
                  borderRadius: 16,
                  background: 'radial-gradient(circle at center, rgba(32, 31, 35, 0.9) 0%, rgba(17, 17, 20, 0.98) 100%)',
                  border: '1px solid rgba(201, 162, 75, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px',
                  boxShadow: 'inset 0 2px 25px rgba(0,0,0,0.6)',
                  minHeight: 220,
                  maxHeight: 440,
                  overflow: 'hidden',
                }}>
                  <img
                    src={getFullUrl(object.image)}
                    alt={object.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 400,
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      borderRadius: 10,
                      display: 'block',
                      margin: '0 auto',
                      filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.65))',
                    }}
                  />
                </div>
              ) : null}

              {/* ── Museum placard metadata ─────────────────────────────── */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px 20px',
                marginBottom: 20,
              }}>
                {object.period_era && <MetaField label="Period / Era" value={object.period_era} />}
                {object.origin && <MetaField label="Origin" value={object.origin} />}
                {object.materials && <MetaField label="Materials" value={object.materials} />}
                {object.dimensions && <MetaField label="Dimensions" value={object.dimensions} />}
              </div>

              {/* ── Provenance / acquisition ───────────────────────────── */}
              {object.provenance && (
                <TextSection label="Provenance" text={object.provenance} />
              )}

              {/* ── Main description / curatorial text ─────────────────── */}
              {object.description && (
                <TextSection label="About This Artifact" text={object.description} />
              )}

              {/* ── Custom fields (flexible key-value) ─────────────────── */}
              {object.custom_fields && object.custom_fields.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <span style={labelStyle}>Additional Details</span>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {object.custom_fields.map((field, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 10,
                        border: '1px solid rgba(201, 162, 75, 0.15)',
                        gap: 12,
                      }}>
                        <span style={{ color: '#C9A24B', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 }}>{field.key}</span>
                        <span style={{ color: '#F5F3EE', fontSize: '0.85rem', textAlign: 'right' }}>{field.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(card, document.body);
};

// ── Sub-components ────────────────────────────────────────────────────────

const labelStyle = {
  display: 'block',
  color: '#C9A24B',
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 4,
};

const MetaField = ({ label, value }) => (
  <div>
    <span style={labelStyle}>{label}</span>
    <span style={{ color: '#F5F3EE', fontSize: '0.9rem', lineHeight: 1.4 }}>{value}</span>
  </div>
);

const TextSection = ({ label, text }) => (
  <div style={{ marginTop: 18 }}>
    <span style={labelStyle}>{label}</span>
    <p style={{
      margin: '6px 0 0',
      color: '#A8A6A0',
      fontSize: '0.9rem',
      lineHeight: 1.65,
    }}>
      {text}
    </p>
  </div>
);

const ArtifactCardSkeleton = () => (
  <div style={{ animation: 'skeletonShimmer 1.4s infinite' }}>
    {/* Title skeleton */}
    <div style={{ height: 28, width: '70%', background: 'rgba(255,255,255,0.07)', borderRadius: 6, marginBottom: 10 }} />
    <div style={{ height: 18, width: '30%', background: 'rgba(201, 162, 75, 0.2)', borderRadius: 20, marginBottom: 24 }} />
    {/* Image area skeleton */}
    <div style={{ height: 220, background: 'rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 24 }} />
    {/* Grid skeleton */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i}>
          <div style={{ height: 10, width: '50%', background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 6 }} />
          <div style={{ height: 16, background: 'rgba(255,255,255,0.09)', borderRadius: 4 }} />
        </div>
      ))}
    </div>
    {/* Text block skeleton */}
    {[...Array(3)].map((_, i) => (
      <div key={i} style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 8, width: i === 2 ? '60%' : '100%' }} />
    ))}
  </div>
);

export default ArtifactCard;
