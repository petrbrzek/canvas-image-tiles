/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Mikael Lepistö
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH
 * THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * Main app.
 *
 * Handles UI events and uses CanvasShredder to handle and adjust image orientation.
 */

/// Expose app context to make debugging easier (currently not used...)
var appContext = (function () {
  // put stuff here if you like to expose something outside
  var app = {};

  var shredder = null;
  var needsUpdate = false;
  var slicePosition = { x: 0, y: 0, size: 128};

  // select image
  var fileInput = document.getElementById('file-input');
  // loaded image dimensions
  var imageInfo = document.getElementById('image-info');
  // dst canvas draws per second
  var fpsCounter = document.getElementById('fps');
  // canvas element where result is written
  var dstCanvas = document.getElementById('dst-canvas');
  // area where preview canvas is positioned
  var previewArea = document.getElementById('preview-area');

  /**
   * Read source image.
   */
  function handleFileSelect(evt) {
    var files = evt.target.files;
    for (var i = 0, f; f = files[i]; i++) {
      if (shredder) {
        shredder.destroy();
      }
      shredder = null;
      console.log(f);
      var reader = new FileReader();
      reader.onloadend = function (evt) {
        if (evt.target.readyState == FileReader.DONE) {
          // load data to image element, to be able to create preview and
          // original image canvases
          var newImage = document.createElement('img');
          newImage.onload = function() {
            shredder = new CanvasShredder(newImage, previewArea);
            selectPosition(previewArea.offsetWidth/2, previewArea.offsetHeight/2);
            imageInfo.textContent =
              shredder.srcCanvas.width + "x" +
              shredder.srcCanvas.height;
          };
          newImage.src = evt.target.result;
        }
      };
      reader.readAsDataURL(f);
    }
  }
  fileInput.addEventListener('change', handleFileSelect, false);

  /**
   * Sample tile from source image on every animationFrame.
   */
  var frameCount = 0;
  requestAnimationFrame(function updateOutputIfNeeded() {
    if (needsUpdate && shredder) {
      shredder.slice(slicePosition.x, slicePosition.y, slicePosition.size, dstCanvas);
      needsUpdate = false;
      frameCount++;
    }
    requestAnimationFrame(updateOutputIfNeeded);
  });

  /**
   * Update fps counter every 2 secs if image data is ready.
   */
  var previousFrameCount = 0;
  var previousMilliseconds = new Date().getTime();
  function updateFps() {
    var currentMs = new Date().getTime();
    var framesPassed = frameCount - previousFrameCount;
    var millisecondsPassed = currentMs - previousMilliseconds;
    var fps = framesPassed/(millisecondsPassed/1000);
    fpsCounter.textContent = fps;
    previousFrameCount = frameCount;
    previousMilliseconds = currentMs;
  }
  setInterval(updateFps, 2000);

  /**
   * Select bounding box where tile should tile should be read from.
   */
  var selectPos = document.getElementById('select-position');
  function selectPosition(x, y) {
    slicePosition.x = x;
    slicePosition.y = y;
    selectPos.style.left = slicePosition.x + "px";
    selectPos.style.top = slicePosition.y + "px";
    selectPos.style.width = slicePosition.size + "px";
    selectPos.style.height = slicePosition.size + "px";
    needsUpdate = true;
  }
  function onPreviewAreaClick(event) {
    var posX = (event.pageX-previewArea.offsetLeft) - slicePosition.size/2;
    var posY = (event.pageY-previewArea.offsetTop) - slicePosition.size/2;
    selectPosition(posX, posY);
    console.log("Selected grid position", event, posX, posY);
  }
  previewArea.addEventListener('mousedown', onPreviewAreaClick, false);

  /**
   * Adjust image orientation.
   */
  var rotationButton = document.querySelector('.ctrl-btn.rotate');
  var moveButton = document.querySelector('.ctrl-btn.move');
  var scaleButton = document.querySelector('.ctrl-btn.scale');

  var moveEl = null;
  var lastPos = null;
  function getPos(event) {
    return { x: event.screenX, y: event.screenY };
  }

  rotationButton.addEventListener('mousedown', startMouseMove, false);
  moveButton.addEventListener('mousedown', startMouseMove, false);
  scaleButton.addEventListener('mousedown', startMouseMove, false);

  function startMouseMove(event) {
    event.stopPropagation();
    event.preventDefault();
    moveEl = event.target;
    lastPos = getPos(event);
  }

  // stop mouse move if leaving window
  document.body.addEventListener('mouseout', function (event) {
    event.preventDefault();
    if(event.relatedTarget === document.querySelector('html')) {
      moveEl = null;
    }
  }, false);

  // stop mouse move if stopped pressing mouse button
  document.body.addEventListener('mouseup', function (event) {
    event.preventDefault();
    moveEl = null;
  }, false);

  /**
   * Convert mousedown and mousemove events to relative mouse events
   */
  function mouseMove(event) {
    // console.log("Button", event.button, "Which", event.which, "Buttons", event.buttons);
    if (event.buttons === 0) {
      moveEl = null;
    }
    if (moveEl !== null) {
      var currPos = getPos(event);
      var dx = currPos.x - lastPos.x;
      var dy = currPos.y - lastPos.y;
      var speed = Math.sqrt(dx*dx + dy*dy);
      speed = (dy > 0) ? speed : -speed;
      moveEl.dispatchEvent(new CustomEvent('relativemouse', { detail: {
        dx: dx,
        dy: dy,
        speed: speed
      }}));
      lastPos = currPos;
    }
  }
  document.body.addEventListener('mousemove', mouseMove, false);

  /**
   * Adjust image orientation
   */
  rotationButton.addEventListener('relativemouse', function (event) {
    if (shredder) {
      shredder.updateOrientation({ deltaRotation: event.detail.speed/100 });
      needsUpdate = true;
    }
  }, false);
  moveButton.addEventListener('relativemouse', function (event) {
    if (shredder) {
      shredder.updateOrientation({
        deltaPosition: {x: event.detail.dx, y: event.detail.dy}
      });
      needsUpdate = true;
    }
  }, false);
  scaleButton.addEventListener('relativemouse', function (event) {
    if (shredder) {
      shredder.updateOrientation({deltaScale: event.detail.speed / 100});
      needsUpdate = true;
    }
  }, false);

  var mc = new Hammer(previewArea);
  var startPosition = { x: 0, y: 0 };
  mc.on("panstart", function (ev) {
    startPosition.x = shredder.position.x;
    startPosition.y = shredder.position.y;
  });

  mc.on("panmove", function(ev) {
    ev.preventDefault();
    if (shredder) {
      shredder.updateOrientation({
        absPosition: {x: startPosition.x + ev.deltaX, y: startPosition.y + ev.deltaY}
      });
      needsUpdate = true;
    }
  });

  /**
   * Touchscreen events
   mc.on("rotatestart rotatemove", onRotate);
   mc.on("pinchstart pinchmove", onPinch);
   */

  return app;
})();