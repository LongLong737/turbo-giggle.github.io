import * as THREE from './vendor/three-r186/three.webgpu.js';

// Numeric flags keep module import compatible with browsers without WebGPU.
const STORAGE = 128 | 8;

// Paired children keep GPU traversal compact. BLAS leaves contain triangles;
// TLAS leaves contain mesh instances, so moving entities need no triangle upload.
function buildBVH(items, nodes = [], order = []) {
  const root = nodes.length;
  nodes.push(null);
  function fill(index, list) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const item of list) for (let axis = 0; axis < 3; axis++) {
      lo[axis] = Math.min(lo[axis], item.lo[axis]); hi[axis] = Math.max(hi[axis], item.hi[axis]);
    }
    if (list.length <= 4) {
      const first = order.length; order.push(...list);
      nodes[index] = { lo, hi, first, count: list.length }; return;
    }
    const extent = hi.map((v, axis) => v - lo[axis]);
    const axis = extent.indexOf(Math.max(...extent));
    list.sort((a, b) => a.lo[axis] + a.hi[axis] - b.lo[axis] - b.hi[axis]);
    const middle = list.length >> 1, first = nodes.length;
    nodes.push(null, null); nodes[index] = { lo, hi, first, count: 0 };
    fill(first, list.slice(0, middle)); fill(first + 1, list.slice(middle));
  }
  if (items.length) fill(root, items); else nodes[root] = { lo: [0, 0, 0], hi: [0, 0, 0], first: 0, count: 0 };
  return { root, nodes, order };
}

function packNodes(nodes) {
  const data = new ArrayBuffer(Math.max(32, nodes.length * 32));
  const floats = new Float32Array(data), ints = new Uint32Array(data);
  nodes.forEach((node, i) => {
    floats.set(node.lo, i * 8); ints[i * 8 + 3] = node.first;
    floats.set(node.hi, i * 8 + 4); ints[i * 8 + 7] = node.count;
  });
  return data;
}

const PRESENT = `
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@group(0) @binding(0) var image: texture_2d<f32>;
@vertex fn vertex(@builtin(vertex_index) index: u32) -> Vertex {
  let p = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return Vertex(vec4f(p[index],0,1),vec2f(p[index].x*.5+.5,.5-p[index].y*.5));
}
@fragment fn fragment(input: Vertex) -> @location(0) vec4f {
  let size = vec2i(textureDimensions(image)); let p = clamp(vec2i(input.uv*vec2f(size)),vec2i(0),size-1);
  let center = textureLoad(image,p,0); var rgb = vec3f(0); var weights = 0.0;
  // Depth-aware reconstruction reduces moving-frame noise without blending
  // foreground objects across doorway and furniture silhouettes.
  for (var y=-1; y<=1; y++) { for (var x=-1; x<=1; x++) {
    let value = textureLoad(image,clamp(p+vec2i(x,y),vec2i(0),size-1),0);
    let weight = exp(-f32(x*x+y*y)*.65-abs(value.a-center.a)/max(.02,center.a*.025));
    rgb += value.rgb*weight; weights += weight;
  }}
  rgb /= weights; rgb = vec3f(1)-exp(-max(rgb,vec3f(0))*1.12);
  return vec4f(pow(rgb,vec3f(1.0/2.2)),1);
}`;

export class OfficePathTracer {
  static async create(options) {
    const tracer = new OfficePathTracer(options);
    try { await tracer.initialize(); return tracer; }
    catch (error) { tracer.dispose(); throw error; }
  }

  constructor({ renderer, scene, camera, beam, laptopGlow, screen, root, onStatus }) {
    Object.assign(this, { renderer, scene, camera, beam, laptopGlow, screen, root, onStatus });
    this.device = renderer.backend.device;
    this.canvas = document.createElement('canvas'); this.canvas.className = 'pathtrace-canvas';
    this.canvas.setAttribute('aria-hidden', 'true'); this.canvas.hidden = true;
    this.root.append(this.canvas); this.context = this.canvas.getContext('webgpu');
    this.resources = []; this.samples = 0; this.frame = 0; this.pending = false;
    this.widthLimit = 128; this.maxBounces = 4; this.enabled = false; this.disposed = false;
  }

  buffer(data, usage = STORAGE) {
    const size = Math.max(16, data.byteLength || data);
    const buffer = this.device.createBuffer({ size: Math.ceil(size / 16) * 16, usage });
    if (data.byteLength) this.device.queue.writeBuffer(buffer, 0, data);
    this.resources.push(buffer); return buffer;
  }

  async initialize() {
    const response = await fetch(new URL('./night-shift-pathtrace.wgsl', import.meta.url));
    if (!response.ok) throw new Error('Could not load the ray-tracing shader.');
    const source = await response.text();
    this.context.configure({ device: this.device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' });
    this.prepareGeometry(); this.prepareMaterials();
    this.uniform = this.buffer(272, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.objects = this.buffer(this.records.length * 80);
    this.sceneNodes = this.buffer(this.records.length * 64);
    this.order = this.buffer(this.records.length * 4);
    const module = this.device.createShaderModule({ code: source, label: 'Night Shift multi-bounce path tracer' });
    const messages = await module.getCompilationInfo();
    const errors = messages.messages.filter(message => message.type === 'error');
    if (errors.length) throw new Error(errors.map(error => `${error.lineNum}: ${error.message}`).join('\n'));
    this.compute = await this.device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    const presentModule = this.device.createShaderModule({ code: PRESENT });
    this.present = await this.device.createRenderPipelineAsync({ layout: 'auto',
      vertex: { module: presentModule, entryPoint: 'vertex' },
      fragment: { module: presentModule, entryPoint: 'fragment', targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }] },
      primitive: { topology: 'triangle-list' } });
    this.resize();
  }

  prepareGeometry() {
    this.scene.updateMatrixWorld(true);
    const nodes = [], ordered = [], cache = new Map(); this.records = [];
    const spriteGeometry = new THREE.PlaneGeometry(1, 1);
    this.scene.traverse(mesh => {
      if (!mesh.isMesh && !mesh.isSprite) return;
      const geometry = mesh.isSprite ? spriteGeometry : mesh.geometry;
      if (!geometry?.attributes.position || Array.isArray(mesh.material)) return;
      const primitive = /^(Box|Sphere|Cylinder|Capsule|Plane)Geometry$/.test(geometry.type);
      const key = primitive ? geometry.type + JSON.stringify(geometry.parameters) : geometry.uuid;
      let blas = cache.get(key);
      if (!blas) {
        const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
        const index = geometry.index, triangleCount = (index ? index.count : position.count) / 3;
        const items = [];
        for (let triangle = 0; triangle < triangleCount; triangle++) {
          const vertices = [0, 1, 2].map(v => index ? index.getX(triangle * 3 + v) : triangle * 3 + v);
          const p = vertices.map(v => [position.getX(v), position.getY(v), position.getZ(v)]);
          const data = new Float32Array(24);
          vertices.forEach((v, corner) => {
            data.set([...p[corner], uv ? uv.getY(v) : 0], corner * 4);
            data.set([normal ? normal.getX(v) : 0, normal ? normal.getY(v) : 1, normal ? normal.getZ(v) : 0, uv ? uv.getX(v) : 0], 12 + corner * 4);
          });
          items.push({ data, lo: [0, 1, 2].map(a => Math.min(...p.map(v => v[a]))), hi: [0, 1, 2].map(a => Math.max(...p.map(v => v[a]))) });
        }
        blas = buildBVH(items, nodes, ordered).root; cache.set(key, blas);
      }
      geometry.computeBoundingBox();
      this.records.push({ mesh, blas, bounds: geometry.boundingBox.clone(), matrix: new THREE.Matrix4(), inverse: new THREE.Matrix4(), material: 0 });
    });
    const data = new Float32Array(ordered.length * 24);
    ordered.forEach((triangle, i) => data.set(triangle.data, i * 24));
    this.geometryNodes = this.buffer(packNodes(nodes)); this.triangles = this.buffer(data);
    this.triangleCount = ordered.length; this.geometryCount = cache.size;
    spriteGeometry.dispose();
  }

  prepareMaterials() {
    this.materialList = []; this.textureList = [];
    const unique = new Map();
    for (const record of this.records) {
      const material = record.mesh.material;
      if (!unique.has(material)) { unique.set(material, this.materialList.length); this.materialList.push(material); }
      record.material = unique.get(material);
      if (material.map && !this.textureList.includes(material.map)) this.textureList.push(material.map);
    }
    this.atlas = this.device.createTexture({ size: [256, 256, Math.max(1, this.textureList.length)], format: 'rgba8unorm-srgb',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.resources.push(this.atlas);
    this.mapSampler = this.device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
    this.textureVersions = new Map(); this.uploadMaps(true);
    const data = new Float32Array(this.materialList.length * 16);
    this.materialList.forEach((material, i) => {
      const color = material.color || new THREE.Color(1, 1, 1), base = i * 16;
      data.set([color.r, color.g, color.b, material.opacity ?? 1], base);
      data.set([material.roughness ?? .9, material.metalness ?? 0, 0, this.textureList.indexOf(material.map)], base + 4);
      // Basic materials are emissive in the tracer: the physical laptop texture
      // is black while idle and becomes an actual emitting surface when powered.
      const emission = material.isMeshBasicNodeMaterial ? color : material.emissive || new THREE.Color(0, 0, 0);
      const strength = material.isMeshBasicNodeMaterial ? 1 : material.emissiveIntensity ?? 1;
      data.set([emission.r * strength, emission.g * strength, emission.b * strength, 0], base + 8);
      data.set([material.map?.repeat.x ?? 1, material.map?.repeat.y ?? 1,
        material.map?.wrapS === THREE.RepeatWrapping ? 1 : 0, material.map?.wrapT === THREE.RepeatWrapping ? 1 : 0], base + 12);
    });
    this.materialData=data;this.materials = this.buffer(data);
  }

  uploadMaps(force = false) {
    let changed = false;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    this.textureList.forEach((texture, layer) => {
      if (!force && this.textureVersions.get(texture) === texture.version) return;
      const image = texture.image;
      context.clearRect(0, 0, 256, 256);
      if (image && (image.width || image.videoWidth) && (!('complete' in image) || image.complete)) context.drawImage(image, 0, 0, 256, 256);
      this.device.queue.writeTexture({ texture: this.atlas, origin: [0, 0, layer] }, context.getImageData(0, 0, 256, 256).data,
        { bytesPerRow: 1024, rowsPerImage: 256 }, [256, 256, 1]);
      this.textureVersions.set(texture, texture.version); changed = true;
    });
    return changed;
  }

  resize() {
    const width = this.widthLimit, height = Math.max(64, Math.round(width * innerHeight / innerWidth));
    if (this.canvas.width === width && this.canvas.height === height && this.output) return;
    this.canvas.width = width; this.canvas.height = height; this.samples = 0;
    this.accumulation?.destroy(); this.output?.destroy();
    this.accumulation = this.device.createBuffer({ size: width * height * 16, usage: STORAGE });
    this.output = this.device.createTexture({ size: [width, height], format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
    this.computeGroup = this.device.createBindGroup({ layout: this.compute.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.uniform } }, { binding: 1, resource: { buffer: this.geometryNodes } },
      { binding: 2, resource: { buffer: this.triangles } }, { binding: 3, resource: { buffer: this.objects } },
      { binding: 4, resource: { buffer: this.sceneNodes } }, { binding: 5, resource: { buffer: this.order } },
      { binding: 6, resource: { buffer: this.materials } }, { binding: 7, resource: { buffer: this.accumulation } },
      { binding: 8, resource: this.output.createView() }, { binding: 9, resource: this.atlas.createView({ dimension: '2d-array' }) },
      { binding: 10, resource: this.mapSampler },
    ] });
    this.presentGroup = this.device.createBindGroup({ layout: this.present.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: this.output.createView() }] });
  }

  setEnabled(enabled) {
    this.enabled = enabled; this.canvas.hidden = !enabled; this.samples = 0;
    this.root.dataset.lighting = enabled ? 'path-tracing' : 'dynamic';
    this.onStatus?.(enabled ? 'Ray tracing · refining when still' : `Dynamic lighting · ${this.root.dataset.renderer === 'webgpu' ? 'WebGPU' : 'WebGL2'}`);
  }

  updateScene() {
    this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
    const objects = new ArrayBuffer(this.records.length * 80), floats = new Float32Array(objects), ints = new Uint32Array(objects);
    const items = [], position = new THREE.Vector3(), scale = new THREE.Vector3();
    let hash = 2166136261;
    for (let id = 0; id < this.records.length; id++) {
      const record = this.records[id], mesh = record.mesh;
      let visible = true; for (let parent = mesh; parent; parent = parent.parent) if (!parent.visible) visible = false;
      if (!visible) continue;
      record.matrix.copy(mesh.matrixWorld);
      if (mesh.isSprite) {
        mesh.getWorldPosition(position); mesh.getWorldScale(scale);
        const rotation = this.camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), mesh.material.rotation));
        record.matrix.compose(position, rotation, scale);
      }
      record.inverse.copy(record.matrix).invert(); floats.set(record.inverse.elements, id * 20);
      ints[id * 20 + 16] = record.blas; ints[id * 20 + 17] = record.material;
      ints[id * 20 + 18] = mesh.isSprite ? THREE.DoubleSide : mesh.material.side;
      const box = record.bounds.clone().applyMatrix4(record.matrix);
      items.push({ id, lo: box.min.toArray(), hi: box.max.toArray() });
      for (const value of record.matrix.elements) hash = Math.imul(hash ^ Math.round(value * 10000), 16777619);
      hash = Math.imul(hash ^ id, 16777619);
    }
    this.materialList.forEach((material,i)=>{this.materialData[i*16+3]=material.opacity??1;});
    this.device.queue.writeBuffer(this.materials,0,this.materialData);
    const tree = buildBVH(items);
    this.device.queue.writeBuffer(this.objects, 0, objects);
    this.device.queue.writeBuffer(this.sceneNodes, 0, packNodes(tree.nodes));
    this.device.queue.writeBuffer(this.order, 0, new Uint32Array(tree.order.map(item => item.id)));
    this.visibleCount = items.length; return hash >>> 0;
  }

  render(now = performance.now()) {
    if (!this.enabled || this.pending || this.disposed) return;
    this.resize(); const hash = this.updateScene();
    const data = new ArrayBuffer(272), floats = new Float32Array(data), ints = new Uint32Array(data);
    floats.set(this.camera.projectionMatrixInverse.elements, 0); floats.set(this.camera.matrixWorld.elements, 16);
    const position = new THREE.Vector3(); this.camera.getWorldPosition(position); floats.set([...position.toArray(), 0], 32);
    floats.set([...this.beam.position.toArray(), this.beam.intensity], 36);
    const direction = new THREE.Vector3().subVectors(this.beam.target.position, this.beam.position).normalize();
    floats.set([...direction.toArray(), Math.cos(this.beam.angle)], 40);
    floats.set([...this.beam.color.toArray(), Math.cos(this.beam.angle * (1 - this.beam.penumbra))], 44);
    floats.set([...this.laptopGlow.position.toArray(), this.laptopGlow.intensity], 48);
    floats.set([...this.laptopGlow.color.toArray(), this.laptopGlow.distance], 52);
    floats.set([.025, .032, .04, 0], 56);
    const signature = hash + ':' + Array.from(floats.slice(0, 56), value => Math.round(value * 10000)).join(',');
    const powerChanged=this.lastPower!==this.laptopGlow.intensity;this.lastPower=this.laptopGlow.intensity;
    const refreshMaps=powerChanged||now-(this.lastMapUpdate||0)>100;
    const mapsChanged=refreshMaps&&this.uploadMaps();
    if(refreshMaps)this.lastMapUpdate=now;
    if (signature !== this.signature || mapsChanged) this.samples = 0; this.signature = signature;
    ints.set([this.canvas.width, this.canvas.height, this.samples, ++this.frame], 60);
    ints.set([this.maxBounces, 1, this.visibleCount, 0], 64);
    this.device.queue.writeBuffer(this.uniform, 0, data);
    const encoder = this.device.createCommandEncoder();
    const compute = encoder.beginComputePass(); compute.setPipeline(this.compute); compute.setBindGroup(0, this.computeGroup);
    compute.dispatchWorkgroups(Math.ceil(this.canvas.width / 8), Math.ceil(this.canvas.height / 8)); compute.end();
    const present = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(),
      clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    present.setPipeline(this.present); present.setBindGroup(0, this.presentGroup); present.draw(3); present.end();
    this.device.queue.submit([encoder.finish()]); this.samples++; this.pending = true;
    const started = performance.now();
    this.device.queue.onSubmittedWorkDone().then(() => {
      if (this.disposed) return; this.pending = false;
      const duration = performance.now() - started;
      this.averageMs = this.averageMs === undefined ? duration : this.averageMs * .8 + duration * .2;
      if (this.averageMs > 65 && this.widthLimit > 128) {
        this.widthLimit = Math.max(128, this.widthLimit - 32); this.averageMs = undefined;
      } else if (this.frame % 24 === 0 && this.averageMs < 18 && this.widthLimit < 320) {
        this.widthLimit += 32; this.averageMs = undefined;
      }
      if (this.enabled && this.frame % 12 === 0) this.onStatus?.(`Ray tracing · ${this.canvas.width} × ${this.canvas.height} · ${Math.min(this.samples, 97)} samples`);
    }).catch(() => { this.pending = false; this.setEnabled(false); this.onStatus?.('Ray tracing stopped; dynamic lighting is available.'); });
  }

  dispose() {
    this.disposed = true; this.enabled = false;
    for (const resource of this.resources) resource.destroy();
    this.accumulation?.destroy(); this.output?.destroy(); this.canvas.remove();
  }
}
