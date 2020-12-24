const { desktopCapturer, remote } = require('electron');
const { dialog, Menu } = remote;

const { writeFile } = require('fs');

// const { dialog, Menu } = remote;

// Global state
let mediaRecorder; // MediaRecorder instance to capture footage
const recordedChunks = [];

// Buttons
const videoElement = document.querySelector('video');
const canvasElement = document.querySelector('canvas');
const ctx = canvasElement.getContext('2d');
let isDrawing = false;

function setIsDrawing(val) {
  isDrawing = val;
}

canvasElement.addEventListener("mousedown", startDrawing);
canvasElement.addEventListener("mousemove", draw);
canvasElement.addEventListener("mouseup", finishDrawing);

function startDrawing(event) {
  console.log(event);
  const {offsetX, offsetY} = event;
  console.log(`${offsetX},${offsetY}`);
  ctx.beginPath();
  ctx.moveTo(offsetX, offsetY);
  setIsDrawing(true);
}

function finishDrawing(event) {
  ctx.closePath();
  setIsDrawing(false);
}

function draw(event) {
  if(!isDrawing) {
    return;
  }
  ctx.lineWidth = 20;
  let {offsetX, offsetY} = event;
  ctx.lineTo(offsetX, offsetY);
  ctx.stroke();
}

const startBtn = document.getElementById('startBtn');
startBtn.onclick = e => {
  mediaRecorder.start();
  startBtn.classList.add('is-danger');
  startBtn.innerText = 'Recording';
};

const stopBtn = document.getElementById('stopBtn');
stopBtn.onclick = e => {
  mediaRecorder.stop();
  startBtn.classList.remove('is-danger');
  startBtn.innerText = 'Start';
};

const refBtn = document.getElementById('refBtn');
refBtn.onclick = e => {
  getVideoSources();
}



const videoSelectBtn = document.getElementById('videoSelectBtn');
// videoSelectBtn.onclick = getVideoSources;

// Get the available video sources
async function getVideoSources() {
  const inputSources = await desktopCapturer.getSources({
    types: ['window', 'screen'], thumbnailSize: {height: 1920, width: 1080}
  });
  console.log(inputSources);

  // Clean children list
  document.getElementById('preview').innerHTML = "";
  inputSources.map(source => {
    const imageBufferData = source.thumbnail.toDataURL();
    const div = document.createElement('div');
    const img = document.createElement('img');
    img.className = "preview";
    img.src = imageBufferData;
    img.addEventListener("click", selectVideoPreview(source));

    const p = document.createElement('p');
    let sourceName = source.name;
    if(source.name.includes(" - ")) {
      sourceName = source.name.split(" - ");
      sourceName = sourceName[sourceName.length - 1];
    }
     
    p.innerText = sourceName;
    p.className = "previewName";

    div.appendChild(img);
    div.appendChild(p);
    document.getElementById('preview').appendChild(div); 
  });


  // TODO: Old implementation based on menu pop up. See above for new implementation.
  // const videoOptionsMenu = Menu.buildFromTemplate(
  //   inputSources.map(source => {
  //     return {
  //       label: source.name,
  //       click: () => selectSource(source)
  //     };
  //   })
  // );

  // videoOptionsMenu.popup();
}
// Call the functiont to start showing preview once the application launches.
getVideoSources();

function selectVideoPreview (source) {
  return async function previewOnClick() {
    await selectSource(source);
  }
}

// Change the videoSource window to record
async function selectSource(source) {

  // videoSelectBtn.innerText = source.name;

  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id
      }
    }
  };

  // Create a Stream
  const stream = await navigator.mediaDevices
    .getUserMedia(constraints);

  // Preview the source in a video element
  videoElement.srcObject = stream;
  videoElement.play();

  // Create the Media Recorder
  const options = { mimeType: 'video/webm; codecs=vp9' };
  mediaRecorder = new MediaRecorder(stream, options);

  // Register Event Handlers
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.onstop = handleStop;

  // Updates the UI
}

function paintToCanvas() {
  const width = videoElement.videoWidth;
  const height = videoElement.videoHeight;
  

  canvasElement.width = width;
  canvasElement.height = height;

  ctx.drawImage(videoElement, 0, 0, width, height);
  // setInterval(() => {
  //   ctx.drawImage(videoElement, 0, 0, width, height);
  //   let pixels = ctx.getImageData(0, 0, width, height);
  //   pixels = blurEffect(pixels);
  //   ctx.putImageData(pixels, 0, 0);
  // }, 16);
}



function blurEffect(pixels) {
  console.log(pixels.data.length);
  for(let i=0; i < pixels.data.length; i+=4) {
    if (i >= 600000 && i <= 4000000) {
      pixels.data[i + 0] = pixels.data[i + 0] + 255; // Red
      pixels.data[i + 1] = pixels.data[i + 1] + 255; //Green
      pixels.data[i + 2] = pixels.data[i + 2] + 255; //Blue
    }
  }
  return pixels;
}

// Captures all recorded chunks
function handleDataAvailable(e) {
  console.log('video data available');
  recordedChunks.push(e.data);
}

// Saves the video file on stop
async function handleStop(e) {
  const blob = new Blob(recordedChunks, {
    type: 'video/webm; codecs=vp9'
  });

  const buffer = Buffer.from(await blob.arrayBuffer());

  const { filePath } = await dialog.showSaveDialog({
    buttonLabel: 'Save video',
    defaultPath: `vid-${Date.now()}.webm`
  });

  if (filePath) {
    writeFile(filePath, buffer, () => console.log('video saved successfully!'));
  }

}
