import * as THREE from 'three';
import { VRMLLoader } from 'three/addons/loaders/VRMLLoader.js'



var webGLRenderer, camera, scene, renderTarget;
var toRender = false;

const pickingScene = new THREE.Scene();
pickingScene.background = new THREE.Color(1000);
var pickingModel, pickHelper;
const idToObject = {};

var VRMLmodel;
var ModelSurfaceArea=0;
const calculateDistance = (p1, p2)=>{
    var x = Math.pow((p1.x - p2.x),2);
    var y = Math.pow((p1.y - p2.y),2);
    var z = Math.pow((p1.z - p2.z),2);
    var dist = Math.sqrt(x+y+z);
    return dist;
}
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

function init(model)
{
    toRender = true;
    const sizes = {
        width: window.innerWidth,
        height: window.innerHeight
    }
    
    pickHelper = new GPUPickHelper();
    webGLRenderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    webGLRenderer.setClearColor(new THREE.Color("rgb(255,255,255)"));
    webGLRenderer.setSize(sizes.width, sizes.height);
    scene = new THREE.Scene();

    model.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
            const material = new THREE.MeshBasicMaterial({color: 0xff0000});
            const mesh = new THREE.Mesh(child.geometry, material);
            mesh.scale.set(10,10,10);
            mesh.position.set(0,0,0);
            scene.add(mesh);
            console.log(child.geometry);
        }
    });
    VRMLmodel = model;
    // VRMLmodel.scale.set(10, 10, 10);

    // scene.add(VRMLmodel);
    pickingModel = VRMLmodel.clone(true);

    var i = 0;
    pickingModel.traverse(function(child){
        if(child instanceof THREE.Mesh){
            i = i + 1;
            idToObject[i] = child;

            const pickingMaterial = new THREE.MeshPhongMaterial({
                emissive: new THREE.Color(i),
                color: new THREE.Color(0, 0, 0),
                specular: new THREE.Color(0, 0, 0),
                transparent: true,
                side: THREE.DoubleSide,
                alphaTest: 0.5,
                blending: THREE.NoBlending,
              });

            const pickingComponent = new THREE.Mesh(child.geometry, pickingMaterial);
            pickingComponent.scale.set(10,10,10);
            pickingScene.add(pickingComponent);
            console.log(child.geometry.attributes.position.array);
        } 
    });

    
    camera = new THREE.PerspectiveCamera(75, sizes.width/sizes.height, 0.1, 10000);
    camera.position.x = 300;
    camera.position.y = 300;
    camera.position.z = 300;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    scene.add(camera);
    // pickingScene.add(camera);

    var dir1 = new THREE.DirectionalLight(0.4);
    dir1.position.set(-1000, 1000, -1000);
    scene.add(dir1);

    var dir2 = new THREE.DirectionalLight(0.4);
    dir2.position.set(-1000, 1000, 1000);
    scene.add(dir2);

    var dir3 = new THREE.DirectionalLight(0.4);
    dir3.position.set(1000, 1000, -1000);
    scene.add(dir3);

    document.getElementById("WebGL-output").appendChild(webGLRenderer.domElement);

    renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    VRMLmodel.traverse(function(child){
        if(child instanceof THREE.Mesh)
        {
            ModelSurfaceArea += getArea(child);
            // getMVPval(child);
        }
    });
}

var vrmlloader = new VRMLLoader();
vrmlloader.load("./model/small.wrl", init);

var stopAnimation = false;
document.addEventListener('keydown', (ev)=>{
    if(ev.key == 'Escape')
    {
        stopAnimation = true;
    }
});
//------------------------------------------------------------------------------------------------------------
class GPUPickHelper {
    constructor(){
        this.pickingTexture = new THREE.WebGLRenderTarget(1,1);
        this.pixelBuffer = new Uint8Array(4);

        //Dunno about this
        this.pickedObject = null;
        this.pickedObjectSavedColor = 0;
    }
    pick(position, funcScene, funcCamera){
        var xm = position.x;
        var ym = position.y;
        // var xm = (1-position.x)*window.innerWidth/2;
        // var ym = (1-position.y)*window.innerHeight/2;
        // Currently position is from -1 to -1, i.e. in ClipSpace
        const {pickingTexture, pixelBuffer} = this;

        if (this.pickedObject) {
            this.pickedObject = undefined;
        }

        // set the view offset to represent just a single pixel under the mouse
        const pixelRatio = webGLRenderer.getPixelRatio();
        funcCamera.setViewOffset(
            window.innerWidth,   // full width
            window.innerHeight,  // full top
            xm* pixelRatio | 0,           // rect x
            ym * pixelRatio | 0,           // rect y
            1,                                     // rect width
            1,                                     // rect height
        );
        // render the funcScene
        webGLRenderer.setRenderTarget(pickingTexture)
        webGLRenderer.render(funcScene, funcCamera);
        webGLRenderer.setRenderTarget(null);
    
        // clear the view offset so rendering returns to normal
        camera.clearViewOffset();
        //read the pixel
        webGLRenderer.readRenderTargetPixels(
            pickingTexture,
            0,   // x
            0,   // y
            1,   // width
            1,   // height
            pixelBuffer);
    
        const id =
            (pixelBuffer[0] << 16) |
            (pixelBuffer[1] <<  8) |
            (pixelBuffer[2]      );

        return id;
    }
}
//-----------------------------------------------------------------------------------------
const POPULATION_SIZE = 10; 
const RADIUS = 500;
const MIN_SAME_COUNT = 1;
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
async function calculate_fitness(ind)
{
    console.log("Calculating Fitness")
    // Set the camera to this position
    camera.position.x = ind.x;
    camera.position.y = ind.y;
    camera.position.z = ind.z;
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // //------------------------------VISIBLE COMPONENTS MEASURE-----------------------------------
    // // Component COunter
    // var components = new Set();
    
    
    // var totalComponents = 0;
    // var ith=0;
    // pickingModel.traverse(function(child){
    //     if(child instanceof THREE.Mesh)
    //     {
    //         ith=ith+1;
    //         console.log("CHILD: ",ith);

    //         totalComponents+=1;
    //         var positions = child.geometry.attributes.position;
    //         var posSize = positions.count;
    //         for(var i=0; i<posSize; i+=3)
    //         {
    //             var v1 = new THREE.Vector4(positions.array[i],positions.array[i+1],positions.array[i+2], 1);
    //             console.log(v1);
    //             const M = new THREE.Matrix4();
    //             M.set(
    //                 10, 0, 0, 0,
    //                 0, 10, 0, 0,
    //                 0, 0, 10, 0,
    //                 0, 0, 0, 1
    //             )
    //             // const M = child.matrixWorld;
    //             v1.applyMatrix4(M);
    //             console.log(v1);

    //             const V = camera.matrixWorldInverse;
    //             v1.applyMatrix4(V);
    //             console.log(V,v1);

    //             const P = camera.projectionMatrix;
    //             v1.applyMatrix4(P);     //Clip Space
    //             console.log(P,v1);
    //             v1.divideScalar(v1.w);  //NDC
    //             console.log(v1);

    //             const W = new THREE.Matrix4();
    //             const {x: WW, y: WH} = webGLRenderer.getSize(new THREE.Vector2());
    //             // console.log(WW,WH);
    //             W.set(
    //                 WW/2, 0    ,  0  ,   WW/2,
    //                 0,    -WH/2,  0  ,   WH/2,
    //                 0,    0    ,  0.5,   0.5,
    //                 0,    0    ,  0  ,   1 
    //             );
    //             v1.applyMatrix4(W);
    //             console.log(v1);
    //             var point = {
    //                 'x': Math.round(v1.x),
    //                 'y': Math.round(v1.y)
    //             }
    //             var objectID = pickHelper.pick(point, pickingScene, camera);
    //             console.log(point, objectID);
    //             if(idToObject[objectID]==child)
    //             {
    //                 console.log(objectID);
    //                 components.add(objectID);
    //             }
    //             break;
    //         }
    //     }
    // });
    // console.log(components);
    // var componentsVisibleValue = totalComponents/components.size; //REverse ratio since we need to minimize total measure


    //----------------------------VISIBLE AREA MEASURE------------------------------------------------
    let counter = 0;

    webGLRenderer.render(scene, camera);
    var imgData = webGLRenderer.domElement.toDataURL();

    return loadImage(imgData).then(img => {
        var ci = cv.imread(img);        
        for (var x of ci.data) {
        if (x == 0) {
                counter++;
            }
        }
        counter = counter/(ModelSurfaceArea*100);

        var fitnessValue = 0;
        fitnessValue = counter;
        // fitnessValue +=  (componentsVisibleValue*10+counter);
        return fitnessValue;     
    });
}
function create_genome()
{
    var xi, yi, zi;
    xi = random_num(-100,100);
    yi = random_num(-100,100);
    zi = random_num(-100,100);
    var div = Math.sqrt(Math.pow(xi,2)+Math.pow(yi,2)+Math.pow(zi,2));
    xi = (1.0*xi)/div;
    yi = (1.0*yi)/div;
    zi = (1.0*zi)/div;

    xi = xi*RADIUS;
    yi = yi*RADIUS;
    zi = zi*RADIUS;
    return [xi,yi,zi];
}
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
            xi = random_num(-100,100);
            yi = random_num(-100,100);
            zi = random_num(-100,100);
        }
        var div = Math.sqrt(Math.pow(xi,2),Math.pow(yi,2),Math.pow(zi,2));
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
    if(a.fitness > b.fitness){
            return -1;
    // a should come after b in the sorted order
    }else if(a.fitness < b.fitness){
            return 1;
    // and and b are the same
    }else{
            return 0;
    }
}

var previous_fitness = 0;
var prev_fit_count = 0;

var bestFit = false;
async function main()
{
    console.log(window.innerHeight, window.innerWidth);
    var generation = 0;

    var population = [];

    for(var i=0; i<POPULATION_SIZE; i+=1)
    {
        var v = create_genome();
        const ind = new Individual(v[0],v[1],v[2]);
        await calculate_fitness(ind).then(fit=>{
            ind.fitness = fit;
            population.push(ind);
        });
    }
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
    camera.lookAt(0,0,0);
    bestFit = true;
    
    var spotLight1 = new THREE.SpotLight(0xffffff);
    spotLight1.position.set(1000, 1000, 1000);
    scene.add(spotLight1);

    var spotLight2 = new THREE.SpotLight(0xffffff);
    spotLight2.position.set(-1000, 1000, -1000);
    scene.add(spotLight2);

    var spotLight3 = new THREE.SpotLight(0xffffff);
    spotLight3.position.set(-1000, -1000, -1000);
    scene.add(spotLight3);
    window.requestAnimationFrame(animate);
}

//------------------OVERLAYS------------------------------------------

// Mouse Coordinates in Canvas system
var mouseXElement = document.querySelector('#mousex');
var mouseX = document.createTextNode("");
mouseXElement.appendChild(mouseX);

var mouseYElement = document.querySelector('#mousey');
var mouseY = document.createTextNode("");
mouseYElement.appendChild(mouseY);

var idElement = document.querySelector('#objectID');
var id = document.createTextNode("");
idElement.appendChild(id);
//----------------------TESTING----------------------------------------
var pos=0;
function setPickPosition(event)
{
    pos = {
        x: event.clientX,
        y: event.clientY,
    }
    var objectID = pickHelper.pick(pos, pickingScene, camera);
    if(typeof pos.x!=undefined)
    {
        mouseX.nodeValue = pos.x;
        mouseY.nodeValue = pos.y;
        id.nodeValue = objectID;
    }
}
window.addEventListener('mousemove', setPickPosition);


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    webGLRenderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onWindowResize, false);

const run=()=>{
    if(toRender)
    {
        // webGLRenderer.render(pickingScene, camera);
        webGLRenderer.render(scene, camera);
    }
    window.requestAnimationFrame(run);
}
// run();

//----------------------------------------------------------------------
const animate = ()=>{
    if(toRender)
    {
        // if(0)main();
        if(!bestFit)main();
        else
        {
            if(stopAnimation)window.cancelAnimationFrame(animate);
            else
            {
                webGLRenderer.render(scene, camera);
                window.requestAnimationFrame(animate);
            }
        }
    }
    else
    {
        window.requestAnimationFrame(animate);
    }
}
animate();

