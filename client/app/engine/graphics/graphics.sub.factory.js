/**
 *
 */

'use strict';

App.Engine.Graphics.prototype.createRenderer = function() {
    // Configure renderer
    var renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    renderer.setClearColor(0x435D74, 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    return renderer;
};

App.Engine.Graphics.prototype.createScene = function() {
    return new THREE.Scene();
};

App.Engine.Graphics.prototype.createCamera = function() {
    var camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.0001, 100000);
    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    return camera;
};

App.Engine.Graphics.prototype.createRaycaster = function() {
    return new THREE.Raycaster();
};

App.Engine.Graphics.prototype.createMaterial = function(whatMaterial, meta) {
    var material;

    switch (whatMaterial) {
        case 'flat-phong':
            material = new THREE.MeshPhongMaterial({
                specular: 0xffffff,
                shading: THREE.FlatShading,
                vertexColors: THREE.VertexColors
            });
            break;

        case 'textured-phong':
            material = new THREE.MeshLambertMaterial({
                //color: 0xffffff, specular: 0xffffff, shininess: 250,
                //shading: THREE.FlatShading,
                side: THREE.BackSide,
                //vertexColors: THREE.VertexColors,
                map: this.texture
            });
            break;

        case 'basic-black':
            material = new THREE.MeshBasicMaterial({
                wireframe:true,
                color:0x000000
            });
            break;

        default: // Block material
            material = new THREE.MeshBasicMaterial({
                color:0xff0000
            });
    }

    return material;
};

App.Engine.Graphics.prototype.createGeometry = function(whatGeometry) {
    var geometry;

    switch (whatGeometry) {
        case 'plane':
            geometry = new THREE.PlaneGeometry(32, 32, 32, 32);
            break;

        case 'box':
            geometry = new THREE.BoxGeometry(0.5, 0.5, 1);
            break;

        default:
            geometry = new THREE.BoxGeometry(0.5, 0.5, 1);
    }

    return geometry;
};

App.Engine.Graphics.prototype.createMesh = function(geometry, material) {
    return new THREE.Mesh(geometry, material);
};

App.Engine.Graphics.prototype.createLight = function(whatLight) {
    var light;

    switch (whatLight) {
        case 'hemisphere':
            light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
            break;

        default:
            light = new THREE.AmbientLight(0x404040);
    }

    return light;
};
