import { CESIUM_ION_TOKEN } from './constants.js?v=20261021-sources-verified';
import { paintedMaterial, paintImagery } from './painted-material.js?v=20261021-sources-verified';
import { trailColor } from './trail-style.js?v=20261021-sources-verified';

export async function createMountain(container, notify, fail, config) {
  const C = window.Cesium;
  if (!C) throw new Error('The Cesium map engine did not load.');
  C.Ion.defaultAccessToken = CESIUM_ION_TOKEN;
  const [terrain, imagery, response] = await Promise.all([
    C.createWorldTerrainAsync({requestVertexNormals:true}),
    C.createWorldImageryAsync({style:C.IonWorldImageryStyle.AERIAL}),
    config.trailsUrl ? fetch(config.trailsUrl) : Promise.resolve(null)
  ]);
  if (response && !response.ok) throw new Error(`Trail data could not load (${response.status}).`);
  const trails = response ? await response.json() : {features:[],landmarks:[]};
  let targetHeight = config.height;
  if (targetHeight === null) {
    const [sample] = await C.sampleTerrainMostDetailed(terrain, [C.Cartographic.fromDegrees(...config.center)]);
    if (!Number.isFinite(sample.height)) throw new Error(`Terrain height could not load for ${config.name}.`);
    targetHeight = sample.height * 1.5 + 120;
  }
  const snowline = config.snowline ?? targetHeight / 1.5 + 100;
  const lonMeters = 111000 * Math.cos(config.center[1] * Math.PI / 180);
  const forestBounds = config.forestBounds;
  const viewer = new C.Viewer(container, {
    terrainProvider:terrain, baseLayer:false, animation:false, timeline:false,
    baseLayerPicker:false, fullscreenButton:false, geocoder:false, homeButton:false,
    infoBox:false, navigationHelpButton:false, sceneModePicker:false,
    selectionIndicator:false, shouldAnimate:false
  });
  try {
  const scene = viewer.scene;
  scene.rethrowRenderErrors = false;
  scene.renderError.addEventListener((_scene, error) => fail(error.message));
  scene.globe.maximumScreenSpaceError = 1.0;
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.enableLighting = true;
  scene.globe.vertexShadowDarkness = 0.52;
  scene.globe.lambertDiffuseMultiplier = 0.72;
  scene.globe.tileCacheSize = 250;
  scene.fog.density = 0.000025;
  scene.fog.minimumBrightness = 0.8;
  scene.skyAtmosphere.brightnessShift = -0.04;
  scene.skyAtmosphere.saturationShift = 0.08;
  scene.postProcessStages.fxaa.enabled = true;
  scene.verticalExaggeration = 1.5;
  viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);
  const aerial = viewer.imageryLayers.addImageryProvider(imagery);
  aerial.show = false;
  const trees = scene.primitives.add(new C.BillboardCollection({scene}));
  const treeCells = new Map();
  const trailClearance = new Set();
  for (const feature of trails.features) {
    if(feature.properties.kind!=='trail')continue;
    const coordinates=feature.geometry.coordinates;
    for(let i=1;i<coordinates.length;i++){
      const a=coordinates[i-1],b=coordinates[i];
      const steps=Math.max(1,Math.ceil(Math.hypot((a[0]-b[0])*lonMeters,(a[1]-b[1])*111000)/15));
      for(let s=0;s<=steps;s++)trailClearance.add(Math.floor((a[0]+(b[0]-a[0])*s/steps)*2500)+':'+Math.floor((a[1]+(b[1]-a[1])*s/steps)*4000));
    }
  }
  const planted = new Set();
  function collectForest(x,y,level,pixels) {
    if(level<11 || treeCells.size>18000) return;
    const rect=imagery.tilingScheme.tileXYToRectangle(x,y,level);
    const projection=imagery.tilingScheme.projection;
    const southwest=projection.project(new C.Cartographic(rect.west,rect.south));
    const northeast=projection.project(new C.Cartographic(rect.east,rect.north));
    const {data,width,height}=pixels;
    for(let py=3;py<height;py+=5) for(let px=3;px<width;px+=5) {
      const i=(py*width+px)*4, r=data[i],g=data[i+1],b=data[i+2];
      if((r*.25+g*.55+b*.2)>92 || g<r*.9 || g<b*.95) continue;
      const position=projection.unproject(new C.Cartesian3(
        southwest.x+(northeast.x-southwest.x)*px/width,
        northeast.y-(northeast.y-southwest.y)*py/height,0));
      const lon=C.Math.toDegrees(position.longitude),lat=C.Math.toDegrees(position.latitude);
      if(lon<forestBounds[0] || lon>forestBounds[2] || lat<forestBounds[1] || lat>forestBounds[3])continue;
      const key=Math.floor(lon*1300)+':'+Math.floor(lat*2000);
      if(!treeCells.has(key)){
        const seed=Math.sin(lon*12753.3+lat*34532.1)*43758.5453;
        const jitter=seed-Math.floor(seed);
        position.longitude+=(jitter-0.5)*0.000009;
        position.latitude+=(Math.sin(seed*7.3)*0.5)*0.000009;
        treeCells.set(key,position);
      }
    }
  }
  const plantForest=()=>{
    if(!scene.globe.tilesLoaded || trees.length>=16000)return;
    for(const [key,position] of treeCells){
      if(trees.length>=16000)break;
      if(planted.has(key))continue;
      const elevation=scene.globe.getHeight(position);
      if(!Number.isFinite(elevation))continue;
      planted.add(key);
      if(elevation/1.5>snowline+50)continue;
      const clearanceKey=Math.floor(C.Math.toDegrees(position.longitude)*2500)+':'+Math.floor(C.Math.toDegrees(position.latitude)*4000);
      if(trailClearance.has(clearanceKey))continue;
      const size=30+Math.abs(Math.sin(position.longitude*100000))*14;
      trees.add({position:C.Cartesian3.fromRadians(position.longitude,position.latitude,0),
        heightReference:C.HeightReference.CLAMP_TO_GROUND,
        image:new URL('../assets/painted-conifer.png',import.meta.url).href,sizeInMeters:true,width:size,height:size*1.6,
        verticalOrigin:C.VerticalOrigin.BOTTOM,
        distanceDisplayCondition:new C.DistanceDisplayCondition(0,42000)});
    }
    container.dataset.trees=String(trees.length);
    container.dataset.treeCandidates=String(treeCells.size);
  };
  scene.globe.tileLoadProgressEvent.addEventListener(plantForest);
  const layer = viewer.imageryLayers.addImageryProvider(paintImagery(imagery,collectForest));
  layer.errorEvent.addEventListener(error => fail(`Painted imagery: ${error.message}`));
  imagery.errorEvent.addEventListener(error => fail(`Aerial imagery: ${error.message}`));
  terrain.errorEvent.addEventListener(error => fail(`Terrain: ${error.message}`));
  const material = paintedMaterial(C, trails.features, config.bounds, snowline, lonMeters);
  scene.globe.material = material;
  const controller = scene.screenSpaceCameraController;
  controller.enableInputs = false;
  let activeArea = config;
  const homePose = () => ({heading:config.heading,pitch:config.pitch,
    range:container.clientWidth<600
      ? (activeArea === config && config.mobileRange || activeArea.range * 600 / Math.max(container.clientWidth,320))
      : activeArea.range});
  let home = homePose();
  let pose = {...home}, globe = false, mode = 'orbit', disposed = false;
  let target = C.Cartesian3.fromDegrees(...config.center, targetHeight);
  const lightDirection = C.Matrix4.multiplyByPointAsVector(
    C.Transforms.eastNorthUpToFixedFrame(target), new C.Cartesian3(0.4,0.3,-0.86),new C.Cartesian3());
  scene.light = new C.DirectionalLight({direction:C.Cartesian3.normalize(lightDirection,lightDirection),intensity:1.05});
  const trailSource = new C.CustomDataSource('Mapped ski trails');
  const liftSource = new C.CustomDataSource('Mapped lifts');
  const labels = new C.CustomDataSource('Mountain labels');
  viewer.dataSources.add(trailSource); viewer.dataSources.add(liftSource); viewer.dataSources.add(labels);
  const routeLength = feature => feature.geometry.coordinates.slice(1).reduce((total, point, i) => {
    const previous = feature.geometry.coordinates[i];
    return total + Math.hypot((point[0]-previous[0])*lonMeters,(point[1]-previous[1])*111000);
  },0);
  const namedLengths = new Map();
  for (const feature of trails.features) {
    if (feature.properties.kind !== 'trail') continue;
    const key = feature.properties.name || feature.properties.id;
    namedLengths.set(key,(namedLengths.get(key)||0)+routeLength(feature));
  }
  let runCount=0, liftCount=0;
  for (const feature of trails.features) {
    const p = feature.properties, lift = p.kind === 'lift';
    const positions = C.Cartesian3.fromDegreesArray(feature.geometry.coordinates.flatMap(p=>p.slice(0,2)));
    if (positions.length < 2) continue;
    const color = C.Color.fromCssColorString(lift ? '#edac48' : trailColor(p.difficulty,p.convention || config.convention));
    const source = lift ? liftSource : trailSource;
    const length = namedLengths.get(p.name || p.id) || 0;
    const detailDistance = lift || length >= 750 ? Math.max(45000,config.range*2) : length >= 300 ? 10500 : 7500;
    source.entities.add({name:p.name, properties:p, polyline:{
      positions, clampToGround:true, width:lift?3.5:length>=750?3:2.2,
      material:lift ? new C.PolylineDashMaterialProperty({color,dashLength:20}) : new C.PolylineOutlineMaterialProperty({color,outlineColor:C.Color.WHITE.withAlpha(0.92),outlineWidth:0.85}),
      distanceDisplayCondition:new C.DistanceDisplayCondition(0,detailDistance),
      classificationType:C.ClassificationType.TERRAIN
    }});
    if(lift) liftCount++; else runCount++;
  }
  // Landmark positions come from the local OSM snapshot, not the concept image.
  for (const landmark of trails.landmarks || []) {
    labels.entities.add({position:C.Cartesian3.fromDegrees(...landmark.coordinates),label:{
      text:landmark.name.toUpperCase(), font:'700 15px "Barlow Condensed", sans-serif',
      fillColor:C.Color.WHITE, showBackground:true,
      backgroundColor:C.Color.fromCssColorString('#122537').withAlpha(0.92),
      backgroundPadding:new C.Cartesian2(10,7), pixelOffset:new C.Cartesian2(0,-25),
      heightReference:C.HeightReference.CLAMP_TO_GROUND,
      verticalOrigin:C.VerticalOrigin.BOTTOM,
      distanceDisplayCondition:new C.DistanceDisplayCondition(0,70000)
    }});
  }
  // A few mapped run names orient the overview; finer labels stay out of the way.
  const namedLabels = config.namedLabels;
  const anchoredLabels = namedLabels.map(item => {
    const feature = trails.features.filter(feature => feature.properties.name === item.name)
      .sort((a,b)=>routeLength(b)-routeLength(a))[0];
    if (!feature) throw new Error(`Mapped label route missing: ${item.name}`);
    const coords = feature.geometry.coordinates;
    const anchor = coords[Math.floor(coords.length*0.55)];
    return {...item,anchor};
  });
  const labelHeights = anchoredLabels.length ? await C.sampleTerrainMostDetailed(terrain,
    anchoredLabels.map(item=>C.Cartographic.fromDegrees(...item.anchor))) : [];
  anchoredLabels.forEach((item,index) => {
    const height = labelHeights[index].height;
    if (!Number.isFinite(height)) throw new Error(`Terrain height missing for label: ${item.name}`);
    // A sampled world position keeps glyphs and paper backgrounds together.
    labels.entities.add({position:C.Cartesian3.fromDegrees(item.anchor[0],item.anchor[1],height*1.5+35),label:{
      text:item.text,font:'700 14px "Barlow Condensed", sans-serif',
      fillColor:C.Color.fromCssColorString('#19344c'),
      outlineColor:C.Color.fromCssColorString('#fffdf4'),outlineWidth:0,
      style:C.LabelStyle.FILL,showBackground:true,
      disableDepthTestDistance:Number.POSITIVE_INFINITY,
      backgroundColor:C.Color.fromCssColorString('#fffdf4').withAlpha(0.92),
      backgroundPadding:new C.Cartesian2(6,4),
      pixelOffset:new C.Cartesian2(...item.offset),
      heightReference:C.HeightReference.NONE,
      verticalOrigin:C.VerticalOrigin.BOTTOM,
      distanceDisplayCondition:new C.DistanceDisplayCondition(0,17000)
    }});
  });
  container.dataset.majorRoutes = String([...namedLengths.values()].filter(length=>length>=750).length);
  function renderPose() {
    if(disposed || globe) return;
    viewer.camera.lookAt(target,new C.HeadingPitchRange(C.Math.toRadians(pose.heading),C.Math.toRadians(pose.pitch),pose.range));
    container.dataset.heading = pose.heading.toFixed(1);
    container.dataset.pitch = pose.pitch.toFixed(1);
    container.dataset.range = pose.range.toFixed(0);
    scene.requestRender();
  }
  renderPose();
  function change(dh=0, dp=0, zoom=1) {
    viewer.camera.cancelFlight();
    pose.heading = (pose.heading+dh+360)%360;
    pose.pitch = Math.max(-82,Math.min(-16,pose.pitch+dp));
    const minimumRange = activeArea === config && config.minRange || Math.min(3500,activeArea.range*.15);
    pose.range = Math.max(minimumRange,Math.min(Math.max(45000,config.range*3),pose.range*zoom));
    renderPose();
  }
  const canvas = scene.canvas;
  canvas.setAttribute('aria-label',`Interactive painted ${config.name} terrain. Arrow keys rotate and tilt; plus and minus zoom.`);
  canvas.tabIndex=0;
  const pointers = new Map(); let previousPinch=null;
  const down=e=>{if(globe)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);};
  const move=e=>{
    if(globe || !pointers.has(e.pointerId)) return;
    const last = pointers.get(e.pointerId); pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if(pointers.size===2) {
      const [a,b]=[...pointers.values()];const distance=Math.hypot(a[0]-b[0],a[1]-b[1]);
      if(previousPinch) change(0,0,previousPinch/distance);
      previousPinch=distance; return;
    }
    change(mode==='orbit' ? -(e.clientX-last[0])*0.22 : 0, (e.clientY-last[1])*0.13);
  };
  const up=e=>{pointers.delete(e.pointerId);previousPinch=null;};
  const wheel=e=>{if(globe)return;e.preventDefault();change(0,0,Math.exp(e.deltaY*0.001));};
  const key=e=>{
    if(globe || e.target.closest('select,input,textarea,[contenteditable="true"]'))return;
    const actions={ArrowLeft:()=>change(-7),ArrowRight:()=>change(7),ArrowUp:()=>change(0,-5),ArrowDown:()=>change(0,5),'+':()=>change(0,0,0.85),'=':()=>change(0,0,0.85),'-':()=>change(0,0,1.18)};
    if(actions[e.key]){e.preventDefault();actions[e.key]();}
  };
  canvas.addEventListener('click',()=>canvas.focus({preventScroll:true}));
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',wheel,{passive:false});document.addEventListener('keydown',key);
  const selection = new C.ScreenSpaceEventHandler(canvas);
  selection.setInputAction(click=>{
    const picked=scene.pick(click.position),entity=picked?.id;
    if(entity?.properties) notify({selection:{name:entity.name,kind:entity.properties.kind.getValue(),difficulty:entity.properties.difficulty?.getValue()}});
  },C.ScreenSpaceEventType.LEFT_CLICK);
  notify({ready:true,runCount,liftCount});
  const api = {
    async focusArea(areaId) {
      const area = areaId ? config.views.find(item=>item.id===areaId) : config;
      if (!area) throw new Error('Mapped mountain area not found.');
      const [sample] = await C.sampleTerrainMostDetailed(terrain,[C.Cartographic.fromDegrees(...area.center)]);
      if(disposed)return;
      if(!Number.isFinite(sample.height))throw new Error(`Terrain height missing for ${area.name}.`);
      activeArea=area;
      viewer.camera.cancelFlight();
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
      target=C.Cartesian3.fromDegrees(...area.center,area===config?targetHeight:sample.height*1.5+120);
      home=homePose();pose={...home};
      container.dataset.area=area.name;
      api.flyIn();
    },
    setMode(value){mode=value;},
    reset(){viewer.camera.cancelFlight();home=homePose();pose={...home};renderPose();},
    rotate(){change(35);},
    tilt(){change(0,pose.pitch < -45 ? 25 : -20);},
    zoom(value){change(0,0,value);},
    showTrails(value){trailSource.show=value;},showLifts(value){liftSource.show=value;},
    globe(){
      globe=true; controller.enableInputs=true;
      trailSource.show=false;liftSource.show=false;labels.show=false;trees.show=false;
      scene.globe.material=undefined;layer.show=false;aerial.show=true;
      viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
      viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(config.center[0],config.center[1],17000000),duration:2});
      notify({view:'globe',selection:null});
    },
    flyIn(){
      controller.enableInputs=false;globe=false;home=homePose();pose={...home};
      layer.show=true;aerial.show=false;scene.globe.material=material;trailSource.show=true;liftSource.show=true;labels.show=true;trees.show=true;
      viewer.camera.flyToBoundingSphere(new C.BoundingSphere(target,100),{
        duration:2.8,offset:new C.HeadingPitchRange(C.Math.toRadians(home.heading),C.Math.toRadians(home.pitch),home.range),
        complete:renderPose
      });
      notify({view:'resort',selection:null});
    },
    destroy(){disposed=true;document.removeEventListener('keydown',key);selection.destroy();viewer.destroy();}
  };
  return api;
  } catch (error) {
    viewer.destroy();
    throw error;
  }
}
