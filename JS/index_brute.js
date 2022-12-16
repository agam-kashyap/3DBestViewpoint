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


//---------------------MAIN VARIABLES--------------------------
const COUNT_LON=13;
const COUNT_LAT=14;
const RADIUS = 500;
var ModelSurfaceArea=0;
const colorToComponent = {};
var totalComponents = 0;
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
function generate_all_pos(radius, count_lat, count_lon)
{
    var theta = 0;
    var phi = 0;
    pos = [];
    for(var i=0; i<count_lat; i+=1)
    {
        theta += Math.PI/count_lat;
        phi=0;
        for(var j=0; j<count_lon; j+=1)
        {
            phi += 2*Math.PI/count_lon;

            var x = radius*Math.sin(theta)*Math.cos(phi);
            var y = radius*Math.sin(theta)*Math.sin(phi);
            var z = radius*Math.cos(phi);
            pos.push([x,y,z]);
        }   
    }
    return pos;
}
//----------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------FITNESS CALCULATION FUNCTION------------------------------------------
async function calculate_fitness(ind)
{
    // Set the camera to this position
    camera.position.x = ind[0];
    camera.position.y = ind[1];
    camera.position.z = ind[2];
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
        return fitnessValue;
    })
}

//--------------------------------------------------------------------------------------------------------
//----------------------------------------------MAIN LOOP-------------------------------------------------
async function main()
{
    var pos = generate_all_pos(RADIUS, COUNT_LAT,COUNT_LON);
    var res = []
    for(var i=0; i<pos.length; i+=1)
    {
        console.log(i);
        await calculate_fitness(pos[i]).then(fit=>{
            res.push([fit, pos[i][0], pos[i][1], pos[i][2]]);
        });
    }
    res.sort();

    console.log("Answer: ", res[0][0]);
    camera.position.x = res[0][1];
    camera.position.y = res[0][2];
    camera.position.z = res[0][3];
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
        // if(0)main();
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
// animate();
//----------------------------------------------------------------------------------------------
//--------------------------------------------OVERLAYS------------------------------------------

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
