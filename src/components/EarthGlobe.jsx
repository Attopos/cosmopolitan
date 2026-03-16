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
const HOVER_STROKE_COLOR = 'rgba(255, 255, 255, 0.92)';
const VISITED_STROKE_COLOR = 'rgba(141, 220, 255, 0.68)';
const DEFAULT_STROKE_COLOR = 'rgba(173, 196, 230, 0.16)';

function EarthGlobe({ visitedCountryIds, onCountryClick }) {
  const containerRef = useRef(null);
  const globeInstanceRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const starFieldRef = useRef(null);
  const hoveredCountryIdRef = useRef(null);
  const visitedCountryIdsRef = useRef(visitedCountryIds);
  const introTimeoutRef = useRef(null);
  const [countries, setCountries] = useState([]);

  const getCountryId = (country) =>
    country?.properties?.ISO_A3 ||
    country?.properties?.ADM0_A3 ||
    country?.id;

  const applyPolygonStyles = (globe, activeVisitedCountryIds) => {
    globe
      .polygonCapColor((country) => {
        const countryId = getCountryId(country);

        if (hoveredCountryIdRef.current === countryId) {
          return HOVER_COLOR;
        }

        return activeVisitedCountryIds.has(countryId)
          ? VISITED_COLOR
          : DEFAULT_COLOR;
      })
      .polygonSideColor(() => 'rgba(12, 18, 28, 0.10)')
      .polygonStrokeColor((country) => {
        const countryId = getCountryId(country);

        if (hoveredCountryIdRef.current === countryId) {
          return HOVER_STROKE_COLOR;
        }

        return activeVisitedCountryIds.has(countryId)
          ? VISITED_STROKE_COLOR
          : DEFAULT_STROKE_COLOR;
      })
      .polygonAltitude((country) => {
        const countryId = getCountryId(country);

        if (hoveredCountryIdRef.current === countryId) {
          return 0.018;
        }

        return activeVisitedCountryIds.has(countryId) ? 0.012 : 0.004;
      });
  };

  useEffect(() => {
    visitedCountryIdsRef.current = visitedCountryIds;
  }, [visitedCountryIds]);

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

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 1);

    camera.position.set(-28, 52, 300);
    camera.lookAt(0, 0, 0);
    globe.pointOfView({ lat: 24, lng: -30, altitude: 2.55 }, 0);

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.24;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 180;
    controls.maxDistance = 360;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.9;

    const ambientLight = new THREE.AmbientLight(0xbcd7ff, 0.7);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
    directionalLight.position.set(-220, 160, 220);
    scene.add(ambientLight);
    scene.add(directionalLight);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1400;
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
      size: 1.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.82
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
      hoveredCountryIdRef.current = null;
      applyPolygonStyles(globe, visitedCountryIdsRef.current);

      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    };

    window.addEventListener('resize', handleResize);
    container.addEventListener('pointerenter', handlePointerEnter);
    container.addEventListener('pointerleave', handlePointerLeave);
    handleResize();
    introTimeoutRef.current = window.setTimeout(() => {
      globe.pointOfView({ lat: 18, lng: -12, altitude: 1.9 }, 1800);
    }, 160);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerenter', handlePointerEnter);
      container.removeEventListener('pointerleave', handlePointerLeave);

      if (introTimeoutRef.current) {
        window.clearTimeout(introTimeoutRef.current);
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
      .polygonLabel((country) => {
        const name = country?.properties?.ADMIN ?? 'Unknown country';
        const countryId = getCountryId(country);
        const visited = visitedCountryIds.has(countryId) ? 'Visited' : 'Click to mark visited';

        return `<div class="globe-tooltip"><strong>${name}</strong><span>${visited}</span></div>`;
      })
      .onPolygonClick((country) => {
        hoveredCountryIdRef.current = getCountryId(country);
        onCountryClick(country);
      })
      .onPolygonHover((country) => {
        const nextHoveredCountryId = getCountryId(country);

        if (hoveredCountryIdRef.current === nextHoveredCountryId) {
          return;
        }

        hoveredCountryIdRef.current = nextHoveredCountryId;
        applyPolygonStyles(globe, visitedCountryIds);

        if (containerRef.current) {
          containerRef.current.style.cursor = country ? 'pointer' : 'grab';
        }
      })
      .polygonsTransitionDuration(380);

    applyPolygonStyles(globe, visitedCountryIds);
  }, [countries, onCountryClick, visitedCountryIds]);

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
