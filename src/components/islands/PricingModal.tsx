import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './PricingModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRICE_PER = 10;

export default function PricingModal({ open, onClose }: Props) {
  const [team, setTeam] = useState(5);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const monthly = team * PRICE_PER;
  const yearly  = monthly * 12;
  const teamPct = ((team - 5) / 20) * 100;

  return createPortal(
    <div className="pricing-overlay" role="dialog" aria-modal="true" aria-labelledby="pricing-title" onClick={onClose}>
      <div className="pricing-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pricing-close" aria-label="Close" onClick={onClose}>×</button>

        <header className="pricing-head">
          <span className="pricing-badge">Pricing</span>
          <h2 id="pricing-title">Pay Per Team Member</h2>
          <p>€{PRICE_PER} per working team member, per month. Drag the sliders to size your plan.</p>
        </header>

        <div className="pricing-row">
          <div className="pricing-row-head">
            <div>
              <div className="pricing-row-title">People who work in your kitchen</div>
            </div>
            <div className="pricing-value"><span>{team}</span></div>
          </div>
          <div className="pricing-track" style={{ ['--pct' as any]: `${teamPct}%` }}>
            <input
              type="range" min={5} max={25} step={5}
              value={team}
              onChange={(e) => setTeam(parseInt(e.target.value, 10))}
              className="pricing-slider"
              aria-label="Team size"
            />
          </div>
          <div className="pricing-scale"><span>5</span><span>10</span><span>15</span><span>20</span><span>25+</span></div>
        </div>


        <div className="pricing-summary">
          <div>
            <div className="pricing-summary-label">Your monthly plan</div>
            {team === 25 ? (
              <div className="pricing-summary-price">
                Contact us for custom pricing
              </div>
            ) : (
              <>
                <div className="pricing-summary-price">
                  €<span>{monthly}</span>
                  <small>/ month</small>
                </div>
                <div className="pricing-summary-detail">
                  €{PRICE_PER} × {team} {team === 1 ? 'team member' : 'team members'}
                  <span>·  €{yearly.toLocaleString()} / year</span>
                </div>
              </>
            )}
          </div>
          <a className="pricing-cta" href={team === 25 ? '/contact?source=pricing-modal' : 'https://roaapp.ai'} target={team === 25 ? undefined : '_blank'} rel={team === 25 ? undefined : 'noopener'}>
            {team === 25 ? 'Contact us' : 'Get started'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </a>
        </div>

        <p className="pricing-fine">Cancel any time. Onboarding included. VAT applied where required.</p>
      </div>
    </div>,
    document.body
  );
}
