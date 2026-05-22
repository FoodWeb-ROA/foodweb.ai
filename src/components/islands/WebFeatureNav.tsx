import { useCallback, useEffect, useRef, useState } from 'react';
import WebNavigator from './WebNavigator';
import { FEATURE_NODES } from '~/lib/web-nodes';
import { FEATURES } from '~/lib/features';
import './web-navigator.css';
import './web-feature-nav.css';

export default function WebFeatureNav() {
  const [scrollNode, setScrollNode] = useState<string | null>(null);
  const [floatVisible, setFloatVisible] = useState(false);
  const [modalId, setModalId] = useState<string | null>(null);
  const hubRef = useRef<HTMLDivElement>(null);

  const selectNode = useCallback((nodeId: string) => {
    const el = document.getElementById(`feature-${nodeId}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const openModal = useCallback((id: string) => setModalId(id), []);
  const closeModal = useCallback(() => setModalId(null), []);

  // Floating mini-logo visibility — show only once the main hub has scrolled
  // out of view and before the last feature section finishes.
  useEffect(() => {
    const lastEl = () => document.getElementById(`feature-${FEATURE_NODES[FEATURE_NODES.length - 1]}`);
    const onScroll = () => {
      const hub = hubRef.current;
      const last = lastEl();
      if (!hub) return;
      const hubRect = hub.getBoundingClientRect();
      const lastRect = last?.getBoundingClientRect();
      const pastHub = hubRect.bottom < 0;
      const beforeEnd = lastRect ? lastRect.bottom > 0 : true;
      setFloatVisible(pastHub && beforeEnd);
      // When the hub itself is in view, clear the active node so labels reset
      if (hubRect.top < window.innerHeight && hubRect.bottom > 0) {
        setScrollNode(null);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Track which feature is in view → drive active node highlight
  useEffect(() => {
    const sections = FEATURE_NODES
      .map((id) => document.getElementById(`feature-${id}`))
      .filter((el): el is HTMLElement => !!el);

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = (e.target as HTMLElement).dataset.featureIdx;
            if (idx != null) {
              const node = FEATURE_NODES[parseInt(idx, 10)];
              if (node) setScrollNode(node);
            }
          }
        });
      },
      { threshold: 0.5 },
    );
    sections.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Mirror active node onto the feature section markup so CSS can react.
  useEffect(() => {
    FEATURE_NODES.forEach((id) => {
      const el = document.getElementById(`feature-${id}`);
      if (!el) return;
      if (id === scrollNode) el.setAttribute('data-active', 'true');
      else el.removeAttribute('data-active');
    });
  }, [scrollNode]);

  // Listen for Learn more clicks from feature sections
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) openModal(id);
    };
    window.addEventListener('feature-learn-more', onOpen as EventListener);
    return () => window.removeEventListener('feature-learn-more', onOpen as EventListener);
  }, [openModal]);

  // Esc closes the modal, lock body scroll while open
  useEffect(() => {
    if (!modalId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [modalId, closeModal]);

  const modalFeature = modalId ? FEATURES.find((f) => f.id === modalId) ?? null : null;
  const isModal = !!modalFeature;
  // While modal is open, the navigator highlights the chosen node so it
  // stays in sync regardless of current scroll position.
  const navActiveNode = modalId ?? scrollNode;

  return (
    <>
      <div ref={hubRef} className="webhub">
        <WebNavigator size={920} scrollNode={scrollNode} onSelect={selectNode} />
      </div>

      <div
        className={`webfloat-backdrop ${isModal ? 'is-open' : ''}`}
        aria-hidden={!isModal}
        onClick={closeModal}
      />

      <div
        className={[
          'webfloat',
          floatVisible || isModal ? 'is-visible' : '',
          isModal ? 'is-modal' : '',
        ].filter(Boolean).join(' ')}
        aria-hidden={!floatVisible && !isModal}
        role={isModal ? 'dialog' : undefined}
        aria-modal={isModal || undefined}
        aria-label={isModal ? modalFeature?.tag : undefined}
      >
        <div className="webfloat-card">
          <div className="webfloat-nav">
            <div className="webfloat-nav-inner">
              <WebNavigator
                size={280}
                scrollNode={navActiveNode}
                onSelect={isModal ? undefined : selectNode}
                labelSizePx={10.5}
                interactive={!isModal}
              />
            </div>
          </div>

          <div className="webfloat-detail" aria-hidden={!isModal}>
            <div className="webfloat-detail-inner">
              {modalFeature && (
                <>
                  <div className="webfloat-tag">{modalFeature.tag}</div>
                  {modalFeature.detail.headline && (
                    <h3 className="webfloat-headline">{modalFeature.detail.headline}</h3>
                  )}
                  <p className="webfloat-body">{modalFeature.detail.body}</p>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className="webfloat-close"
            onClick={closeModal}
            aria-label="Close"
            tabIndex={isModal ? 0 : -1}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
