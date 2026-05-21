import { useEffect, useState } from 'react';
import PricingModal from './PricingModal';

export default function PricingModalTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#pricing') setOpen(true);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <>
      <a
        className="nav-link"
        href="#pricing"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        Pricing
      </a>
      <PricingModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
