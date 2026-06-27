import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Slide({ title, subtitle, points, children, split = false }) {
  const containerRef = useRef();

  useEffect(() => {
    if (!containerRef.current) return;

    // Basic reveal animation for the slide content
    const ctx = gsap.context(() => {
      gsap.from('.reveal-text', {
        y: 50,
        opacity: 0,
        duration: 1,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="pres-slide" ref={containerRef}>
      <div className={`pres-slide-content ${split ? 'pres-split' : ''}`}>
        <div className="pres-glass">
          <h1 className="pres-title reveal-text">{title}</h1>
          {subtitle && <h2 className="pres-subtitle reveal-text" style={{ marginTop: '1rem' }}>{subtitle}</h2>}
          {points && points.length > 0 && (
            <ul className="pres-points" style={{ marginTop: '2rem' }}>
              {points.map((pt, i) => (
                <li key={i} className="reveal-text">{pt}</li>
              ))}
            </ul>
          )}
        </div>
        {children && (
          <div className="pres-visual reveal-text">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
