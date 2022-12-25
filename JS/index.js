let scriptEle = document.createElement("script");
scriptEle.setAttribute("type", "module");
document.getElementById("Algorithm").onchange = function(){
    if(this.value == "ga")
    {
        scriptEle.setAttribute("src", "./JS/genetic_alg.js");
    }
    else 
    {
        scriptEle.setAttribute("src", "./JS/brute_pos.js");
    }

    document.body.appendChild(scriptEle);
}