import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './styles.css';

import blueprint from './data/blueprint.json';
import metrics from './data/metrics.json';
import Slide from './components/Slide';
import BackgroundParticles from './scenes/BackgroundParticles';
import VisualizerFactory from './components/VisualizerFactory';

gsap.registerPlugin(ScrollTrigger);

export default function PresentationContainer() {
  const containerRef = useRef();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Track scroll progress for the progress bar
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const scrollHeight = document.body.scrollHeight;
      const clientHeight = window.innerHeight;
      const windowHeight = scrollHeight - clientHeight;
      const currentProgress = windowHeight > 0 ? (scrollTop / windowHeight) * 100 : 0;
      setProgress(currentProgress);
    };

    window.addEventListener('scroll', updateProgress);

    // Keyboard navigation
    const handleKeyDown = (e) => {
      const slideHeight = window.innerHeight;
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        window.scrollBy({ top: slideHeight, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        window.scrollBy({ top: -slideHeight, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('keydown', handleKeyDown);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div className="presentation-mode">
      <div className="pres-canvas-container">
        <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
          <ambientLight intensity={0.5} />
          <BackgroundParticles />
        </Canvas>
      </div>

      <div className="pres-progress" style={{ width: `${progress}%` }} />

      <div className="pres-container" ref={containerRef}>
        {blueprint.map((slideData) => {
          let customPoints = slideData.key_talking_points;
          if (slideData.slide_id === '19_metrics') {
            customPoints = [
              `React Components: ${metrics.reactComponents}`,
              `Pages: ${metrics.pages}`,
              `API Endpoints deployed: ${metrics.apiEndpoints}`,
              `Backend Services: ${metrics.backendServices}`,
              `Database Models: ${metrics.databaseModels}`,
              `Lines of Code: ${metrics.linesOfCode} LOC`
            ];
          }

          return (
            <Slide
              key={slideData.slide_id}
              title={slideData.title}
              subtitle={slideData.subtitle}
              points={customPoints}
              split={slideData.visual_concept.includes("Walkthrough") || slideData.visual_concept.includes("split")}
            >
              <VisualizerFactory slideId={slideData.slide_id} />
            </Slide>
          );
        })}
      </div>
    </div>
  );
}
