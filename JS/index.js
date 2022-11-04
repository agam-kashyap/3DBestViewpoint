import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLLoader } from 'three/addons/loaders/VRMLLoader.js'

// const Flatten = globalThis["@flatten-js/core"];
// const {point, Polygon} = Flatten;
// const {unify, intersect} = window["boolean-op"];

// let polygon1 = new Polygon();
// polygon1.addFace([point(200,10), point(100, 300), point(400, 150), point(250, 10)]);

// let polygon2 = new Polygon();
// polygon2.addFace([point(450, 10), point(0, 150), point(300,300), point(600, 300)]);

// let polygon_res = intersect(polygon1, polygon2);
// console.log(polygon_res);

// console.log(PolyBool.union({
//     regions: [
//       [[50,50], [150,150], [190,50]],
//       [[130,50], [290,150], [290,50]]
//     ],
//     inverted: false
//   }, {
//     regions: [
//       [[110,20], [110,110], [20,20]],
//       [[130,170], [130,20], [260,20], [260,170]]
//     ],
//     inverted: false
//   }));



var webGLRenderer, camera, scene, renderTarget;
var toRender = false;

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
// const getMVPval = (mesh)=>{
//     var v = new THREE.Vector3;
//     var posAttr = mesh.geometry.attributes.position;
//     var size = posAttr.count;


//     var MVmatrix = new THREE.Matrix4();
//     MVmatrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
//     var MVPmatrix = new THREE.Matrix4();
//     MVPmatrix.multiplyMatrices(camera.projectionMatrix, MVmatrix);
    
//     console.log(MVPmatrix);

//     var Triangles = []
//     for(var i=0; i<size; i+=9)
//     {
//         // i,   i+1, i+2 -> V1
//         // i+3, i+4, i+5 -> V2
//         // i+6, i+7, i+8 -> V3
//         var v1 = new THREE.Vector3(posAttr.array[i],posAttr.array[i+1],posAttr.array[i+2]);
//         var v2 = new THREE.Vector3(posAttr.array[i+3],posAttr.array[i+4],posAttr.array[i+5]);
//         var v3 = new THREE.Vector3(posAttr.array[i+6],posAttr.array[i+7],posAttr.array[i+8]);
    
//         v1.applyMatrix4(MVPmatrix);
//         v2.applyMatrix4(MVPmatrix);
//         v3.applyMatrix4(MVPmatrix);
        
//         Triangles.push({
//             regions: [
//                 [v1.x, v1.y],[v2.x, v2.y],[v3.x, v3.y]
//             ],
//             inverted: false
//         });
//     }
//     console.log(Triangles);


//     var segments = PolyBool.segments(Triangles[0]);
//     for (var i = 1; i < Triangles.length; i++){
//         var seg2 = PolyBool.segments(Triangles[i]);
//         var comb = PolyBool.combine(segments, seg2);
//         segments = PolyBool.selectUnion(comb);
//         console.log(segments);
//     }
//     var finPoly = PolyBool.polygon(segments);
//     console.log(finPoly);

// }

function init(model)
{
    toRender = true;
    //-----------------------------------------
    const sizes = {
        width: window.innerWidth,
        height: window.innerHeight
    }
    
    webGLRenderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    webGLRenderer.setClearColor(new THREE.Color("rgb(255,255,255)"));
    webGLRenderer.setSize(sizes.width, sizes.height);
    scene = new THREE.Scene();

    //-----------------------------------------
    // OBJcube = obj;
    // console.log(OBJcube);
    // scene.add(OBJcube);
    //-----------------------------------------
    // const geometry = new THREE.BoxGeometry(1,1,1);
    // const customShaderMaterial = new THREE.ShaderMaterial({
    //     vertexShader: vertexShader,
    //     fragmentShader: fragmentshader
    // });

    // const material = new THREE.MeshBasicMaterial({
    //     color: 'blue'
    // });
    // cubeMesh = new THREE.Mesh(geometry, customShaderMaterial);
    // scene.add(cubeMesh);
    //-----------------------------------------
    model.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
            console.log(child.geometry);
        }
    });
    VRMLmodel = model;
    VRMLmodel.scale.set(10, 10, 10);

    scene.add(VRMLmodel);
    //-------------------------------------------
    
    camera = new THREE.PerspectiveCamera(75, sizes.width/sizes.height, 0.1, 10000);
    camera.position.x = 300;
    camera.position.y = 300;
    camera.position.z = 300;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    scene.add(camera);

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
//----------------------------------------------
// const loader = new OBJLoader();
// loader.load( 'model/cube.obj', init);
//----------------------------------------------

//-------------------------------------------------
var vrmlloader = new VRMLLoader();
vrmlloader.load("./model/small.wrl", init);
//-------------------------------------------------
// getMVPval(cubeMesh);

var stopAnimation = false;
document.addEventListener('keydown', (ev)=>{
    if(ev.key == 'Escape')
    {
        stopAnimation = true;
    }
});

// function readPixels(){
//     webGLRenderer.setRenderTarget(renderTarget);
//     webGLRenderer.render(scene, camera);

//     const pixelBuffer = new THREE.Uint8BufferAttribute(4);
//     webGLRenderer.readRenderTargetPixels(renderTarget, 1, 1, webGLRenderer.domElement.width, webGLRenderer.domElement.height, pixelBuffer);
//     // for(var i=0; i<window.innerHeight; i+=1)
//     // {
//     //     for(var j=0; j<window.innerWidth; i+=1)
//     //     {
//     //         const pixelBuffer = new THREE.Uint8BufferAttribute(4);
//     //         webGLRenderer.readRenderTargetPixels(renderTarget, j, i, webGLRenderer.domElement.width, webGLRenderer.domElement.height, pixelBuffer);
//     //         console.log(pixelBuffer);
//     //     }
//     // }
//     console.log(pixelBuffer);
//     console.log("---------------------------");    
// }




//------------------------------------------------------------------------------------------------------------
const POPULATION_SIZE = 150; 
const RADIUS = 500;
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
async function create_genome()
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

    // Set the camera to this position
    camera.position.x = xi;
    camera.position.y = yi;
    camera.position.z = zi;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    // call the draw and calculating the fitness value function

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
        counter = counter/ModelSurfaceArea;
        return [xi, yi, zi, counter];     
    });
}
class Individual{

    constructor(x,y,z,f)
    {
        this.x = x;
        this.y = y;
        this.z = z;
        this.fitness = f;
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
    var generation = 0;

    var population = [];

    for(var i=0; i<POPULATION_SIZE; i+=1)
    {
        await create_genome().then(v => {population.push(new Individual(v[0],v[1],v[2],v[3]));})
    }
    console.log(population);
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
        if(prev_fit_count>1000)
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
            new_generation.push(population[i1].mate(population[i2]));
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
// main();

const animate = ()=>{
    if(toRender)
    {
        // webGLRenderer.render(scene, camera);
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



//------------TO-DO--------------------------
/*
- Change the fitness function 
- calculate surface area of the model
- figure out how the fourth variable i.e. Distance from center of model should be incorporated in the optimisation algorithm
- only the vertices, check the primitives, if they are visible by position
*/