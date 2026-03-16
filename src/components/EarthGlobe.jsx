import { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';

const COUNTRIES_GEOJSON_URL = '/countries.geojson';
const EARTH_TEXTURE_URL =
  'https://unpkg.com/three-globe/example/img/earth-night.jpg';
const BUMP_TEXTURE_URL =
  'https://unpkg.com/three-globe/example/img/earth-topology.png';
const BACKGROUND_TEXTURE_URL =
  'https://unpkg.com/three-globe/example/img/night-sky.png';

const VISITED_COLOR = 'rgba(122, 208, 255, 0.34)';
const DEFAULT_COLOR = 'rgba(126, 146, 178, 0.10)';
const HOVER_COLOR = 'rgba(214, 236, 255, 0.22)';

function EarthGlobe({ visitedCountryIds, onCountryClick }) {
  const containerRef = useRef(null);
  const globeInstanceRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const starFieldRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [countries, setCountries] = useState([]);
  const [hoveredCountryId, setHoveredCountryId] = useState(null);

  const getCountryId = (country) =>
    country?.properties?.ISO_A3 ||
    country?.properties?.ADM0_A3 ||
    country?.id;

  useEffect(() => {
    let isMounted = true;

    fetch(COUNTRIES_GEOJSON_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Country polygon request failed: ${response.status}`);
        }

        return response.json();
      })
      .then((data) => {
        if (isMounted) {
          setCountries(data.features ?? []);
        }
      })
      .catch((error) => {
        console.error('Failed to load country polygons', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || globeInstanceRef.current) {
      return undefined;
    }

    const globe = Globe()(container)
      .globeImageUrl(EARTH_TEXTURE_URL)
      .bumpImageUrl(BUMP_TEXTURE_URL)
      .backgroundImageUrl(BACKGROUND_TEXTURE_URL)
      .showAtmosphere(true)
      .atmosphereColor('#5dcbff')
      .atmosphereAltitude(0.18)
      .width(container.clientWidth)
      .height(container.clientHeight);

    const renderer = globe.renderer();
    const scene = globe.scene();
    const camera = globe.camera();
    const controls = globe.controls();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);

    camera.position.set(0, 40, 265);
    camera.lookAt(0, 0, 0);

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 180;
    controls.maxDistance = 360;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.9;

    const ambientLight = new THREE.AmbientLight(0xbcd7ff, 0.7);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
    directionalLight.position.set(-220, 160, 220);
    scene.add(ambientLight);
    scene.add(directionalLight);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2500;
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i += 1) {
      const radius = 900 + Math.random() * 900;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const offset = i * 3;

      starPositions[offset] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[offset + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[offset + 2] = radius * Math.cos(phi);
    }

    starGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3)
    );

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    globeInstanceRef.current = globe;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    starFieldRef.current = starField;

    const handleResize = () => {
      if (!containerRef.current || !globeInstanceRef.current) {
        return;
      }

      globeInstanceRef.current
        .width(containerRef.current.clientWidth)
        .height(containerRef.current.clientHeight);
    };

    const handlePointerEnter = () => {
      controls.autoRotate = false;
    };

    const handlePointerLeave = () => {
      controls.autoRotate = true;
      setHoveredCountryId(null);

      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    };

    const animate = () => {
      if (starFieldRef.current) {
        starFieldRef.current.rotation.y += 0.00035;
      }

      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    window.addEventListener('resize', handleResize);
    container.addEventListener('pointerenter', handlePointerEnter);
    container.addEventListener('pointerleave', handlePointerLeave);
    handleResize();
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerenter', handlePointerEnter);
      container.removeEventListener('pointerleave', handlePointerLeave);

      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      if (starFieldRef.current) {
        scene.remove(starFieldRef.current);
        starFieldRef.current.geometry.dispose();
        starFieldRef.current.material.dispose();
      }

      scene.remove(ambientLight);
      scene.remove(directionalLight);
      controls.autoRotate = false;

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      globeInstanceRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      starFieldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const globe = globeInstanceRef.current;

    if (!globe || countries.length === 0) {
      return;
    }

    globe
      .polygonsData(countries)
      .polygonCapColor((country) => {
        const countryId =
          getCountryId(country);

        if (hoveredCountryId === countryId) {
          return HOVER_COLOR;
        }

        return visitedCountryIds.has(countryId) ? VISITED_COLOR : DEFAULT_COLOR;
      })
      .polygonSideColor(() => 'rgba(12, 18, 28, 0.10)')
      .polygonStrokeColor((country) => {
        const countryId = getCountryId(country);

        if (hoveredCountryId === countryId) {
          return 'rgba(255, 255, 255, 0.92)';
        }

        return visitedCountryIds.has(countryId)
          ? 'rgba(141, 220, 255, 0.68)'
          : 'rgba(173, 196, 230, 0.16)';
      })
      .polygonAltitude((country) => {
        const countryId = getCountryId(country);

        if (hoveredCountryId === countryId) {
          return 0.024;
        }

        return visitedCountryIds.has(countryId) ? 0.014 : 0.006;
      })
      .polygonLabel((country) => {
        const name = country?.properties?.ADMIN ?? 'Unknown country';
        const countryId = getCountryId(country);
        const visited = visitedCountryIds.has(countryId) ? 'Visited' : 'Click to mark visited';

        return `<div class="globe-tooltip"><strong>${name}</strong><span>${visited}</span></div>`;
      })
      .onPolygonClick((country) => {
        setHoveredCountryId(getCountryId(country));
        onCountryClick(country);
      })
      .onPolygonHover((country) => {
        setHoveredCountryId(getCountryId(country));
        containerRef.current.style.cursor = country ? 'pointer' : 'grab';
      })
      .polygonsTransitionDuration(220);
  }, [countries, hoveredCountryId, onCountryClick, visitedCountryIds]);

  return (
    <section className="globe-section">
      <div ref={containerRef} className="globe-canvas" aria-label="Interactive 3D Earth globe" />
      <div className="globe-overlay">
        <p className="globe-kicker">Cosmopolitan</p>
        <h1>Trace the world you&apos;ve touched.</h1>
        <p className="globe-copy">
          Click countries to mark them as visited.
        </p>
      </div>
    </section>
  );
}

export default EarthGlobe;
