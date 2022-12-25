import * as THREE from 'three';
import { VRMLLoader } from 'three/addons/loaders/VRMLLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const wrlFileName = "./model/large.wrl";
const Scale = 2.5;


//----------------------RENDER RELATED VARIABLES-----------------------------------------
var stopAnimation = false;
var webGLRenderer, camera, scene, renderTarget;
const finalScene =  new THREE.Scene();
var toRender = false;
var workerModel;
var controls;

var center = {x:0, y:0, z:0};
const box = new THREE.Box3();
var assembly = new THREE.Object3D();

const debug=false;
//---------------------------------------------------------------------------------------


//---------------------GENETIC ALGORITHM VARIABLES--------------------------
const POPULATION_SIZE = 15; 
const RADIUS = 500;
const MIN_SAME_COUNT = 2;
var ModelSurfaceArea=0;
const colorToComponent = {};
var totalComponents = 0;

var RANDOM_RANGE = 1000;//Determines how fine the camera positions are generated

var previous_fitness = 0;
var prev_fit_count = 0;
var bestFit = false;

//-----------------------------------------------------------------------------

//------------FUNCTION TO CALCULATE DISTANCE BETWEEN TWO POINTS------------------
const calculateDistance = (p1, p2)=>{
    var x = Math.pow((p1.x - p2.x),2);
    var y = Math.pow((p1.y - p2.y),2);
    var z = Math.pow((p1.z - p2.z),2);
    var dist = Math.sqrt(x+y+z);
    return dist;
}
//---------------------------------------------------------------------------------
//------------------------FUNCTION TO CALCULATE TOTAL SURFACE AREA OF THE MODEL(MIGHT BE IRRELEVANT)----------------------------
const getArea = (mesh)=>{
    var posAttr = mesh.geometry.attributes.position;
    var size = posAttr.count;

    var SurfaceArea = 0;
    for(var i=0; i<size; i+=9)
    {
        // i,   i+1, i+2 -> V1
        // i+3, i+4, i+5 -> V2
        // i+6, i+7, i+8 -> V3
        var v1 = new THREE.Vector3(posAttr.array[i],posAttr.array[i+1],posAttr.array[i+2]);
        var v2 = new THREE.Vector3(posAttr.array[i+3],posAttr.array[i+4],posAttr.array[i+5]);
        var v3 = new THREE.Vector3(posAttr.array[i+6],posAttr.array[i+7],posAttr.array[i+8]);      
        
        var s1 = calculateDistance(v1, v2);
        var s2 = calculateDistance(v2, v3);
        var s3 = calculateDistance(v1, v3);

        var s = (s1 + s2 + s3) / 2;
        var area = Math.sqrt(s * ((s - s1) * (s - s2) * (s - s3)));
        SurfaceArea += area;
    }
    return SurfaceArea;
}
//------------------------------------------------------------------------------------------------------------------------------
//--------------------------------RENDER INITIALISATION FUNCTION----------------------------------------------------------------
function init(model)
{
    toRender = true;
    const sizes = {
        width: window.innerWidth,
        height: window.innerHeight
    }
    
    webGLRenderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    webGLRenderer.setClearColor(new THREE.Color("rgb(255,255,255)"));
    webGLRenderer.setSize(sizes.width, sizes.height);
    scene = new THREE.Scene();

    workerModel = model.clone(true);

    var i = 0;
    workerModel.traverse(function(child){
        if(child instanceof THREE.Mesh){
            i = i + 1;
            colorToComponent[i*2] = new THREE.Color(i*2);
            const pickingMaterial = new THREE.MeshPhongMaterial({
                emissive: new THREE.Color(i*2),
                color: new THREE.Color(0, 0, 0),
                specular: new THREE.Color(0, 0, 0),
                transparent: true,
                side: THREE.DoubleSide,
                alphaTest: 0.5,
                blending: THREE.NoBlending,
              });
            const pickingComponent = new THREE.Mesh(child.geometry, pickingMaterial);
            pickingComponent.scale.set(Scale,Scale,Scale);
            scene.add(pickingComponent);
            // assembly.add(pickingComponent)
        } 
    });
    totalComponents = i;
    console.log(totalComponents);
    
    camera = new THREE.PerspectiveCamera(75, sizes.width/sizes.height, 0.1, 10000);
    camera.position.x = RADIUS;
    camera.position.y = RADIUS;
    camera.position.z = RADIUS;
    // box.setFromObject(assembly);
    // var boxDiagX = box.max.x - box.min.x;
    // var boxDiagY = box.max.y - box.min.y;
    // var boxDiagZ = box.max.z - box.min.z;
    // center.x = box.min.x + boxDiagX / 2;
    // center.y = box.min.y + boxDiagY / 2;
    // center.z = box.min.z + boxDiagZ / 2;
    console.log(center);
    camera.lookAt(center.x, center.y, center.z);

    scene.add(camera);

    document.getElementById("WebGL-output").appendChild(webGLRenderer.domElement);

    renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    model.traverse(function(child){
        if(child instanceof THREE.Mesh)
        {
            ModelSurfaceArea += getArea(child);
            child.scale.set(Scale,Scale,Scale);
            finalScene.add(child);
        }
    });
    controls = new OrbitControls( camera, webGLRenderer.domElement );
    controls.enablePan=true;
    controls.enableZoom=true;
    controls.enableRotate=false;
    controls.update();
    // finalScene.add(model);
}
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------LOADING FILE------------------------------------------------------------------
var vrmlloader = new VRMLLoader();
vrmlloader.load(wrlFileName, init);
//----------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------HELPERS--------------------------------------------------------------------------
function random_num(start, end)
{
    return start + Math.random()*(end-start);
}
function loadImage(url) {
    return new  Promise(resolve => {
        const image = new Image();
        image.addEventListener('load', () => {
            resolve(image);
        });
        image.src = url; 
    });
}
function create_genome()
{
    var xi, yi, zi;
    xi = random_num(-RANDOM_RANGE,RANDOM_RANGE);
    yi = random_num(-RANDOM_RANGE,RANDOM_RANGE);
    zi = random_num(-RANDOM_RANGE,RANDOM_RANGE);
    var div = Math.sqrt(Math.pow(xi,2)+Math.pow(yi,2)+Math.pow(zi,2));
    xi = (1.0*xi)/div;
    yi = (1.0*yi)/div;
    zi = (1.0*zi)/div;

    xi = xi*RADIUS;
    yi = yi*RADIUS;
    zi = zi*RADIUS;
    return [xi,yi,zi];
}
//----------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------FITNESS CALCULATION FUNCTION------------------------------------------
async function calculate_fitness(ind)
{
    // Set the camera to this position
    camera.position.x = ind.x;
    camera.position.y = ind.y;
    camera.position.z = ind.z;
    camera.lookAt(center.x, center.y, center.z);

    let componentCount = new Set();
    webGLRenderer.render(scene, camera);
    var imgData = webGLRenderer.domElement.toDataURL();
    

    return loadImage(imgData).then(img => {
        var ci = cv.imread(img);
        var src = cv.imread(img);
        let dst = cv.Mat.zeros(src.cols, src.rows, cv.CV_8UC3);
        cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
        cv.threshold(src, src, 120, 200, cv.THRESH_BINARY);
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        // You can try more different parameters
        cv.findContours(src, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        for (let i = 0; i < contours.size(); ++i) {
            let color = new cv.Scalar(0,0,255);
            cv.drawContours(dst, contours, i, color, 1, cv.LINE_8, hierarchy, 100);
        }

        var rows = ci.rows;
        var cols = ci.cols;
        var cpCount=0;
        var counter=0;
        for(var i = 0; i<rows; i+=1)
        {
            for(var j = 0; j<cols; j+=1)
            {
                let pixel = ci.ucharPtr(i, j);
                if(pixel[2] in colorToComponent)counter++;
                if(pixel[2] in colorToComponent && !componentCount.has(pixel[2]))
                {
                    componentCount.add(pixel[2]);
                }

                let cp = dst.ucharPtr(i,j);
                if(cp[2]==255)
                {
                    cpCount++;
                }
            }
        }
        var componentsVisibleValue = totalComponents/componentCount.size;
        counter = (ModelSurfaceArea*100)/counter;
        var fitnessValue = 0;
        fitnessValue = componentsVisibleValue + counter + 1/cpCount;
        // // only Components Visible
        // fitnessValue = componentsVisibleValue;
        // // Only projected area
        // fitnessValue = counter;
        // // ONly Silhouette count
        // fitnessValue = 1/cpCount;
        return fitnessValue;
    })
}
//-------------------------------------------------------------------------------------------------------------------
//--------------------------------------------GENETIC POPULATION GENERATION------------------------------------------
class Individual{

    constructor(x,y,z)
    {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    mate(ind1)
    {
        // I1: x1,y1,z1
        // I2: x2,y2,z2
        
        var prob = (1.0*random_num(0,100))/100;
        var xi,yi,zi;
        if(prob<0.9)
        {
            // choose p*ind1 + (1-p)*this
            xi = ind1.x*prob + (1-prob)*this.x;
            yi = ind1.y*prob + (1-prob)*this.y;
            zi = ind1.z*prob + (1-prob)*this.z;    
        }
        else
        {
            // random point on the sphere
            xi = random_num(-RANDOM_RANGE,RANDOM_RANGE);
            yi = random_num(-RANDOM_RANGE,RANDOM_RANGE);
            zi = random_num(-RANDOM_RANGE,RANDOM_RANGE);
        }
        var div = Math.sqrt(Math.pow(xi,2)+Math.pow(yi,2)+Math.pow(zi,2));
        xi = (1.0*xi)/div;
        yi = (1.0*yi)/div;
        zi = (1.0*zi)/div;

        xi = xi*RADIUS;
        yi = yi*RADIUS;
        zi = zi*RADIUS;
        return new Individual(xi,yi,zi);
    }
}

// Comparing based on the property
function compare_ind(a, b){
    // a should come before b in the sorted order
    if(a.fitness < b.fitness){
            return -1;
    // a should come after b in the sorted order
    }else if(a.fitness > b.fitness){
            return 1;
    // and and b are the same
    }else{
            return 0;
    }
}
//--------------------------------------------------------------------------------------------------------
//----------------------------------------------MAIN LOOP-------------------------------------------------
async function main()
{
    var generation = 0;

    var population = [];

    console.log("INITIAL POPULATION GENERATION BEGINS");
    for(var i=0; i<POPULATION_SIZE; i+=1)
    {
        var v = create_genome();
        // var v = [RADIUS, RADIUS, RADIUS];
        const ind = new Individual(v[0],v[1],v[2]);
        await calculate_fitness(ind).then(fit=>{
            ind.fitness = fit;
            population.push(ind);
        });
    }
    console.log("INITIAL POPULATION GENERATION COMPLETED");
    var flag = false;
    while(!flag)
    {
        generation += 1;
        population.sort(compare_ind);

        if(population[0].fitness == previous_fitness)
        {
            prev_fit_count+=1;
        }
        else
        {
            previous_fitness=population[0].fitness;
            prev_fit_count = 0;
        }
        if(prev_fit_count>MIN_SAME_COUNT)
        {
            flag = true;
            break;
        }


        var new_generation = [];

        // retain 10% of the fittest
        var s = POPULATION_SIZE/10;
        for(var i=0; i<s; i+=1)
        {
            new_generation.push(population[i]);
        }
        s = POPULATION_SIZE-s;
        for(var i=0; i<s; i+=1)
        {
            var i1 = Math.floor(random_num(0,POPULATION_SIZE/2));
            var i2 = Math.floor(random_num(0,POPULATION_SIZE/2));
            var new_ind = population[i1].mate(population[i2]);
            await calculate_fitness(new_ind).then(f=>{
                new_ind.fitness = f;
                new_generation.push(new_ind);
            })
        }
        population = new_generation;
        console.log(`Gen: ${generation} Fitness: ${population[0].fitness}`);
    }

    console.log("Answer: ", population[0]);
    camera.position.x = population[0].x;
    camera.position.y = population[0].y;
    camera.position.z = population[0].z;
    camera.lookAt(center.x, center.y, center.z);
    bestFit = true;
    
    finalScene.add(camera);
    var spotLight1 = new THREE.SpotLight(0xffffff);
    spotLight1.position.set(1000, 1000, 1000);
    finalScene.add(spotLight1);

    var spotLight2 = new THREE.SpotLight(0xffffff);
    spotLight2.position.set(-1000, 1000, -1000);
    finalScene.add(spotLight2);

    var spotLight3 = new THREE.SpotLight(0xffffff);
    spotLight3.position.set(-1000, -1000, -1000);
    finalScene.add(spotLight3);
    var dir1 = new THREE.DirectionalLight(0.4);
    dir1.position.set(-1000, 1000, -1000);
    finalScene.add(dir1);

    var dir2 = new THREE.DirectionalLight(0.4);
    dir2.position.set(-1000, 1000, 1000);
    finalScene.add(dir2);

    var dir3 = new THREE.DirectionalLight(0.4);
    dir3.position.set(1000, 1000, -1000);
    finalScene.add(dir3);

    window.requestAnimationFrame(animate);
}
//---------------------------------------------------------------------------------------------
//---------------------------------ANIMATION LOOP----------------------------------------------
const animate = ()=>{
    if(toRender)
    {
        controls.update();
        if(!bestFit)main();
        else
        {
            if(stopAnimation)window.cancelAnimationFrame(animate);
            else
            {
                webGLRenderer.render(finalScene, camera);
                window.requestAnimationFrame(animate);
            }
        }
    }
    else
    {
        window.requestAnimationFrame(animate);
    }
}
//----------------------------------------*****TESTING*****----------------------------------------
//----------------------------------------EVENT LISTENERS--------------------------------------------
var pos=0;
function setPickPosition(event)
{
    pos = {
        x: event.clientX,
        y: event.clientY,
    }
    if(typeof pos.x!=undefined)
    {
        mouseX.nodeValue = pos.x;
        mouseY.nodeValue = pos.y;
        id.nodeValue = objectID;
    }
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    webGLRenderer.setSize(window.innerWidth, window.innerHeight);
}

// window.addEventListener('mousemove', setPickPosition);
window.addEventListener("resize", onWindowResize, false);
document.addEventListener('keydown', (ev)=>{
    if(ev.key == 'Escape')
    {
        stopAnimation = true;
    }
});

//-----------------------------------------------------------------------------------------------
var initDone=false;
function debugInit()
{
    var spotLight1 = new THREE.SpotLight(0xffffff);
    spotLight1.position.set(1000, 1000, 1000);
    finalScene.add(spotLight1);

    var spotLight2 = new THREE.SpotLight(0xffffff);
    spotLight2.position.set(-1000, 1000, -1000);
    finalScene.add(spotLight2);

    var spotLight3 = new THREE.SpotLight(0xffffff);
    spotLight3.position.set(-1000, -1000, -1000);
    finalScene.add(spotLight3);
    var dir1 = new THREE.DirectionalLight(0.4);
    dir1.position.set(-1000, 1000, -1000);
    finalScene.add(dir1);

    var dir2 = new THREE.DirectionalLight(0.4);
    dir2.position.set(-1000, 1000, 1000);
    finalScene.add(dir2);

    var dir3 = new THREE.DirectionalLight(0.4);
    dir3.position.set(1000, 1000, -1000);
    finalScene.add(dir3);
    camera.lookAt(center.x, center.y, center.z);

    initDone=true;
    console.log("done");
}
const run=()=>{    
    if(toRender)
    {
        if(!initDone)debugInit();
        webGLRenderer.render(finalScene, camera);
        controls.update();
    }
    window.requestAnimationFrame(run);
}
// run();

if(debug)run();
else animate();
