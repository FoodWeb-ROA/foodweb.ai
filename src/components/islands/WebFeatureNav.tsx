import { useCallback, useEffect, useRef, useState } from 'react';
import WebNavigator from './WebNavigator';
import { FEATURE_NODES } from '~/lib/web-nodes';
import './web-navigator.css';
import './web-feature-nav.css';

export default function WebFeatureNav() {
  const [scrollNode, setScrollNode] = useState<string | null>(null);
  const [floatVisible, setFloatVisible] = useState(false);
  const hubRef = useRef<HTMLDivElement>(null);

  const selectNode = useCallback((nodeId: string) => {
    const el = document.getElementById(`feature-${nodeId}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

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

  return (
    <>
      <div ref={hubRef} className="webhub">
        <WebNavigator size={920} scrollNode={scrollNode} onSelect={selectNode} />
      </div>

      <div
        className={`webfloat ${floatVisible ? 'is-visible' : ''}`}
        aria-hidden={!floatVisible}
      >
        <div className="webfloat-card">
          <WebNavigator
            size={280}
            scrollNode={scrollNode}
            onSelect={selectNode}
            labelSizePx={10.5}
          />
        </div>
      </div>
    </>
  );
}
