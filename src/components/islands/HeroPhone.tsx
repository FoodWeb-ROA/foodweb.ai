import './hero-phone.css';

export default function HeroPhone() {
  return (
    <div className="hero-phone">
      <div className="phone-frame">
        <div className="phone-notch" />
        <div className="phone-screen">
          <img src="/uploads/1.png" alt="ROA mobile app preview" loading="lazy" />
        </div>
      </div>
      <div className="phone-glow" aria-hidden />
    </div>
  );
}
