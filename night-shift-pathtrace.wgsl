// Software BVH traversal on WebGPU. Every pixel traces camera, shadow, and
// secondary reflection/diffuse rays against the actual triangle geometry.
struct Node { lo: vec3f, first: u32, hi: vec3f, count: u32 }
struct Triangle { a: vec4f, b: vec4f, c: vec4f, na: vec4f, nb: vec4f, nc: vec4f }
struct Instance { inverse: mat4x4f, info: vec4u }
struct Material { base: vec4f, surface: vec4f, emission: vec4f, uv: vec4f }
struct Parameters {
  inverseProjection: mat4x4f, cameraWorld: mat4x4f,
  eye: vec4f, flashPosition: vec4f, flashDirection: vec4f, flashColor: vec4f,
  laptopPosition: vec4f, laptopColor: vec4f, environment: vec4f,
  size: vec4u, controls: vec4u,
}
struct Hit { distance: f32, instance: u32, triangle: u32, barycentric: vec2f }
struct Surface { position: vec3f, normal: vec3f, color: vec3f, emission: vec3f,
  roughness: f32, metalness: f32, opacity: f32 }
@group(0) @binding(0) var<uniform> params: Parameters;
@group(0) @binding(1) var<storage, read> geometryNodes: array<Node>;
@group(0) @binding(2) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(3) var<storage, read> instances: array<Instance>;
@group(0) @binding(4) var<storage, read> sceneNodes: array<Node>;
@group(0) @binding(5) var<storage, read> instanceOrder: array<u32>;
@group(0) @binding(6) var<storage, read> materials: array<Material>;
@group(0) @binding(7) var<storage, read_write> accumulation: array<vec4f>;
@group(0) @binding(8) var output: texture_storage_2d<rgba16float, write>;
@group(0) @binding(9) var maps: texture_2d_array<f32>;
@group(0) @binding(10) var mapSampler: sampler;
const FAR: f32 = 10000.0;
var<private> rng: u32;
fn random() -> f32 {
  rng = rng * 1664525u + 1013904223u;
  var x = rng;
  x = ((x >> 16u) ^ x) * 2246822519u;
  x = ((x >> 13u) ^ x) * 3266489917u;
  return f32((x ^ (x >> 16u)) & 0x00ffffffu) / 16777216.0;
}
fn boxHit(origin: vec3f, direction: vec3f, node: Node, limit: f32) -> bool {
  let inv = 1.0 / select(direction, vec3f(0.0000001), abs(direction) < vec3f(0.0000001));
  let a = (node.lo - origin) * inv;
  let b = (node.hi - origin) * inv;
  let near = min(a, b); let far = max(a, b);
  return max(max(near.x, near.y), max(near.z, 0.0002)) <= min(min(far.x, far.y), min(far.z, limit));
}
fn triangleHit(origin: vec3f, direction: vec3f, tri: Triangle, limit: f32, side: u32) -> vec3f {
  let e1 = tri.b.xyz - tri.a.xyz; let e2 = tri.c.xyz - tri.a.xyz;
  let p = cross(direction, e2); let determinant = dot(e1, p);
  if abs(determinant) < 0.00000001 { return vec3f(FAR); }
  if (side == 0u && determinant < 0.0) || (side == 1u && determinant > 0.0) { return vec3f(FAR); }
  let inverse = 1.0 / determinant; let t = origin - tri.a.xyz;
  let u = dot(t, p) * inverse;
  if u < 0.0 || u > 1.0 { return vec3f(FAR); }
  let q = cross(t, e1); let v = dot(direction, q) * inverse;
  if v < 0.0 || u + v > 1.0 { return vec3f(FAR); }
  let distance = dot(e2, q) * inverse;
  if distance <= 0.0002 || distance >= limit { return vec3f(FAR); }
  return vec3f(distance, u, v);
}
fn trace(origin: vec3f, direction: vec3f, limit: f32) -> Hit {
  var result = Hit(limit, 0xffffffffu, 0u, vec2f(0));
  if params.controls.z == 0u { return result; }
  var sceneStack: array<u32, 32>; var sceneCount = 1u; sceneStack[0] = 0u;
  loop {
    if sceneCount == 0u { break; }
    sceneCount--; let node = sceneNodes[sceneStack[sceneCount]];
    if !boxHit(origin, direction, node, result.distance) { continue; }
    if node.count == 0u {
      if sceneCount < 30u { sceneStack[sceneCount] = node.first; sceneStack[sceneCount+1u] = node.first+1u; sceneCount += 2u; }
      continue;
    }
    for (var k = 0u; k < node.count; k++) {
      let instanceId = instanceOrder[node.first+k]; let object = instances[instanceId];
      let localOrigin = (object.inverse * vec4f(origin, 1)).xyz;
      // Do not normalize: intersection distance remains in world-ray units.
      let localDirection = (object.inverse * vec4f(direction, 0)).xyz;
      var stack: array<u32, 48>; var count = 1u; stack[0] = object.info.x;
      loop {
        if count == 0u { break; }
        count--; let geometry = geometryNodes[stack[count]];
        if !boxHit(localOrigin, localDirection, geometry, result.distance) { continue; }
        if geometry.count == 0u {
          if count < 46u { stack[count] = geometry.first; stack[count+1u] = geometry.first+1u; count += 2u; }
          continue;
        }
        for (var j = 0u; j < geometry.count; j++) {
          let id = geometry.first+j;
          let hit = triangleHit(localOrigin, localDirection, triangles[id], result.distance, object.info.z);
          if hit.x < result.distance { result = Hit(hit.x, instanceId, id, hit.yz); }
        }
      }
    }
  }
  return result;
}
fn surface(hit: Hit, origin: vec3f, direction: vec3f) -> Surface {
  let object = instances[hit.instance]; let tri = triangles[hit.triangle];
  let material = materials[object.info.y];
  let weights = vec3f(1.0-hit.barycentric.x-hit.barycentric.y, hit.barycentric);
  let localNormal = tri.na.xyz*weights.x+tri.nb.xyz*weights.y+tri.nc.xyz*weights.z;
  var normal = normalize((transpose(object.inverse)*vec4f(localNormal, 0)).xyz);
  if dot(normal, direction) > 0.0 { normal = -normal; }
  let uv = vec2f(dot(vec3f(tri.na.w,tri.nb.w,tri.nc.w),weights), dot(vec3f(tri.a.w,tri.b.w,tri.c.w),weights));
  var texel = vec4f(1);
  if material.surface.w >= 0.0 {
    var coordinate = uv*material.uv.xy;
    coordinate = select(clamp(coordinate,vec2f(0),vec2f(1)),fract(coordinate),material.uv.zw > vec2f(0));
    texel = textureSampleLevel(maps,mapSampler,vec2f(coordinate.x,1.0-coordinate.y),i32(material.surface.w),0.0);
  }
  let color = material.base.rgb*texel.rgb;
  return Surface(origin+direction*hit.distance,normal,color,material.emission.rgb*texel.rgb,
    material.surface.x,material.surface.y,material.base.a*texel.a);
}
fn visible(origin: vec3f, direction: vec3f, distance: f32) -> bool {
  var start = origin; var remaining = distance;
  for (var i = 0u; i < 12u; i++) {
    let hit = trace(start,direction,remaining);
    if hit.instance == 0xffffffffu { return true; }
    let s = surface(hit,start,direction);
    if random() < s.opacity { return false; }
    let step = hit.distance+0.001; start += direction*step; remaining -= step;
    if remaining <= 0.001 { return true; }
  }
  return false;
}
fn hemisphere(normal: vec3f) -> vec3f {
  let a = 6.2831853*random(); let r = sqrt(random());
  let axis = select(vec3f(0,1,0),vec3f(1,0,0),abs(normal.y)>0.9);
  let tangent = normalize(cross(axis,normal)); let bitangent = cross(normal,tangent);
  return normalize(tangent*(cos(a)*r)+bitangent*(sin(a)*r)+normal*sqrt(1.0-r*r));
}
fn directLight(s: Surface, position: vec3f, color: vec3f, intensity: f32, flashlight: bool) -> vec3f {
  if intensity <= 0.0 { return vec3f(0); }
  // Finite emitter radius produces ray-traced soft shadow penumbras.
  let lightPosition = position+vec3f(random()-.5,random()-.5,random()-.5)*select(.035,.018,flashlight);
  let delta = lightPosition-s.position; let distance = length(delta); let direction = delta/distance;
  let cosine = max(0.0,dot(s.normal,direction));
  if cosine <= 0.0 { return vec3f(0); }
  var attenuation = 1.0;
  if flashlight {
    attenuation = smoothstep(params.flashDirection.w,params.flashColor.w,dot(params.flashDirection.xyz,-direction));
    attenuation *= pow(clamp(1.0-pow(distance/16.0,4.0),0.0,1.0),2.0);
  } else {
    attenuation = pow(clamp(1.0-pow(distance/params.laptopColor.w,4.0),0.0,1.0),2.0);
  }
  if attenuation < .0001 || !visible(s.position+s.normal*.002,direction,distance-.004) { return vec3f(0); }
  return s.color*(1.0-s.metalness)*color*intensity*attenuation*cosine/(3.14159265*max(.02,distance*distance));
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) pixel: vec3u) {
  if pixel.x >= params.size.x || pixel.y >= params.size.y { return; }
  let index = pixel.y*params.size.x+pixel.x;
  rng = index*9781u+params.size.w*6271u+13u;
  let jitter = vec2f(random(),random());
  let uv = (vec2f(pixel.xy)+jitter)/vec2f(params.size.xy);
  let projected = params.inverseProjection*vec4f(uv.x*2.0-1.0,1.0-uv.y*2.0,0.5,1.0);
  var direction = normalize((params.cameraWorld*vec4f(projected.xyz/projected.w,0)).xyz);
  var origin = params.eye.xyz; var throughput = vec3f(1); var radiance = vec3f(0); var depth = FAR;
  var transparentSteps = 0u; var bounce = 0u;
  loop {
    if bounce >= params.controls.x { break; }
    let hit = trace(origin,direction,FAR);
    if hit.instance == 0xffffffffu {
      radiance += throughput*params.environment.rgb*mix(.4,1.0,clamp(direction.y*.5+.5,0.0,1.0)); break;
    }
    let s = surface(hit,origin,direction);
    if random() > s.opacity && transparentSteps < 16u { origin = s.position+direction*.001; transparentSteps++; continue; }
    if bounce == 0u { depth = hit.distance; }
    radiance += throughput*s.emission;
    // A small night-adaptation floor retains the readable silhouette of the
    // existing game; all direct, reflected, and bounced lighting is traced.
    if bounce == 0u { radiance += s.color*.045*mix(1.0,.12,smoothstep(4.15,5.3,abs(s.position.x))); }
    radiance += throughput*directLight(s,params.flashPosition.xyz,params.flashColor.rgb,params.flashPosition.w,true);
    radiance += throughput*directLight(s,params.laptopPosition.xyz,params.laptopColor.rgb,params.laptopPosition.w,false);
    let f0 = mix(vec3f(.04),s.color,s.metalness);
    let fresnel = f0+(vec3f(1)-f0)*pow(1.0-max(0.0,dot(-direction,s.normal)),5.0);
    let probability = clamp(dot(fresnel,vec3f(.2126,.7152,.0722)),.05,.95);
    if random() < probability {
      let reflection = reflect(direction,s.normal);
      direction = normalize(mix(reflection,hemisphere(s.normal),s.roughness*s.roughness));
      throughput *= fresnel/probability;
    } else {
      direction = hemisphere(s.normal);
      throughput *= s.color*(vec3f(1)-fresnel)*(1.0-s.metalness)/(1.0-probability);
    }
    if dot(direction,s.normal) <= 0.0 { break; }
    origin = s.position+s.normal*.002;
    bounce++;
    if bounce >= 2u {
      let survival = clamp(max(throughput.x,max(throughput.y,throughput.z)),.1,.95);
      if random() > survival { break; } throughput /= survival;
    }
  }
  radiance = clamp(radiance,vec3f(0),vec3f(24));
  var mean = radiance;
  if params.size.z > 0u { mean = mix(accumulation[index].rgb,radiance,1.0/f32(min(params.size.z,96u)+1u)); }
  accumulation[index] = vec4f(mean,depth);
  textureStore(output,vec2i(pixel.xy),vec4f(mean,min(depth,100.0)));
}
