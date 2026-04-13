import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WALL_HEIGHT = 3;
const modelCache = new Map();
const gltfLoader = new GLTFLoader();

const FALLBACK_COLORS = {
  sofa: 0x8B4513, tv: 0x111111, bed: 0x4169E1, bathtub: 0xE0E0FF,
  table: 0xDEB887, chair: 0xA0522D, kitchen: 0xC0C0C0, toilet: 0xFFFFFF,
  desk: 0x8B6914, desk_lamp: 0xFFD700, fridge: 0xE8E8E8, garden: 0x4f9f4f,
};

/**
 * Fallback box
 */
function createFallbackBox(type, size) {
  const color = FALLBACK_COLORS[type] || 0x888888;
  const geo = new THREE.BoxGeometry(size.width, size.height, size.depth);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Charge un modèle GLB avec cache
 */
async function loadModel(type) {
  const path = `/models/${type}.glb`;
  
  if (modelCache.has(path)) {
    console.log(`[Model] ✓ Cache: ${type}`);
    const cached = modelCache.get(path);
    return cached ? cached.clone() : null;
  }

  console.log(`[Model] Loading ${type}...`);
  
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => {
        console.log(`[Model] ✓ Loaded ${type}`);
        const model = gltf.scene;
        
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        modelCache.set(path, model);
        resolve(model.clone());
      },
      undefined,
      (err) => {
        console.warn(`[Model] ✗ ${type}:`, err.message);
        modelCache.set(path, null);
        reject(err);
      }
    );
  });
}

/**
 * Place des meubles dans la scène
 */
async function placeFurniture(scene, furnData) {
  const { type, x, z, rotation, size } = furnData;

  try {
    let model = await loadModel(type);
    
    if (model) {
      console.log(`[Furniture] ✓ Loaded: ${type}`);
      
      // Normaliser la taille
      const box = new THREE.Box3().setFromObject(model);
      const modelSize = new THREE.Vector3();
      box.getSize(modelSize);
      
      const scaleX = size.width / modelSize.x;
      const scaleY = size.height / modelSize.y;
      const scaleZ = size.depth / modelSize.z;
      const scale = Math.min(scaleX, scaleY, scaleZ);
      
      model.scale.set(scale, scale, scale);
      
      // Repositionner sur le sol
      const newBox = new THREE.Box3().setFromObject(model);
      const minY = newBox.min.y;
      model.position.y = -minY;
      
      model.position.x = x;
      model.position.z = z;
      model.rotation.y = (rotation * Math.PI) / 180;
      
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      scene.add(model);
      return;
    }
  } catch (err) {
    console.warn(`[Furniture] ✗ GLB failed: ${type}`, err.message);
  }

  // Fallback box
  const color = FALLBACK_COLORS[type] || 0x888888;
  const fallback = createFallbackBox(type, size);
  fallback.position.set(x, size.height / 2, z);
  fallback.rotation.y = (rotation * Math.PI) / 180;
  scene.add(fallback);
}

/**
 * Place tous les meubles d'une maison
 */
async function placeAllFurniture(scene, rooms) {
  const allFurniture = rooms.flatMap(room => room.furniture || []);
  
  for (const furn of allFurniture) {
    try {
      await placeFurniture(scene, furn);
    } catch (err) {
      console.error(`[Furniture] Erreur ${furn.type}:`, err);
    }
  }
}

export function HouseScene({ houseData, isLoading, selectedRoom }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const renderTokenRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Creer la scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(15, 12, 15);
    camera.lookAt(5, 0, 5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    scene.add(directionalLight);

    // OrbitControls pour navigation fluide
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = false;
    controls.minDistance = 5;
    controls.maxDistance = 80;
    controls.maxPolarAngle = Math.PI * 0.9;
    controls.minPolarAngle = Math.PI * 0.1;
    controlsRef.current = controls;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const onWindowResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      window.removeEventListener('resize', onWindowResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Rendre la maison quand les donnees changent
  useEffect(() => {
    if (!sceneRef.current || !houseData?.rooms) {
      return;
    }

    const scene = sceneRef.current;
    renderTokenRef.current += 1;
    const renderToken = renderTokenRef.current;

    (async () => {
      // Nettoyer la scène
      scene.children
        .filter((child) => !(child instanceof THREE.Light) && !(child.name === 'grid'))
        .forEach((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
          scene.remove(child);
        });

      // Grille
      const gridHelper = new THREE.GridHelper(50, 50, 0xcccccc, 0xeeeeee);
      gridHelper.name = 'grid';
      gridHelper.position.y = 0.01;
      scene.add(gridHelper);

      const rooms = houseData.rooms || [];

      // Construire les sols et murs
      rooms.forEach((room) => {
        const { width, depth, world_x: wx, world_z: wz, color, name } = room;

        // Floor
        const floorMat = new THREE.MeshStandardMaterial({
          color: selectedRoom?.name === name ? 0xfcd34d : 0xd4b8a0,
          roughness: 0.8,
          metalness: 0.1,
        });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(wx + width / 2, 0.01, wz + depth / 2);
        floor.receiveShadow = true;
        scene.add(floor);

        // Walls (simple: no doors)
        const wallMat = new THREE.MeshStandardMaterial({
          color: selectedRoom?.name === name ? 0xfde047 : new THREE.Color(color || '#e8e8e8'),
          roughness: 0.9,
          metalness: 0,
        });

        // Front/Back walls
        for (let z of [wz, wz + depth]) {
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(width, WALL_HEIGHT, 0.2),
            wallMat
          );
          wall.position.set(wx + width / 2, WALL_HEIGHT / 2, z);
          wall.castShadow = true;
          wall.receiveShadow = true;
          scene.add(wall);
        }

        // Left/Right walls
        for (let x of [wx, wx + width]) {
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, WALL_HEIGHT, depth),
            wallMat
          );
          wall.position.set(x, WALL_HEIGHT / 2, wz + depth / 2);
          wall.castShadow = true;
          wall.receiveShadow = true;
          scene.add(wall);
        }

        // Label
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = selectedRoom?.name === name ? '#fde047' : (color || '#e8e8e8');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = selectedRoom?.name === name ? '#000' : '#333';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.toUpperCase(), canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
        sprite.scale.set(3, 1.5, 1);
        sprite.position.set(wx + width / 2, WALL_HEIGHT + 0.5, wz + depth / 2);
        scene.add(sprite);
      });

      // Placer les meubles
      if (renderToken === renderTokenRef.current) {
        await placeAllFurniture(scene, rooms);
      }
    })();
  }, [houseData, selectedRoom]);
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f4f8',
      }}
    >
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '20px 40px',
            borderRadius: '10px',
            zIndex: 100,
          }}
        >
          House generation in progress...
        </div>
      )}
    </div>
  );
}
