const $$=s=>[...document.querySelectorAll(s)],$=s=>document.querySelector(s);
function scrollToId(id){document.getElementById(id)?.scrollIntoView({behavior:"smooth"})}
$$("[data-scroll]").forEach(b=>b.onclick=()=>scrollToId(b.dataset.scroll));

const cards=$$("#gamesGrid article"),tabs=$$(".tabs button"),search=$("#search");
let filter="all";
function update(){const q=search.value.toLowerCase();let n=0;cards.forEach(c=>{const ok=(filter==="all"||c.dataset.cat.includes(filter))&&c.dataset.title.toLowerCase().includes(q);c.style.display=ok?"block":"none";if(ok)n++});$("#empty").style.display=n?"none":"block"}
tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;update()});search.oninput=update;

const section=$("#play"),canvas=$("#game"),start=$("#start"),scoreEl=$("#score"),speedHud=$("#hudSpeed"),driftHud=$("#hudDrift");
let renderer,scene,camera,car,roadGroup,raf,running=false,speed=0,steer=0,driftScore=0,roadZ=0;
const keys={};
onkeydown=e=>{keys[e.key.toLowerCase()]=true;if(["arrowleft","arrowright","arrowup","arrowdown"," "].includes(e.key.toLowerCase()))e.preventDefault()};
onkeyup=e=>keys[e.key.toLowerCase()]=false;

function mat(color,roughness=.55,metal=.05){return new THREE.MeshStandardMaterial({color,roughness,metalness:metal})}
function box(w,h,d,m){return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m)}
function makeCar(){
  const g=new THREE.Group(),body=mat(0xd95c3e,.28,.45),dark=mat(0x202a30,.18,.35),rubber=mat(0x111317,.8,0);
  const lower=box(2.0,.42,4.1,body);lower.position.y=.55;g.add(lower);
  const hood=box(1.75,.22,1.35,body);hood.position.set(0,.82,-1.15);g.add(hood);
  const cabin=box(1.55,.55,1.9,dark);cabin.position.set(0,1.02,.25);g.add(cabin);
  const roof=box(1.42,.1,1.65,mat(0x101820,.12,.55));roof.position.set(0,1.33,.25);g.add(roof);
  const wheelGeo=new THREE.CylinderGeometry(.38,.38,.24,24),wheelMat=mat(0x111317,.9,0);
  for(const x of [-.92,.92])for(const z of [-1.35,1.35]){const w=new THREE.Mesh(wheelGeo,wheelMat);w.rotation.z=Math.PI/2;w.position.set(x,.4,z);g.add(w)}
  const light=mat(0xffd99a,.2,.2);for(const x of [-.65,.65]){const l=box(.35,.14,.08,light);l.position.set(x,.69,-2.08);g.add(l)}
  g.position.y=.05;return g;
}
function addEnvironment(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x9db4c0);scene.fog=new THREE.Fog(0x9db4c0,35,180);
  camera=new THREE.PerspectiveCamera(62,1,.1,400);camera.position.set(0,4.4,8.5);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const hemi=new THREE.HemisphereLight(0xddeeff,0x59645d,2.1);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffffff,3.1);sun.position.set(-35,50,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
  const ground=box(180,.25,500,mat(0x68756d,.95,0));ground.position.y=-.25;ground.receiveShadow=true;scene.add(ground);
  roadGroup=new THREE.Group();scene.add(roadGroup);
  const asphalt=mat(0x34393d,.92,0),line=mat(0xe5e3d6,.6,0);
  for(let i=0;i<18;i++){const road=box(10,.08,22,asphalt);road.position.z=-i*22;road.receiveShadow=true;roadGroup.add(road);
    const stripe=box(.13,.09,5,line);stripe.position.set(0,.06,-i*22);roadGroup.add(stripe);
    for(const side of [-1,1]){const edge=box(.12,.1,22,line);edge.position.set(side*4.75,.07,-i*22);roadGroup.add(edge)}
  }
  for(let i=0;i<55;i++){const tree=new THREE.Group(),tr=box(.35,2.1,.35,mat(0x604b38));tr.position.y=1.05;tree.add(tr);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.5,3.6,8),mat(0x315b3b));crown.position.y=3.1;tree.add(crown);const side=i%2?-1:1;tree.position.set(side*(13+(i%4)*4),0,-i*12-20);scene.add(tree)}
  car=makeCar();car.castShadow=true;car.traverse(o=>{if(o.isMesh)o.castShadow=true});scene.add(car);
}
function resize(){if(!renderer)return;const r=canvas.getBoundingClientRect(),w=Math.max(320,r.width),h=Math.max(220,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function reset(){speed=0;steer=0;driftScore=0;roadZ=0;car.position.set(0,0,2.5);car.rotation.set(0,0,0)}
function animate(){
  if(!running)return;
  const gas=keys.w||keys.arrowup,brake=keys.s||keys.arrowdown,left=keys.a||keys.arrowleft,right=keys.d||keys.arrowright,hand=keys[" "];
  speed+=gas?.055:brake?-.11:-.018;speed=Math.max(0,Math.min(1.55,speed));
  const target=(left?-1:0)+(right?1:0);steer+=(target-steer)*.12;
  car.position.x+=steer*(.055+speed*.05);car.position.x*=.997;car.position.x=Math.max(-3.5,Math.min(3.5,car.position.x));
  const sideways=Math.abs(steer)*speed;
  if(hand&&speed>.25){driftScore+=sideways*18;car.rotation.y+=steer*.025;car.rotation.z=THREE.MathUtils.lerp(car.rotation.z,-steer*.13,.16)}
  else{car.rotation.y=THREE.MathUtils.lerp(car.rotation.y,-steer*.18,.12);car.rotation.z=THREE.MathUtils.lerp(car.rotation.z,-steer*.06,.12)}
  roadGroup.position.z=(roadGroup.position.z+speed*1.8)%22;
  camera.position.x+=(car.position.x*.48-camera.position.x)*.06;camera.position.y+=(4.3-camera.position.y)*.06;camera.lookAt(car.position.x*.25,1,-8);
  const kmh=Math.round(speed*115);speedHud.textContent=String(kmh).padStart(3,"0")+" KM/H";scoreEl.textContent="SPEED "+String(kmh).padStart(3,"0")+" KM/H";driftHud.textContent="DRIFT "+Math.round(driftScore);
  renderer.render(scene,camera);raf=requestAnimationFrame(animate);
}
function openGame(){section.style.display="block";scrollToId("play");start.style.display="flex";if(!renderer){addEnvironment();resize()}reset()}
function run(){running=true;start.style.display="none";cancelAnimationFrame(raf);animate()}
$$("[data-game]").forEach(b=>b.onclick=()=>b.dataset.game==="drift"?openGame():alert("That 3D mode is next — the 3D Drift Run is live now."));
$("#startBtn").onclick=run;
$("#close").onclick=()=>{running=false;cancelAnimationFrame(raf);section.style.display="none"};
$("#random").onclick=()=>scrollToId("garage");
$("#randomRide").onclick=()=>{const r=$$(".rides article");r.forEach(x=>x.classList.remove("selected"));r[Math.floor(Math.random()*r.length)].classList.add("selected")};
$$(".rides article").forEach(r=>r.onclick=()=>{$$(".rides article").forEach(x=>x.classList.remove("selected"));r.classList.add("selected")});
addEventListener("resize",resize);