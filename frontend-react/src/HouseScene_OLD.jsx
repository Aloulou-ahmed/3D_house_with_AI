import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WALL_THICKNESS = 0.2;
const WALL_HEIGHT = 3;
const DOOR_WIDTH = 1.2;
const DOOR_HEIGHT = 2.1;
const TOUCH_EPSILON = 0.02;

// Cache pour les modeles charges
const modelCache = {};
const gltfLoader = new GLTFLoader();

// Fonction pour charger un modele
async function loadModel(modelPath) {
  console.log(`[LOAD] Starting loadModel for ${modelPath}`);
  
  if (Object.prototype.hasOwnProperty.call(modelCache, modelPath)) {
    const cached = modelCache[modelPath];
    console.log(`[LOAD] Found in cache for ${modelPath}:`, cached ? 'SUCCESS' : 'NULL');
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    console.log(`[LOAD] Fetching from server: ${modelPath}`);
    gltfLoader.load(
      modelPath,
      (gltf) => {
        console.log(`[LOAD] ✓ Successfully loaded ${modelPath}`);
        modelCache[modelPath] = gltf.scene;
        resolve(gltf.scene);
      },
      (progress) => {
        console.log(`[LOAD] Progress for ${modelPath}: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
      },
      (err) => {
        console.error(`[LOAD] ✗ Error loading ${modelPath}:`, err.message);
        modelCache[modelPath] = null;
        reject(err);
      }
    );
  });
}

function isType(type, values) {
  const normalized = (type || '').toLowerCase();
  return values.some((value) => normalized.includes(value));
}

function createFallbackPrimitive(type, size, material) {
  const safeWidth = Math.max(0.1, size?.width || 1);
  const safeHeight = Math.max(0.1, size?.height || 1);
  const safeDepth = Math.max(0.1, size?.depth || 1);

  if (isType(type, ['tree', 'plant'])) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(safeWidth * 0.12, safeWidth * 0.18, safeHeight * 0.55, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b4f2b, roughness: 0.85, metalness: 0.05 })
    );
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(safeWidth, safeDepth) * 0.5, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x3f8f3f, roughness: 0.9, metalness: 0.02 })
    );
    leaves.position.y = safeHeight * 0.45;
    const group = new THREE.Group();
    group.add(trunk);
    group.add(leaves);
    return { node: group, yOffset: safeHeight * 0.275 };
  }

  if (isType(type, ['lamp'])) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(safeWidth * 0.08, safeWidth * 0.1, safeHeight * 0.8, 12),
      material
    );
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(safeWidth, safeDepth) * 0.22, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe38a, emissive: 0x6a5a20, roughness: 0.4, metalness: 0.35 })
    );
    head.position.y = safeHeight * 0.45;
    const group = new THREE.Group();
    group.add(pole);
    group.add(head);
    return { node: group, yOffset: safeHeight * 0.4 };
  }

  if (isType(type, ['garden', 'grass', 'yard'])) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(safeWidth, safeDepth) * 0.45, Math.max(safeWidth, safeDepth) * 0.5, Math.max(0.08, safeHeight), 24),
      new THREE.MeshStandardMaterial({ color: 0x4f9f4f, roughness: 0.98, metalness: 0.01 })
    );
    return { node: base, yOffset: Math.max(0.08, safeHeight) / 2 };
  }

  if (isType(type, ['chair', 'stool', 'toilet'])) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(safeWidth, safeHeight * 0.8, safeDepth),
      material
    );
    return { node: box, yOffset: (safeHeight * 0.8) / 2 };
  }

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(safeWidth, safeHeight, safeDepth),
    material
  );
  return { node: box, yOffset: safeHeight / 2 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function overlapRange(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return { start, end, length: Math.max(0, end - start) };
}

function computeRoomBounds(room) {
  return {
    minX: room.world_x,
    maxX: room.world_x + room.width,
    minZ: room.world_z,
    maxZ: room.world_z + room.depth,
  };
}

function createEmptyConnections(count) {
  return Array.from({ length: count }, () => ({
    left: null,
    right: null,
    front: null,
    back: null,
  }));
}

function computeConnections(rooms) {
  const connections = createEmptyConnections(rooms.length);

  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const a = computeRoomBounds(rooms[i]);
      const b = computeRoomBounds(rooms[j]);
      const owner = Math.min(i, j);

      const zOverlap = overlapRange(a.minZ, a.maxZ, b.minZ, b.maxZ);
      if (Math.abs(a.maxX - b.minX) <= TOUCH_EPSILON && zOverlap.length >= DOOR_WIDTH + 0.3) {
        const doorCenter = (zOverlap.start + zOverlap.end) / 2;
        connections[i].right = { owner, doorCenter };
        connections[j].left = { owner, doorCenter };
      }
      if (Math.abs(a.minX - b.maxX) <= TOUCH_EPSILON && zOverlap.length >= DOOR_WIDTH + 0.3) {
        const doorCenter = (zOverlap.start + zOverlap.end) / 2;
        connections[i].left = { owner, doorCenter };
        connections[j].right = { owner, doorCenter };
      }

      const xOverlap = overlapRange(a.minX, a.maxX, b.minX, b.maxX);
      if (Math.abs(a.maxZ - b.minZ) <= TOUCH_EPSILON && xOverlap.length >= DOOR_WIDTH + 0.3) {
        const doorCenter = (xOverlap.start + xOverlap.end) / 2;
        connections[i].back = { owner, doorCenter };
        connections[j].front = { owner, doorCenter };
      }
      if (Math.abs(a.minZ - b.maxZ) <= TOUCH_EPSILON && xOverlap.length >= DOOR_WIDTH + 0.3) {
        const doorCenter = (xOverlap.start + xOverlap.end) / 2;
        connections[i].front = { owner, doorCenter };
        connections[j].back = { owner, doorCenter };
      }
    }
  }

  return connections;
}

function drawHorizontalWall(scene, startX, endX, z, y, material) {
  const length = endX - startX;
  if (length <= 0.05) return;

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS),
    material
  );
  wall.position.set(startX + length / 2, y, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

function drawVerticalWall(scene, x, startZ, endZ, y, material) {
  const length = endZ - startZ;
  if (length <= 0.05) return;

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, length),
    material
  );
  wall.position.set(x, y, startZ + length / 2);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

function drawDoor(scene, orientation, axisValue, centerValue) {
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b4f3a,
    roughness: 0.75,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  });

  let door;
  if (orientation === 'horizontal') {
    door = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, WALL_THICKNESS * 0.45),
      doorMaterial
    );
    door.position.set(centerValue, DOOR_HEIGHT / 2, axisValue);
  } else {
    door = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_THICKNESS * 0.45, DOOR_HEIGHT, DOOR_WIDTH),
      doorMaterial
    );
    door.position.set(axisValue, DOOR_HEIGHT / 2, centerValue);
  }

  door.castShadow = true;
  door.receiveShadow = true;
  scene.add(door);
}

function drawWallWithDoor(scene, orientation, axisValue, start, end, material, doorCenter) {
  const minCenter = start + DOOR_WIDTH / 2 + 0.1;
  const maxCenter = end - DOOR_WIDTH / 2 - 0.1;
  const safeCenter = clamp(doorCenter, minCenter, maxCenter);

  const leftStart = start;
  const leftEnd = safeCenter - DOOR_WIDTH / 2;
  const rightStart = safeCenter + DOOR_WIDTH / 2;
  const rightEnd = end;

  const wallY = WALL_HEIGHT / 2;

  if (orientation === 'horizontal') {
    drawHorizontalWall(scene, leftStart, leftEnd, axisValue, wallY, material);
    drawHorizontalWall(scene, rightStart, rightEnd, axisValue, wallY, material);
  } else {
    drawVerticalWall(scene, axisValue, leftStart, leftEnd, wallY, material);
    drawVerticalWall(scene, axisValue, rightStart, rightEnd, wallY, material);
  }

  const lintelHeight = WALL_HEIGHT - DOOR_HEIGHT;
  if (lintelHeight > 0.15) {
    const lintelY = DOOR_HEIGHT + lintelHeight / 2;
    if (orientation === 'horizontal') {
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(DOOR_WIDTH, lintelHeight, WALL_THICKNESS),
        material
      );
      lintel.position.set(safeCenter, lintelY, axisValue);
      lintel.castShadow = true;
      lintel.receiveShadow = true;
      scene.add(lintel);
    } else {
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_THICKNESS, lintelHeight, DOOR_WIDTH),
        material
      );
      lintel.position.set(axisValue, lintelY, safeCenter);
      lintel.castShadow = true;
      lintel.receiveShadow = true;
      scene.add(lintel);
    }
  }

  drawDoor(scene, orientation, axisValue, safeCenter);
}

function drawConnectedWall(scene, roomIndex, sideConnection, orientation, axisValue, start, end, material) {
  if (!sideConnection) {
    if (orientation === 'horizontal') {
      drawHorizontalWall(scene, start, end, axisValue, WALL_HEIGHT / 2, material);
    } else {
      drawVerticalWall(scene, axisValue, start, end, WALL_HEIGHT / 2, material);
    }
    return;
  }

  if (sideConnection.owner !== roomIndex) {
    return;
  }

  drawWallWithDoor(scene, orientation, axisValue, start, end, material, sideConnection.doorCenter);
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(15, 20, 12);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -40;
    directionalLight.shadow.camera.right = 40;
    directionalLight.shadow.camera.top = 40;
    directionalLight.shadow.camera.bottom = -40;
    directionalLight.shadow.bias = -0.0005;
    scene.add(directionalLight);

    // Add fill light for better furniture visibility
    const fillLight = new THREE.DirectionalLight(0xb8d8ff, 0.5);
    fillLight.position.set(-15, 12, -15);
    scene.add(fillLight);

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
    if (!sceneRef.current || !houseData) {
      console.log('[EFFECT] Early return: sceneRef.current =', !!sceneRef.current, 'houseData =', !!houseData);
      return;
    }

    const scene = sceneRef.current;
    console.log('[EFFECT] Starting house render, houseData:', houseData);
    
    renderTokenRef.current += 1;
    const renderToken = renderTokenRef.current;

    // Fonction asynchrone pour rendre la maison
    (async () => {
      // Nettoyer la scène (garder lights et grid)
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

      // Ajouter une grille au sol
      const gridHelper = new THREE.GridHelper(50, 50, 0xcccccc, 0xeeeeee);
      gridHelper.name = 'grid';
      gridHelper.position.y = 0.01;
      scene.add(gridHelper);

      const rooms = houseData.rooms || [];
      console.log('[EFFECT] Rooms to render:', rooms.length, rooms.map(r => ({ name: r.name, furniture: r.furniture?.length || 0 })));
      
      const connections = computeConnections(rooms);

      // Rendre murs et sols de chaque piece
      rooms.forEach((room, roomIndex) => {
        console.log(`[EFFECT] Building room structure ${roomIndex}: ${room.name}`);
        drawRoomStructure(
          scene,
          room,
          roomIndex,
          connections[roomIndex],
          selectedRoom?.name === room.name,
          renderToken
        );
      });

      // Placer les meubles uno à uno avec await
      console.log('[EFFECT] Starting furniture placement...');
      const allFurniture = rooms.flatMap(room => room.furniture || []);
      console.log('[EFFECT] Total furniture to place:', allFurniture.length);
      
      let loaded = 0;
      for (const furn of allFurniture) {
        if (renderToken !== renderTokenRef.current) {
          console.log('[EFFECT] Render token mismatch, stopping furniture placement');
          return;
        }
        
        try {
          await drawFurnitureAsync(scene, furn);
          loaded++;
          console.log(`[EFFECT] Furniture placed: ${loaded}/${allFurniture.length}`);
        } catch (err) {
          console.error(`[EFFECT] Error placing furniture ${furn.type}:`, err);
          loaded++;
          console.log(`[EFFECT] Skipped furniture (error): ${loaded}/${allFurniture.length}`);
        }
      }

      console.log('[EFFECT] House render complete');
    })();
  }, [houseData, selectedRoom]);

  // Rendre la structure (murs, sols) d'une pièce
  function drawRoomStructure(scene, room, roomIndex, roomConnections, isSelected, renderToken) {
    const { width, depth, world_x, world_z, color, name } = room;
    
    console.log(`[DEBUG] drawRoomStructure: name="${name}"`);

    // Creer le floor
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: isSelected ? 0xfcd34d : 0xd4b8a0,
      roughness: 0.8,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(world_x + width / 2, 0.01, world_z + depth / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Wall color based on selection
    const wallColor = isSelected ? 0xfde047 : new THREE.Color(color || '#e8e8e8');
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.9,
      metalness: 0,
    });

    // Murs: portes automatiques entre pieces adjacentes
    drawConnectedWall(
      scene,
      roomIndex,
      roomConnections.front,
      'horizontal',
      world_z,
      world_x,
      world_x + width,
      wallMaterial
    );
    drawConnectedWall(
      scene,
      roomIndex,
      roomConnections.back,
      'horizontal',
      world_z + depth,
      world_x,
      world_x + width,
      wallMaterial
    );
    drawConnectedWall(
      scene,
      roomIndex,
      roomConnections.left,
      'vertical',
      world_x,
      world_z,
      world_z + depth,
      wallMaterial
    );
    drawConnectedWall(
      scene,
      roomIndex,
      roomConnections.right,
      'vertical',
      world_x + width,
      world_z,
      world_z + depth,
      wallMaterial
    );

    // Ajouter une etiquette de la piece
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = isSelected ? '#fde047' : (color || '#e8e8e8');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isSelected ? '#000' : '#333';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.replace(/_/g, ' ').toUpperCase(), canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(3, 1.5, 1);
    sprite.position.set(world_x + width / 2, WALL_HEIGHT + 0.5, world_z + depth / 2);
    scene.add(sprite);
  }

  // Placer un meuble asynchronement
  async function drawFurnitureAsync(scene, furniture) {
    const { type, x, z, rotation, size } = furniture;

    console.log(`[FURNITURE] Placing ${type} at (${x.toFixed(1)}, ${z.toFixed(1)}) - size: ${size.width}x${size.height}x${size.depth}`);

    let model = null;
    
    try {
      // Essaie de charger le vrai modèle GLB
      const loadedModel = await loadModel(`/models/${type}.glb`);
      console.log(`[FURNITURE] loadModel returned for ${type}:`, loadedModel ? 'SUCCESS' : 'NULL');
      
      if (loadedModel) {
        console.log(`[FURNITURE] Using GLB model for ${type}`);
        
        // Clone le modèle pour ne pas modifier le cache
        model = loadedModel.clone();
        
        // Normalise la taille du modèle pour correspondre aux dimensions réelles
        const box = new THREE.Box3().setFromObject(model);
        const modelSize = new THREE.Vector3();
        box.getSize(modelSize);
        
        console.log(`[FURNITURE] ${type} - Original size: ${modelSize.x.toFixed(2)}x${modelSize.y.toFixed(2)}x${modelSize.z.toFixed(2)}`);
        
        // Calcule le facteur d'échelle uniforme (garde les proportions)
        // On utilise le maximum pour s'assurer que le modèle occupe bien l'espace
        const scaleX = modelSize.x > 0.01 ? size.width / modelSize.x : 1;
        const scaleY = modelSize.y > 0.01 ? size.height / modelSize.y : 1;
        const scaleZ = modelSize.z > 0.01 ? size.depth / modelSize.z : 1;
        const scale = Math.min(scaleX, scaleY, scaleZ);
        
        console.log(`[FURNITURE] ${type} - Scale factors: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}, Z=${scaleZ.toFixed(3)}, using: ${scale.toFixed(3)}`);
        
        // Applique l'échelle
        model.scale.set(scale, scale, scale);
        
        // Recalcule la boîte après scaling
        const scaledBox = new THREE.Box3().setFromObject(model);
        const minY = scaledBox.min.y;
        
        // Place le modèle au sol en y=0
        model.position.y = -minY;
        
        console.log(`[FURNITURE] ${type} - Final position Y: ${model.position.y.toFixed(3)} (adjusted from minY: ${minY.toFixed(3)})`);
        
        // Active les ombres sur tous les meshes
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Améliore les matériaux pour une meilleure visibilité
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  if (mat.map) mat.map.anisotropy = 16; // Texture quality
                  mat.shadowMap = true;
                });
              } else {
                if (child.material.map) child.material.map.anisotropy = 16;
                child.material.shadowMap = true;
              }
            }
          }
        });
      } else {
        throw new Error(`loadModel returned null for ${type}`);
      }
    } catch (err) {
      console.warn(`[FURNITURE] GLB failed for ${type}, using fallback - Error:`, err.message);
      // Fallback: créer une boîte colorée avec de bons matériaux
      const colors = {
        sofa: 0x8B4513, bed: 0x4169E1, chair: 0xA0522D, table: 0xDEB887,
        desk: 0x8B6914, tv: 0x1a1a1a, kitchen: 0xC0C0C0, fridge: 0xE8E8E8,
        bathtub: 0xE0E0FF, toilet: 0xFFFFFF, desk_lamp: 0xFFD700, lamp: 0xFFD700
      };
      const color = colors[type] || 0x888888;
      const geo = new THREE.BoxGeometry(size.width, size.height, size.depth);
      const mat = new THREE.MeshStandardMaterial({ 
        color, 
        roughness: 0.6, 
        metalness: type === 'kitchen' || type === 'fridge' ? 0.4 : 0.1,
        envMapIntensity: 0.5
      });
      model = new THREE.Mesh(geo, mat);
      model.position.y = size.height / 2;
      model.castShadow = true;
      model.receiveShadow = true;
      console.log(`[FURNITURE] Created fallback box for ${type} with color ${color.toString(16)}`);
    }

    // Appliquer la position XZ et rotation finales
    if (model) {
      model.position.x = x;
      model.position.z = z;
      model.rotation.y = (rotation * Math.PI) / 180;
      scene.add(model);
      console.log(`[FURNITURE] ✓ ${type} placed successfully at (${x.toFixed(1)}, ${z.toFixed(1)}) with Y offset: ${model.position.y.toFixed(3)}`);
    } else {
      console.error(`[FURNITURE] ✗ Failed to place ${type} - no model and no fallback created!`);
    }
  }

  // Anchor function - old drawFurniture kept for reference
  function drawRoom(scene, room, roomIndex, roomConnections, isSelected, renderToken) {
    // This function is now split into drawRoomStructure + drawFurnitureAsync
    // Keeping for backward compatibility if needed
  }

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
