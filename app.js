const ipcRenderer = require('electron').ipcRenderer;
const BrowserWindow = require('electron').remote.BrowserWindow;
const remote = require('electron').remote;
const {app} = require('electron').remote;
const fs = require('fs')

var openvidu;
var session;
var publisher;
var mySessionId;
var needForSessionCreate = false;
var subscriberVideosInSession = 0;
var subscribers = [];
var firstStreamCreated = true;
var publisherConnected = false;
var publisherStreams = false;
var publisherStreamsFirstTime = true;
var deviceChanging = false;
var publisherMutedSubscriber = false;
var publisherMutedSelf = false;
var publisherStoppedOwnVideo = false;
var lastSelectedAudioSource, lastSelectedVideoSource, lastSelectedMicrophoneLabel, lastSelectedCameraLabel
var publisherVideoActive = 0
var publisherAudioActive = 0
var publisherSpotlighted = 0
var noAnswerMessageShown

// ipcRenderer.on('screen-share-ready', (event, message) => {
//     if (!!message) {
//         // User has chosen a screen to share. screenId is message parameter
//         showSession();
//         publisher = openvidu.initPublisher("publisher", {
//             videoSource: "screen:" + message
//         });
//         joinSession();
//     }
// });

function initPublisher() {
    openvidu = new OpenVidu();
    //disable openvidu browser logs
    openvidu.enableProdMode()
    //make the video call title
    makeVideoCallTitle()
    //play outgoing call sound
    playOutgoingRingtone(true)
    //publisher properties
    const resolution = makeLandscapeResolution(document.getElementById("resolution").value);
    const fps = document.getElementById("fps").value;
    const enableaudio = parseInt(document.getElementById("enableaudio").value);
    const enablevideo = parseInt(document.getElementById("enablevideo").value);
    const shareScreen = parseInt(document.getElementById("screen-sharing").value);
    const isGroup = parseInt(document.getElementById('is_group').value);
    if (!isGroup) {
        //automatic app close countdown
        // automaticAppClose()
    }
    var publisherProperties;
    if (shareScreen === 1) {
        // openScreenShareModal();
    } else {
        publisherProperties = {
            // 128x96
            // 320x240
            // 480x360
            // 640x480
            // 960x720
            resolution: resolution,
            frameRate: fps,
            publishAudio: enableaudio,
            publishVideo: enablevideo,
            mirror: true,
            filter: {
                type: "GStreamerFilter",
                options: {
                    //command: "videoflip method=vertical-flip"
                    command: "timeoverlay"
                }
            },
            //get default sources
            videoSource: undefined,
            audioSource: undefined
        }
    }


    console.log('resolution')
    console.log(publisherProperties.resolution)
    //make global OV, publisher properties, for making new publishers when device change
    window.initializedPublisherProperties = publisherProperties;
    window.initializedOpenVidu = openvidu;
    //set our STUN server
    openvidu.setAdvancedConfiguration({
        forceMediaReconnectionAfterNetworkDrop: true,
        iceServers: [
            {
                urls: ["stun:ovideo.waavia7.com:3478"]
            }],
    })
    //show slash camera on audio call
    if (!enablevideo) {
        cameraButtonActions('disable')
    }
    //check publisher media before joining to session
    devicesCheck()
}

function makeLandscapeResolution(resolution) {
    let dimensions = resolution.split('x')
    let width = dimensions[0]
    let height = dimensions[1]
    if (parseInt(height) > parseInt(width)) {
        //invert dimensions
        return height + 'x' + width
    } else {
        return resolution
    }
}

function makeVideoCallTitle() {
    const groupName = document.getElementById('group_name').value
    let videoCallTitleElement = document.getElementById('waavia-7-group-title')
    if (groupName && groupName !== 'undefined') {
        videoCallTitleElement.textContent = "Waavia 7 - Video call -" + " " + groupName
    }
}

function devicesCheck() {
    let checkedDevices = []
    openvidu.getDevices().then(devices => {
        if (devices.length === 0) {
            showNoDevicesMessage()
        } else {
            devices.forEach((device) => {
                if (device.kind === 'audioinput') {
                    microphonesCheck(device, checkedDevices, devices)
                }
                if (device.kind === 'videoinput') {
                    camerasCheck(device, checkedDevices, devices)
                }
            })
        }

    })
}

function microphonesCheck(microphone, checkedDevices, devices) {
    //make property "isWorking" inside device object in order to keep information about if it's working or not
    openvidu.getUserMedia({
        audioSource: microphone.deviceId,
        videoSource: false,
    }).then(mediaStream => {
        deviceCheckResultProcess(microphone, checkedDevices, devices)
    }).catch(error => {
        deviceCheckResultProcess(microphone, checkedDevices, devices, error)
    })
}

function camerasCheck(camera, checkedDevices, devices) {
    //make property "isWorking" inside device object in order to keep information about if it's working or not
    openvidu.getUserMedia({
        audioSource: false,
        videoSource: camera.deviceId,
        resolution: window.initializedPublisherProperties.resolution,
        frameRate: window.initializedPublisherProperties.frameRate
    }).then(mediaStream => {
        deviceCheckResultProcess(camera, checkedDevices, devices)
    }).catch(error => {
        deviceCheckResultProcess(camera, checkedDevices, devices, error)
    })
}

function deviceCheckResultProcess(device, checkedDevices, allDevices, error) {
    if (error) {
        console.error(error)
        device.isWorking = false
    } else {
        device.isWorking = true
    }
    checkedDevices.push(device)
    if (checkedDevices.length === allDevices.length) {
        makeDevicesListAndPublisherStream(checkedDevices)
    }
}

function makeDevicesListAndPublisherStream(checkedDevices) {
    let defaultMicrophoneLabel, defaultCameraLabel, defaultMicrophone, defaultCamera
    let waavia7Dat = document.getElementById("waavia7_dat_file").value

    let waavia7DatObj = validateWaavia7Dat(waavia7Dat)

    //choose last chosen devices from previous call
    defaultMicrophone = checkedDevices.find(device => (device.label === waavia7DatObj.m) && device.isWorking)
    defaultCamera = checkedDevices.find(device => (device.label === waavia7DatObj.c) && device.isWorking)

    if (defaultMicrophone) {
        defaultMicrophoneLabel = defaultMicrophone.label

        window.initializedPublisherProperties.audioSource = defaultMicrophone.deviceId
        lastSelectedAudioSource = defaultMicrophone.deviceId

    } else {
        //if previous microphone's not working, choose a working one from the list
        defaultMicrophone = checkedDevices.find(device => device.kind === 'audioinput' && device.isWorking)
        if (defaultMicrophone) {
            defaultMicrophoneLabel = defaultMicrophone.label

            window.initializedPublisherProperties.audioSource = defaultMicrophone.deviceId
            lastSelectedAudioSource = defaultMicrophone.deviceId

            saveLastDeviceLabel(defaultMicrophoneLabel, lastSelectedAudioSource, false, false)
        } else {
            //if none of the microphones working
            makeDeviceChangeTopMessage('error', 'Microphone not found')
            defaultMicrophoneLabel = 'No microphone'

            window.initializedPublisherProperties.audioSource = false
            publisherAudioActive = false
            lastSelectedAudioSource = false
        }
    }
    if (defaultCamera) {
        defaultCameraLabel = defaultCamera.label

        window.initializedPublisherProperties.videoSource = defaultCamera.deviceId
        lastSelectedVideoSource = defaultCamera.deviceId


    } else {
        //if previous camera not working, choose a working one from the list
        defaultCamera = checkedDevices.find(device => device.kind === 'videoinput' && device.isWorking)
        if (defaultCamera) {
            defaultCameraLabel = defaultCamera.label

            window.initializedPublisherProperties.videoSource = defaultCamera.deviceId
            lastSelectedVideoSource = defaultCamera.deviceId

            saveLastDeviceLabel(false, false, defaultCameraLabel, lastSelectedVideoSource)
        } else {
            //if none of the cameras working
            makeDeviceChangeTopMessage('error', 'Camera not found')
            defaultCameraLabel = 'No camera'
            cameraButtonActions('disable')

            window.initializedPublisherProperties.videoSource = false
            publisherVideoActive = false
            lastSelectedVideoSource = false
        }
    }
    makeDevicesLists(defaultMicrophoneLabel, defaultCameraLabel, checkedDevices);
    if ((!defaultMicrophone && !defaultCamera)) {
        makeDeviceChangeTopMessage('error', 'No devices found')
        showNoDevicesMessage()
    } else {
        makeDevicesLists(defaultMicrophoneLabel, defaultCameraLabel, checkedDevices);

        publisher = openvidu.initPublisher('publisher', window.initializedPublisherProperties);
        //keep publisher audio/video status
        updatePublisherStatus(window.initializedPublisherProperties.publishVideo, window.initializedPublisherProperties.publishAudio)
        publisherEvents(publisher)
        joinSession()
    }
}

function showNoDevicesMessage() {
    playOutgoingRingtone(false)
    showSession()
    let errorMessageInCenter = document.querySelector('#error-in-center')
    errorMessageInCenter.style.display = 'block'
    errorMessageInCenter.querySelector('.center-message').innerHTML =
        `<strong>Video call needs at least one enabled microphone or camera.</strong><br><br>
              Try to reopen the app after connecting the necessary devices.<br>
              App will automatically close soon...`
    setTimeout(() => leaveSession(), 12000)
}

function updatePublisherStatus(videoActive, audioActive) {
    publisherVideoActive = Number(videoActive)
    publisherAudioActive = Number(audioActive)
}

function validateWaavia7Dat(waavia7Dat) {
    let waavia7DatObj
    try {
        waavia7DatObj = JSON.parse(waavia7Dat)
    } catch (error) {
        waavia7DatObj = JSON.parse('{"m":"mic", "c":"cam"}')
    }
    return waavia7DatObj
}

function makeNewPublisher(publisherProperties) {
    checkIfPublisherMutedAudioVideo(publisherProperties)
    let newPublisher = openvidu.initPublisher("publisher", publisherProperties, error => completionHandler(error));
    publisherEvents(newPublisher)
}

function publisherVideoContainer(resolution) {
    switch (resolution) {
        case '96x128':
            changePublisherDimensions('100px', '130px')
            break;

        case '360x480':
            changePublisherDimensions('105px', '140px')
            break;

        case '240x320':
            changePublisherDimensions('105px', '140px')
            break;

        case '480x640':
            changePublisherDimensions('105px', '140px')
            break;

        case '720x960':
            changePublisherDimensions('120px', '120px')
            break;
    }
}

function changePublisherDimensions(width, height) {
    //change class publisher-video-container property values in order to avoid inline styles
    //so the classes replace for spotlight would work
    [...document.styleSheets[0].cssRules].find(x => x.selectorText === '.publisher-video-container')
        .style.width = width;
    [...document.styleSheets[0].cssRules].find(x => x.selectorText === '.publisher-video-container')
        .style.height = height;
}

function publisherEvents(publisher) {
    publisherAccessEvents(publisher)
    publisherVideoEvents(publisher)
    publisherStreamEvents(publisher)
}

function publisherAccessEvents(publisher) {
    publisher.on('accessDialogOpened', event => {
    })
    publisher.on('accessDialogClosed', event => {
    })
    publisher.on('accessAllowed', event => {
    })
    publisher.on('accessDenied', event => {
    })
}

function publisherVideoEvents(publisher) {
    publisher.on('videoElementCreated', event => {
        showSession();
        dragVideo()
    })
}

function publisherStreamEvents(publisher) {

    publisher.on('streamPropertyChanged', event => {
        if (event.changedProperty === 'videoActive') {
            console.log(event.newValue)
            publisherVideoActive = Number(event.newValue)
            customStreamPropertyChanged('video', publisherVideoActive)
        }
        if (event.changedProperty === 'audioActive') {
            publisherAudioActive = Number(event.newValue)
            customStreamPropertyChanged('audio', publisherAudioActive)
        }
    })

    publisher.on('streamCreated', event => {
        //send status after video starts playing
        console.log(event)
        sendPublisherStatus()
        sendingBandwidth(publisher, true)
    })

    publisher.on('streamDestroyed', event => {
        console.log(event)
        sendingBandwidth(publisher, false)
    })

    publisher.on('streamAudioVolumeChange', (event) => {
        let currentVolume = event.value.newValue
        volumeColorPids(currentVolume);
    });

    publisher.on('streamPlaying', event => {
        console.log('streamPlaying', event)
        publisherStreams = true
        checkIfPublisherHasVideoAudio()
    })
}

function customStreamPropertyChanged(type, value) {
    if (type === 'video') {
        sendMessage([], `{"a":"spc","p":{"v":${value},"s":"vd"}}`)
    }
    if (type === 'audio') {
        sendMessage([], `{"a":"spc","p":{"v":${value},"s":"au"}}`)
    }
}

function sendPublisherStatus(connectionObject) {
    let isOrganizer = parseInt(document.getElementById('is_organizer').value)
    publisherAudioActive = Number(!!publisher.stream.hasAudio && !!publisher.stream.audioActive)
    publisherVideoActive = Number(!!publisher.stream.hasVideo && !!publisher.stream.videoActive)
    if (connectionObject) {
        sendMessage([connectionObject], `{"a":"ds","p":{"a":${publisherAudioActive},"v":${publisherVideoActive}, "o":${isOrganizer}, "p":${publisherSpotlighted}}}`)
    } else {
        sendMessage([], `{"a":"ds","p":{"a":${publisherAudioActive},"v":${publisherVideoActive}, "o":${isOrganizer}, "p":${publisherSpotlighted}}}`)
    }
}

function playOutgoingRingtone(play) {
    let ringtoneElement = document.getElementById('outgoing-ringtone')
    if (play) {
        //play ringtone if you made the call
        let isOrganizer = parseInt(document.getElementById('is_organizer').value)
        if (isOrganizer) {
            ringtoneElement.play()
        }
    } else {
        ringtoneElement.pause()
    }
}

function checkIfPublisherHasVideoAudio() {
    let constraintsToApply = {
        audioConstraints: {
            sampleRate: 8000
        }
    }
    if (publisher.stream.hasVideo === false) {
        document.getElementById('publisher-camera-buttons').style.display = 'none'
    } else {
        document.getElementById('publisher-camera-buttons').style.display = 'inline-block'
    }
    if (publisher.stream.hasAudio === false) {
        document.getElementById('publisher-microphone-buttons').style.display = 'none'
    } else {
        if (publisher.stream.getMediaStream()) { //workaround 'if'
            let currentAudioTrack = publisher.stream.getMediaStream().getAudioTracks()[0]
            currentAudioTrack.applyConstraints(constraintsToApply.audioConstraints)
                .then(() => console.log('sample rate applied'))
                .catch(error => console.error(error))
            document.getElementById('publisher-microphone-buttons').style.display = 'inline-block'
        }
    }
    console.log('publisherMutedSelf in stream playing', publisherMutedSelf)
    if(publisherMutedSelf){
        publisher.publishAudio(false)
    }else {
        publisher.publishAudio(true)
    }
}

function checkIfPublisherMutedAudioVideo(publisherProperties) {
    if (publisherMutedSelf) {
        publisherProperties.publishAudio = 0
    } else {
        publisherProperties.publishAudio = 1
    }
    if (publisherStoppedOwnVideo) {
        publisherProperties.publishVideo = 0
    } else {
        publisherProperties.publishVideo = 1
    }
}

function updateDevicesListOnChange(publisherAudioLabel, publisherVideoLabel) {
    navigator.mediaDevices.ondevicechange = function (event) {
        //remove previous devices list content

        if (!(publisher.stream.getMediaStream().getAudioTracks()[0]) || publisher.stream.getMediaStream().getAudioTracks()[0].readyState === 'ended') {
            publisherAudioLabel = 'No audio'
        }
        if (!(publisher.stream.getMediaStream().getVideoTracks()[0]) || publisher.stream.getMediaStream().getVideoTracks()[0].readyState === 'ended') {
            publisherVideoLabel = 'No video'
        }
        //update with new content
        makeDevicesLists(publisherAudioLabel, publisherVideoLabel)
    }
}

function sendingBandwidth(publisher, run) {
    let videoBytesPrev = 0, audioBytesPrev = 0;
    let connection = publisher.stream.getRTCPeerConnection()
    showSendingBandwidth(videoBytesPrev, audioBytesPrev, connection, run)
}

function receivingBandwidth(subscriber, run, streamId) {
    let videoBytesPrev = 0, audioBytesPrev = 0, allTotalReceivingBitrates = [];
    let connection = subscriber.stream.getRTCPeerConnection()
    let intervalCustomId = 'interval-' + streamId
    showReceivingBandwidth(audioBytesPrev, videoBytesPrev, allTotalReceivingBitrates, connection, run, intervalCustomId)
}

function volumeColorPids(vol) {
    let allPids = [...(document.getElementsByClassName('pid'))];
    let amoutOfPids = Math.round(vol / 11);
    let volRange = allPids.slice(0, amoutOfPids)
    for (let i = 0; i < allPids.length; i++) {
        allPids[i].style.backgroundColor = "#e6e7e8";
    }
    if (volRange.length < 5) {
        for (let i = 0; i < volRange.length; i++) {
            volRange[i].style.backgroundColor = "green";
        }
    } else if (volRange.length <= 8) {
        for (let i = 0; i < 5; i++) {
            volRange[i].style.backgroundColor = "green";
        }
        for (let i = 5; i < volRange.length; i++) {
            volRange[i].style.backgroundColor = "yellow";
        }
    } else {
        for (let i = 0; i < 5; i++) {
            volRange[i].style.backgroundColor = "green";
        }
        for (let i = 5; i < 8; i++) {
            volRange[i].style.backgroundColor = "yellow";
        }
        for (let i = 8; i < volRange.length; i++) {
            volRange[i].style.backgroundColor = "red";
        }
    }
}

var sendingInterval;
var allTotalSendingBitrates = [];

function showSendingBandwidth(audioBytesPrev, videoBytesPrev, connection, runInterval) {
    let avgBitrate = 0, totalBitrate = 0, videoBitrate = 0, audioBitrate = 0;
    if (runInterval) {
        sendingInterval = setInterval(() => {
            connection.getStats().then(stats => stats.forEach(function (report) {
                if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
                    const audioBytes = report.bytesSent;
                    audioBitrate = (8 * (audioBytes - audioBytesPrev)) / 1024;
                    audioBytesPrev = audioBytes;
                }
            }))
            connection.getStats().then(stats => stats.forEach(function (report, idx, reports) {
                if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
                    const videoBytes = report.bytesSent;
                    videoBitrate = (8 * (videoBytes - videoBytesPrev) / 1024);
                    videoBytesPrev = videoBytes;
                }
            }))
            if (audioBitrate || videoBitrate) {
                totalBitrate = (audioBitrate + videoBitrate) / 5
                allTotalSendingBitrates.push(totalBitrate)
                if (allTotalSendingBitrates.length === 1) {
                    avgBitrate = Math.floor(allTotalSendingBitrates[0])
                } else {
                    avgBitrate = movingBandwidthAvg(avgBitrate, allTotalSendingBitrates)
                }
                document.getElementById('show-sending-bandwidth').innerHTML = `<strong>Sending:</strong>${avgBitrate}  kbps`;
            } else {
                document.getElementById('show-sending-bandwidth').innerHTML = `<strong>Sending: ...</strong>`;
            }
        }, 5000)
    } else {
        console.log('clear interval')
        clearInterval(sendingInterval)
        document.getElementById('show-sending-bandwidth').innerHTML = `<strong>Sending: ...</strong>`;
    }
}

function movingBandwidthAvg(lastAvgBitrate, allTotalBitrates) {
    let currentBitrate = allTotalBitrates[allTotalBitrates.length - 1]
    let currentAvgBitrate = (lastAvgBitrate + currentBitrate) / 2

    return Math.floor(currentAvgBitrate)
}

function sumBitrates(bitrates) {
    return bitrates.reduce((total, current) => {
        return total += current;
    });
}

let receivingInterval;
let allReceivingBitratesAvgs = [];
let allIntervalObjects = [];
let sumOfReceivingBitratesAvgs;

function showReceivingBandwidth(audioBytesPrev, videoBytesPrev, allTotalReceivingBitrates, connection, runInterval, intervalCustomId) {
    let videoBitrate = 0, audioBitrate = 0, totalBitrate = 0, avgBitrate = 0;
    let intervalObject = {
        id: '',
        currentPosition: 0 /*refers to when the interval started to execute. 0 for first interval, 1 for second etc.;*/
    }
    sumOfReceivingBitratesAvgs = 0;
    if (runInterval) {
        intervalObject.currentPosition = allIntervalObjects.length
        intervalObject.id = intervalCustomId
        allIntervalObjects.push(intervalObject)

        receivingInterval = setInterval(() => {
            //get all audio receiving kbits
            connection.getStats().then(stats => stats.forEach(function (report) {
                if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                    const audioBytes = report.bytesReceived;
                    audioBitrate = (8 * (audioBytes - audioBytesPrev)) / 1024;
                    audioBytesPrev = audioBytes;
                }
            }))
            //get all video receiving kbits
            connection.getStats().then(stats => stats.forEach(function (report, idx, reports) {
                if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                    const videoBytes = report.bytesReceived;
                    videoBitrate = (8 * (videoBytes - videoBytesPrev) / 1024);
                    videoBytesPrev = videoBytes;
                }
            }))
            if (audioBitrate || videoBitrate) {
                //make total kbits and push them to array
                totalBitrate = (audioBitrate + videoBitrate) / 5
                allTotalReceivingBitrates.push(totalBitrate)
                //make avg from current and previous total bitrates

                console.log('allTotalReceivingBitrates of ' + intervalObject.currentPosition)
                console.log(allTotalReceivingBitrates)
                console.log('avgBitrate before update')
                console.log(avgBitrate)


                console.log('allTotalReceivingBitrates is 0', allTotalReceivingBitrates.length === 0)
                if (allTotalReceivingBitrates.length === 1) {
                    avgBitrate = Math.floor(allTotalReceivingBitrates[0])

                    console.log('avgBitrate of ' + intervalObject.currentPosition)
                    console.log(avgBitrate)
                } else if(allTotalReceivingBitrates.length > 1){
                    avgBitrate = movingBandwidthAvg(avgBitrate, allTotalReceivingBitrates)

                    console.log('avgBitrate of ' + intervalObject.currentPosition)
                    console.log(avgBitrate)
                }

                //update avg bitrate for each interval using as index their current position
                console.log('intervalObject ' + intervalCustomId + ' position is ' + intervalObject.currentPosition)
                allReceivingBitratesAvgs[intervalObject.currentPosition] = avgBitrate

                console.log('allReceivingBitratesAvgs')
                console.log(allReceivingBitratesAvgs)

                //show the sum of the avgs when the interval in the last position runs
                if (intervalObject.currentPosition === allReceivingBitratesAvgs.length - 1) {

                    console.log('allReceivingBitratesAvgs in sum')
                    console.log(allReceivingBitratesAvgs)

                    sumOfReceivingBitratesAvgs = allReceivingBitratesAvgs.reduce((a, b) => a + b, 0)

                    console.log('allReceivingBitratesAvgs SUM')
                    console.log(sumOfReceivingBitratesAvgs)

                    document.getElementById('show-receiving-bandwidth').innerHTML = `<strong>Receiving:</strong>${sumOfReceivingBitratesAvgs}  kbps`;
                }
            } else {
                //show dots(...) if no audio or video bitrate received yet
                if (intervalObject.currentPosition === 0) {
                    document.getElementById('show-receiving-bandwidth').innerHTML = `<strong>Receiving: ...</strong>`;
                }
            }
        }, 5000)
    } else {
        //when runInterval is false, find the interval object to delete
        let intervalToStop = allIntervalObjects.find(interval => interval.id === intervalCustomId)

        console.log('intervalToStop')
        console.log(intervalToStop)

        //remove its avg bitrate from total avgs array
        allReceivingBitratesAvgs.splice(intervalToStop.currentPosition, 1)

        //remove the interval object
        allIntervalObjects = allIntervalObjects.filter(interval => interval.id !== intervalToStop.id)

        console.log('allReceivingBitratesAvgs after remove of ' + intervalToStop.currentPosition)
        console.log(allReceivingBitratesAvgs)
        console.log('allIntervalObjects after remove of ' + intervalToStop.currentPosition)
        console.log(allIntervalObjects)
        console.log('receivingInterval to stop')
        console.log(receivingInterval)

        //move all the currentPositions that are bigger than the deleted currentPosition one position left
        //in order to keep correspondence between them and allReceivingBitratesAvgs indexes
        allIntervalObjects.forEach(interval => {
            if (interval.currentPosition > intervalToStop.currentPosition) {
                interval.currentPosition--
            }
        })

        //stop this interval from looping
        clearInterval(receivingInterval)
    }
}

function completionHandler(error) {
    if (error) {
        if (error.name.includes('DEVICE')) {
            console.error('Device error')
            console.error(error)
        } else {
            console.error('Error on initializing publisher')
            console.error(error)
        }
    } else {
        console.log('No errors on publisher initialization')
    }
}

function clearPreviousTopMessages(classType) {
    let topMessages = document.getElementsByClassName('top-message')
    if (topMessages) {
        for (let i = 0; i < topMessages.length; i++) {
            if (topMessages[i].classList.contains(classType)) {
                topMessages[i].style.display = 'none'
            }
        }
    }
}

function emptyDevicesLists() {
    let camerasList = document.getElementById('publisher-cameras-list')
    let microphonesList = document.getElementById('publisher-microphones-list')
    camerasList.innerHTML = ''
    microphonesList.innerHTML = ''
}

function makeDevicesLists(defaultMicrophoneLabel, defaultCameraLabel, devices) {
    //empty list if already filled before re-appending devices
    //get publisher devices and list them in front
    emptyDevicesLists()
    devices.forEach(device => {
        if (device.isWorking) {
            appendDevicesListElements(device)
        }
    })
    changeListActivatorText(defaultMicrophoneLabel, 'microphones')
    changeListActivatorText(defaultCameraLabel, 'cameras')
}

function dragVideo() {
    let publisherVideoContainer = document.getElementById('publisher')
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    var sessionElement = document.getElementById('session')
    publisherVideoContainer.onmousedown = dragMouseDown

    function dragMouseDown(e) {
        e = e || window.event
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position
        if (publisherVideoContainer.offsetTop - pos2 >= 0
            && publisherVideoContainer.offsetTop + publisherVideoContainer.offsetHeight - pos2 <= sessionElement.offsetHeight) {
            publisherVideoContainer.style.top = publisherVideoContainer.offsetTop - pos2 + 'px';
        }
        if (publisherVideoContainer.offsetLeft - pos1 >= 0
            && publisherVideoContainer.offsetLeft + publisherVideoContainer.offsetWidth - pos1 <= sessionElement.offsetWidth) {
            publisherVideoContainer.style.left = publisherVideoContainer.offsetLeft - pos1 + 'px';
        }
    }
}

function appendDevicesListElements(device) {
    let listElement = makeListElement(device);
    let listLabel = listElement.innerText;
    if (device.kind === 'videoinput') {
        document.getElementById('publisher-cameras-list').appendChild(listElement);
    }
    if (device.kind === 'audioinput') {
        document.getElementById('publisher-microphones-list').appendChild(listElement)
    }
}

function makeListElement(device) {
    let listElement = document.createElement('LI');
    listElement.classList.add('dropdown-list-item', 'device');
    listElement.innerText = device.label;
    listElement.addEventListener('click', () => {
        changeDevice(listElement, device)
    })
    return listElement;
}

function changeListActivatorText(label, type) {
    let listActivator = document.querySelector('#publisher-' + type + '-list-activator')
    listActivator.innerText = label
}

var onErrorFlag = false

function changeDevice(listElement, device) {
    // deviceChanging = true
    //check device type user wants to change
    if (device.kind === 'audioinput') {
        changeMediaStream(device.deviceId, lastSelectedVideoSource, 'audio')
    }
    if (device.kind === 'videoinput') {
        changeMediaStream(lastSelectedAudioSource, device.deviceId, 'video')
    }
}


function changeMediaStream(audioSource, videoSource, kind, label) {
    let publisherVideo = document.querySelector('#publisher video')
    openvidu.getUserMedia({
        audioSource: audioSource,
        videoSource: videoSource,
        resolution: window.initializedPublisherProperties.resolution,
        frameRate: window.initializedPublisherProperties.frameRate
    }).then(mediaStream => {
        let track;
        if (kind === 'audio') {
            track = mediaStream.getAudioTracks()[0];
        }
        if (kind === 'video') {
            track = mediaStream.getVideoTracks()[0];
        }
        // let sender = publisher.stream.getRTCPeerConnection().getSenders().find(function (s) {
        //     return s.track.kind === kind;
        // });
        publisher.replaceTrack(track).then(() => {
            publisher.videoReference.muted = true //workaround for echo problem with microphone change
            makeDeviceChangeTopMessage('success', 'Device changed successfully')
            if (kind === 'audio') {
                saveLastDeviceLabel(track.label, audioSource, false, false)
                changeListActivatorText(track.label, 'microphones')
            }
            if (kind === 'video') {
                saveLastDeviceLabel(false, false, track.label, videoSource)
                changeListActivatorText(track.label, 'cameras')
            }
        }).catch(error => {
            console.error(error)
            makeDeviceChangeTopMessage('error', 'Error on changing ' + kind + ' track')
        })
    }).catch(error => {
        console.error('error on device change')
        console.error(error)
        if (error.message.includes('video')) {
            console.error('video error')
            changeMediaStream(audioSource, false, 'audio')
        } else if (error.message.includes('audio')) {
            console.error('audio error')
            changeMediaStream(false, videoSource, 'video')
        } else {
            makeDeviceChangeTopMessage('error', 'Error on changing ' + kind + ' track')
        }
    })
}

function saveLastDeviceLabel(microphoneLabel, audioSource, cameraLabel, videoSource) {
    let waavia7DatPath = app.getPath('userData') + '/waavia7.dat'
    let waavia7Dat = document.getElementById("waavia7_dat_file").value
    let updatedWaavia7Dat
    let waavia7DatObj = validateWaavia7Dat(waavia7Dat)
    if (cameraLabel) {
        waavia7DatObj.c = cameraLabel
        lastSelectedCameraLabel = cameraLabel
        if (lastSelectedMicrophoneLabel) {
            waavia7DatObj.m = lastSelectedMicrophoneLabel
        }
        lastSelectedVideoSource = videoSource
    }
    if (microphoneLabel) {
        waavia7DatObj.m = microphoneLabel
        lastSelectedMicrophoneLabel = microphoneLabel
        if (lastSelectedCameraLabel) {
            waavia7DatObj.c = lastSelectedCameraLabel
        }
        lastSelectedAudioSource = audioSource
    }
    updatedWaavia7Dat = JSON.stringify(waavia7DatObj)
    fs.writeFile(waavia7DatPath, updatedWaavia7Dat, (err => {
        if (err) {
            console.error(err)
        } else {
        }
    }))
}

function makeDeviceChangeTopMessage(type, message) {
    clearPreviousTopMessages('device-top-message')
    let deviceChange = document.getElementById(type + '-message')
    deviceChange.classList.add('device-top-message')
    deviceChange.style.display = 'block'
    if (type === 'success') {
        deviceChange.innerText = message
        makeAndAppendDismissButton(deviceChange, 'device-top-message')
        setTimeout(() => {
            deviceChange.style.display = 'none'
        }, 3000)
    }
    if (type === 'error') {
        deviceChange.innerText = message
        makeAndAppendDismissButton(deviceChange, 'device-top-message')
    }
}

function joinSession(reconnection) {
    console.log('join session run')
    session = openvidu.initSession();

    console.log('session created from initSession', session)

    //session events
    sessionStreamEvents()
    sessionConnectionEvents()
    sessionNetworkQuality()
    sessionSpeakingEvents()
    receivedMessageEvent() //register for receiving messages from specific message type

    mySessionId = document.getElementById("sessionId").value;
    const publisherName = document.getElementById("publisher_name").value; //publisher name from odata.dat
    const isOrganizer = parseInt(document.getElementById('is_organizer').value);
    //if I am not reconnecting, create session and try to connect
    if (!reconnection) {
        needForSessionCreate = true
        console.log('create session')
        getTokenAndConnect(publisherName)
    } else {
        //when I am  reconnection, check for available sessions and try to connect
        axios.get(
            OPENVIDU_SERVER_URL + '/openvidu/api/sessions/' + mySessionId,
            {
                headers: {
                    'Authorization': "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
                    'Content-Type': 'application/json',
                },
                // crossdomain: true
            }
        )
            .then(sessionObj => {
                console.log('session object retrieved', sessionObj)
                //session exists
                if (sessionObj.status === 200) {
                    console.log('retrieve session')
                    needForSessionCreate = false
                    getTokenAndConnect(publisherName)
                }
            }).catch(error => {
                playOutgoingRingtone(false)
                showSession()
                let errorMessageInCenter = document.querySelector('#error-in-center')
                errorMessageInCenter.style.display = 'block'
                errorMessageInCenter.querySelector('.center-message').innerHTML =
                `<strong>You tried to connect to a none existing session.</strong><br><br>
                App will automatically close soon...`
                setTimeout(() => leaveSession(), 6000)

                console.error('error on retrieving session', error)
        });
    }
}

function getTokenAndConnect(publisherName) {
    getToken(mySessionId).then(token => {
        session.connect(token, '{"clientData": "' + publisherName + '"}')
            .then(() => {
                session.publish(publisher).then(() => {
                    networkEventHandling('reconnected', 'You are connected', 'success')
                }).catch(error => {
                    console.error('Error on first publish')
                    console.error(error)
                });
            })
            .catch(error => {
                console.error("There was an error connecting to the session:", error.code, error.message);
                networkEventHandling('connection-failed', 'Couldn\'t connect to session', 'error')
                //retry
            });
    });
}

var countdownForAutomaticAppClose;
var noAnswerMessage

function automaticAppClose() {
    noAnswerMessage = setTimeout(() => {
        let noAnswerMessageContainer = document.getElementById('wait-others-message')
        noAnswerMessageContainer.innerText = 'No answer'
    }, 29500)
    countdownForAutomaticAppClose = setTimeout(() => {
        leaveSession()
    }, 30000)
}

function stopAutomaticAppClose() {
    clearTimeout(noAnswerMessage)
    clearTimeout(countdownForAutomaticAppClose)
}

function sessionConnectionEvents() {
    //for remote connection
    sessionConnectionDestroyed()
    sessionConnectionCreated()
    //for local connection
    sessionReconnectionEvents()
}

function sessionStreamEvents() {
    sessionStreamCreated()
    sessionStreamDestroyed()
}

function sessionSpeakingEvents() {
    //events below referring to subscriber
    session.on('publisherStartSpeaking', event => {
        console.log(event)
        subscriberSpeaking(event, 'start')
    });

    session.on('publisherStopSpeaking', event => {
        console.log(event)
        subscriberSpeaking(event, 'stop')
    });
}

function subscriberSpeaking(eventObject, action){
    let subscriberSpeakingConnectionId = eventObject.connection.connectionId
    let speakingSubscriberVidContainer = document.getElementById('remoteVideoContainer_' + subscriberSpeakingConnectionId)
    if(speakingSubscriberVidContainer){ //check if container has been deleted before speaking event
        if(speakingSubscriberVidContainer.querySelector('.subscriber-background-video-off')){
            let circleWithInitials = speakingSubscriberVidContainer.querySelector('.subscriber-initials')
            classHandleOnSpeakingAction(action, circleWithInitials, 'subscriber-background-video-off-speaking')
        }else {
            classHandleOnSpeakingAction(action, speakingSubscriberVidContainer, 'subscriber-speaking')
        }
    }

}

function classHandleOnSpeakingAction(action, element, classString){
    if(action === 'start'){
        element.classList.add(classString)
    }
    if(action === 'stop'){
        element.classList.remove(classString)
    }
}

function switchClassesOnSpeaking(speakingSubscriberVidContainer, switchAction){
    if(speakingSubscriberVidContainer){
        let circleWithInitials = speakingSubscriberVidContainer.querySelector('.subscriber-initials')
        if(switchAction === 'switch-to-video-on') {
            if(circleWithInitials.classList.contains('subscriber-background-video-off-speaking')) {
                classHandleOnSpeakingAction('start', speakingSubscriberVidContainer, 'subscriber-speaking')
                classHandleOnSpeakingAction('stop', circleWithInitials, 'subscriber-background-video-off-speaking')
            }
        }
        if(switchAction === 'switch-to-video-off') {
            if(speakingSubscriberVidContainer.classList.contains('subscriber-speaking')) {
                classHandleOnSpeakingAction('stop', speakingSubscriberVidContainer, 'subscriber-speaking')
                classHandleOnSpeakingAction('start', circleWithInitials, 'subscriber-background-video-off-speaking')
            }
        }
    }
}

function sessionStreamCreated() {
    session.on("streamCreated", function (event) {
        //subscriber object on each stream without video element
        let subscriber = session.subscribe(event.stream, undefined)
        sendPublisherStatus(subscriber.stream.connection)
        addSubscriberVideoStream(subscriber);
        // receivingBandwidth(subscriber, true, subscriber.stream.streamId)
        //add subscriber to array
        subscribers.push(subscriber);
        //enable clock on first connection and delete waiting message
        if (firstStreamCreated === true) {
            firstStreamCreated = false;
            //stop outgoing ringtone sound
            playOutgoingRingtone(false)
            // stopAutomaticAppClose()
            clock();
        }
    });
}

function sessionNetworkQuality() {
    session.on('networkQualityLevelChanged', event => {
        let networkQuality = document.getElementById('network-quality')
        let tooltipText = document.querySelector('#network-quality .tooltip-text')
        if (event.connection.connectionId === session.connection.connectionId) {
            if (event.newValue === 5) {
                networkQuality.style.color = 'green'
                tooltipText.innerText = 'Network quality: Excellent'
            }
            if (event.newValue === 4) {
                networkQuality.style.color = 'lightgreen'
                tooltipText.innerText = 'Network quality: Good'
            }
            if (event.newValue === 3) {
                networkQuality.style.color = 'gold'
                tooltipText.innerText = 'Network quality: Non Optimal'
            }
            if (event.newValue === 2) {
                networkQuality.style.color = 'goldenrod'
                tooltipText.innerText = 'Network quality: Poor'
            }
            if (event.newValue === 1) {
                networkQuality.style.color = 'darkgoldenrod'
                tooltipText.innerText = 'Network quality: Bad'
            }
            if (event.newValue === 0) {
                networkQuality.style.color = 'grey'
                tooltipText.innerText = 'Network quality: Broken'
            }
        }
    });
}

function sessionStreamDestroyed() {
    session.on("streamDestroyed", function (event) {
        //delete current subscriber from array
        for (let i = 0; i < subscribers.length; i++) {
            if (subscribers[i].stream.streamId === event.stream.streamId) {
                let deletedSubscriber = subscribers.splice(i, 1)[0];
                let connectionId = deletedSubscriber.stream.connection.connectionId
                // receivingBandwidth(deletedSubscriber, false, deletedSubscriber.stream.streamId)
                deleteVideoStream(connectionId)
            }
        }
    });
}

function sessionConnectionDestroyed() {
    session.on('connectionDestroyed', event => {
        if (event.connection.hasOwnProperty('localOptions')) {
            console.log('disconnect local options')
        }
        if (event.connection.hasOwnProperty('remoteOptions')) {
            if (event.reason === 'disconnect') {
                makeDisconnectionMessage(event, 'left', 'afterName')
                //disable clock if only publisher left in connection
                if (subscribers.length === 0) {
                    document.getElementById("clock").innerHTML = '<label id="minutes">00</label><label>:</label><label id="seconds">00</label>';
                    firstStreamCreated = true;
                    // wait until "someone left" message finish, and show closing message
                    setTimeout(() => {
                        let closingVideoCallMessage = document.getElementById('closing-video-call-message')
                        closingVideoCallMessage.style.display = 'block'
                    }, 2000)
                    //close session
                    setTimeout(() => {
                        leaveSession()
                    }, 3000)
                }
            }
            if (event.reason === 'networkDisconnect') {
                makeDisconnectionMessage(event, 'lost network connection', 'afterName')
                //disable clock if only publisher left in connection
                if (subscribers.length === 0) {
                    document.getElementById("clock").innerHTML = '<label id="minutes">00</label><label>:</label><label id="seconds">00</label>';
                    firstStreamCreated = true;
                    // wait until "someone lost network connection" message finish and show closing message
                    setTimeout(() => {
                        let waitForReconnection = document.getElementById('wait-for-subscriber-reconnect-message')
                        let subscriberName = JSON.parse(event.connection.data).clientData;
                        waitForReconnection.innerText = 'Wait for ' + subscriberName + ' to reconnect'
                        waitForReconnection.style.display = 'block'
                    }, 2000)
                }
            }
        }
    })
}

function sessionConnectionCreated() {
    session.on('connectionCreated', event => {
        console.log('connection created event', event)
        if (event.connection.hasOwnProperty('localOptions')) {
            console.log('localOptions')
            publisherConnected = true
        }
        if (event.connection.hasOwnProperty('remoteOptions')) {
            console.log('remoteOptions')
            //delete "wait for someone messages"
            //stop outgoing ringtone
            playOutgoingRingtone(false);
            let waitForReconnection = document.getElementById('wait-for-subscriber-reconnect-message')
            waitForReconnection.style.display = 'none'
            let waitOthersMessage = document.getElementById('wait-others-message')
            waitOthersMessage.style.display = 'none'
            makeConnectionMessage(event, 'Connecting with')
        }
    })
}

function sessionReconnectionEvents() {
    session.on('reconnecting', () => networkEventHandling('reconnecting', 'Your network connection got lost. Trying to reconnect...', 'generic'));
    session.on('reconnected', () => networkEventHandling('reconnected', 'You are connected', 'success'));
    session.on('sessionDisconnected', event => {
        if (event.reason === 'networkDisconnect') {
            publisherReconnection()
        }
    })
}

function publisherReconnection() {
    console.log('publisher reconnection run')
    //delete subscribers video containers and get them back on reconnection
    networkEventHandling('wait-for-reconnection', 'Reconnecting...', 'generic')
    //get both subscribers' and spotlight classes
    let videoContainers = document.querySelectorAll('#subscribers-video-container .subscriber-video-container, #subscribers-video-container .spotlight-video-container')
    if (videoContainers) {
        for (let i = 0; i < videoContainers.length; i++) {
            videoContainers[i].remove()
        }
    }
    //publisher renegotiation
    makeNewPublisher(window.initializedPublisherProperties);
    subscriberVideosInSession = 0;
    joinSession(true);
}

function makeConnectionMessage(event, message, afterNameMessage) {
    let subscriberName = JSON.parse(event.connection.data).clientData;
    let connectionId = event.connection.connectionId
    deletePreviousConnectionMessage(connectionId)
    let messageContainer = makeContainer('subscriberConnectingMessage_' + connectionId, null);
    subscriberBackgroundVideoOff(messageContainer, connectionId, subscriberName, false, message, afterNameMessage)
    //append to subscribers' container
    document.getElementById('subscribers-video-container').appendChild(messageContainer)
    return messageContainer
}

function makeDisconnectionMessage(event, message, afterNameMessage) {
    let waitOthersMessage = document.getElementById('wait-others-message')
    waitOthersMessage.style.display = 'none'

    let messageContainer = makeConnectionMessage(event, message, afterNameMessage)
    messageContainer.style.zIndex = '2'
    setTimeout(() => {
        messageContainer.remove()
    }, 2000)
}

function networkEventHandling(event, message, type) {
    clearPreviousTopMessages('network-top-message')
    makeNetworkTopMessageElement(message, type)
}

function makeNetworkTopMessageElement(message, type) {
    let networkMessage;
    networkMessage = document.getElementById(type + '-message')
    networkMessage.classList.add('network-top-message')
    networkMessage.style.display = 'block'
    networkMessage.innerText = message
    makeAndAppendDismissButton(networkMessage, 'network-top-message')
    if (type === 'error') {
        makeAndAppendReconnectionButton(networkMessage, 'network-top-message')
    }
    if (type === 'success') {
        setTimeout(() => networkMessage.style.display = 'none', 3000)
    }
}

function makeAndAppendDismissButton(messageElement, classType) {
    let dismissButton = makeButton('Dismiss', 'dismiss-button')
    dismissButton.addEventListener('click', () => clearPreviousTopMessages(classType))
    messageElement.appendChild(dismissButton)
}

function makeAndAppendReconnectionButton(messageElement, classType) {
    let reconnectionButton = makeButton('Try to reconnect', 'reconnection-button')
    reconnectionButton.addEventListener('click', () => publisherReconnection())
    messageElement.appendChild(reconnectionButton)
}

function makeButton(innerText, className) {
    let button = document.createElement('button')
    button.innerText = innerText
    button.classList.add(className)
    return button
}

function deletePreviousConnectionMessage(connectionId) {
    //delete previous connecting message if exists
    let currentConnectionMessage = document.getElementById('subscriberConnectingMessage_' + connectionId)
    if (currentConnectionMessage) {
        currentConnectionMessage.remove()
    }
}

function addSubscriberVideoStream(subscriber) {
    let video = document.createElement('video')
    subscriber.addVideoElement(video);
    let connectionId = subscriber.stream.connection.connectionId
    if (document.getElementById('subscriberConnectingMessage_' + connectionId)) {
        //remove container showing connecting message before appending video container
        let subscriberConnectingMessage = document.getElementById('subscriberConnectingMessage_' + connectionId)
        subscriberConnectingMessage.remove()
    }
    let toolsListElementId;
    let subscriberName = JSON.parse(subscriber.stream.connection.data).clientData;
    let vidContainer = makeContainer('remoteVideoContainer_' + connectionId, video)
    vidContainer.appendChild(makeSubscriberLabelContent(subscriberName, subscriber))
    //append to subscribers' container
    document.getElementById('subscribers-video-container').appendChild(vidContainer)
    //when video starts streaming make its container
    subscriber.on('streamPlaying', event => {
        console.log('stream playing event', event)
        console.log('streamPlaying media stream video', event.target.stream.getMediaStream().getVideoTracks())
        console.log('streamPlaying media stream audio', event.target.stream.getMediaStream().getAudioTracks())
        if(event.target.stream.getMediaStream().getVideoTracks().length > 0){
            console.log('subscriber has video track')
            subscriber.subscribeToVideo(true)
        }else {
            console.log('subscriber has not video track')
        }
    })
    subscriberVideosInSession += 1
    updateLayout(subscriberVideosInSession);
}

function subscriberAudioOff(subscriber, connectionId, audioActive) {
    let subscriberLabelId = 'label-' + connectionId
    let subscriberLabel = document.getElementById(subscriberLabelId)
    if (audioActive === false) {
        //remove microphone with click listener
        removeSubscriberMicrophone(subscriberLabelId)
        //make microphone slash without click listener
        let microphoneSlash = makeSubscriberMicrophoneSlashElement(subscriber, subscriberLabelId, false)
        subscriberLabel.appendChild(microphoneSlash)
    } else {
        let existingMicrophoneSlash = document.querySelector('#' + subscriberLabelId + " .non-click-microphone-slash")
        existingMicrophoneSlash.remove()
        appendMicrophoneOnSubscriberLabel(subscriber, subscriberLabel, subscriberLabelId)
    }
}

function removeSubscriberMicrophone(subscriberLabelId) {
    let subscriberMicrophone = document.querySelector('#' + subscriberLabelId + " .subscriber-stop-audio-button")
    if (subscriberMicrophone) {
        subscriberMicrophone.remove()
    }
    let subscriberMicrophoneSlash = document.querySelector('#' + subscriberLabelId + " .subscriber-stop-audio-button-slash");
    if (subscriberMicrophoneSlash) {
        subscriberMicrophoneSlash.remove()
    }
}

function makeContainer(containerId, video) {
    let container = document.createElement('div');
    container.setAttribute('id', containerId);
    container.setAttribute('class', 'subscriber-video-container');
    if (video) {
        container.appendChild(video);
    }
    return container
}

function subscriberBackgroundVideoOff(vidContainer, connectionId, subscriberName, videoActive, message, messageAfterName) {
    if (videoActive === false) {
        let subscriberBackground = makeBackgroundVideoOff(connectionId)
        makeSubscriberInitials(subscriberBackground, subscriberName)
        if (message) {
            makeBackgroundMessage(subscriberBackground, subscriberName, message, messageAfterName)
        }
        console.log('background appended ', subscriberBackground)
        vidContainer.appendChild(subscriberBackground)
    } else {
        let existingBackgroundVideoOff = document.getElementById('background-video-off-' + connectionId)
        console.log('background removed ', existingBackgroundVideoOff)
        existingBackgroundVideoOff.remove()
    }
}

function makeBackgroundMessage(subscriberBackground, subscriberName, message, afterNameMessage) {
    let backgroundMessage = document.createElement('div')
    backgroundMessage.classList.add('subscriber-action-message')
    if (afterNameMessage) {
        backgroundMessage.innerText = subscriberName + ' ' + message + '...'
    } else {
        backgroundMessage.innerText = message + ' ' + subscriberName + '...'
    }
    subscriberBackground.appendChild(backgroundMessage)
}

function makeBackgroundVideoOff(connectionId) {
    let subscriberBackground = document.createElement('div')
    subscriberBackground.setAttribute('id', 'background-video-off-' + connectionId)
    subscriberBackground.classList.add('subscriber-background-video-off')
    return subscriberBackground
}

function makeSubscriberInitials(subscriberBackground, subscriberName) {
    let subscriberInitials = document.createElement('div')
    subscriberInitials.classList.add('subscriber-initials')
    subscriberInitials.innerHTML = "<p style='font-size: 30px;'>" + initials2Letters(subscriberName) + "</p>"
    subscriberBackground.appendChild(subscriberInitials)
}

function initials2Letters(subscriberName) {
    //subscriber name with spaces
    if (subscriberName.indexOf(' ') >= 0) {
        let matches = subscriberName.match(/\b(\w)/g);
        let acronym = matches.join('');
        if (acronym.length > 1) {
            return acronym[0].toUpperCase() + acronym[1].toUpperCase()
        } else if (acronym.length === 1) {
            return acronym[0].toUpperCase()
        }
    }
    //subscriber name without spaces
    else {
        if (subscriberName.length > 1) {
            return subscriberName[0].toUpperCase() + subscriberName[1].toUpperCase()
        } else if (subscriberName.length === 1) {
            return subscriberName[0].toUpperCase()
        }
    }
}

function makeSubscriberLabelContent(subscriberName, subscriber) {
    let subscriberLabelContent = document.createElement('div')
    let connectionId = subscriber.stream.connection.connectionId
    subscriberLabelContent.classList.add('subscriber-label-content')
    subscriberLabelContent.setAttribute('id', 'label-content-' + connectionId)
    let subscriberLabel = makeSubscriberLabel(subscriberName, subscriber, connectionId)
    let subscriberLabelToolsList = makeSubscriberLabelToolsList(subscriberLabelContent, subscriber, connectionId)
    subscriberLabelContent.appendChild(subscriberLabel)
    subscriberLabelContent.appendChild(subscriberLabelToolsList)
    return subscriberLabelContent
}

function makeSubscriberLabelToolsList(subscriberLabelContent, subscriber, connectionId) {
    let subscriberLabelToolsList = document.createElement('ul')
    subscriberLabelToolsList.classList.add('subscriber-label-tools-list', 'dropdown-content')
    subscriberLabelToolsList.setAttribute('id', 'label-tools-list-' + connectionId)
    let subscriberToolListElementsArray = [];
    makeSubscriberLabelToolsListElements(subscriber, connectionId, subscriberToolListElementsArray)
    appendSubscriberLabelToolsListElements(subscriberLabelToolsList, subscriberToolListElementsArray)
    return subscriberLabelToolsList
}

function makeSubscriberLabelToolsListElements(subscriber, connectionId, subscriberToolListElementsArray) {
    makeSubscriberMuteToEveryone(subscriber, 'mute-subscriber-to-everyone-' + connectionId, subscriberToolListElementsArray)
    makeDisabledSubscriberMuteToEveryone(subscriber, 'disabled-mute-subscriber-to-everyone-' + connectionId, subscriberToolListElementsArray)
    makeStopSubscriberVideoToEveryone(subscriber, 'stop-subscriber-video-to-everyone-' + connectionId, subscriberToolListElementsArray)
    makeDisabledStopSubscriberVideoToEveryone(subscriber, 'disabled-stop-subscriber-video-to-everyone-' + connectionId, subscriberToolListElementsArray)
    makeKickSubscriberFromSession(subscriber, 'kick-subscriber-from-session-' + connectionId, subscriberToolListElementsArray)
    makeSubscriberSpotlight(subscriber, 'subscriber-spotlight-to-me-list-element-' + connectionId, subscriberToolListElementsArray)
    makeStopSubscriberSpotlightToMe(subscriber, 'stop-subscriber-spotlight-to-me-list-element-' + connectionId, subscriberToolListElementsArray)
}

function appendSubscriberLabelToolsListElements(subscriberLabelToolsList, subscriberToolListElementsArray) {
    for (let i = 0; i < subscriberToolListElementsArray.length; i++) {
        subscriberLabelToolsList.appendChild(subscriberToolListElementsArray[i])
    }
}

function makeSubscriberSpotlight(subscriber, listElementId, subscriberToolListElementsArray) {
    let spotlightListElement = makeSubscriberToolListElement(subscriber, listElementId, ' Spotlight to everyone', 'fa-compress-arrows-alt', false)
    spotlightListElement.addEventListener('click', () => {
        spotlightSubscriber(subscriber)
    })
    subscriberToolListElementsArray.push(spotlightListElement)
    return spotlightListElement
}

function spotlightSubscriber(subscriber) {
    stopCurrentSubscriberSpotlight()
    let connectionId = subscriber.stream.connection.connectionId
    //leave empty array in order to broadcast spotlight to everyone
    sendMessage([], `{"a":"sp","p":{"t":"${connectionId}"}}`)
    spotlightSubscriberListElementsSwitch('show-stop-spotlight-subscriber', connectionId)
}

function stopCurrentSubscriberSpotlight() {
    let currentSpotlight = document.getElementsByClassName('spotlight-video-container')
    for (let i = 0; i < currentSpotlight.length; i++) {
        if (currentSpotlight[i].id !== undefined) {
            let res = currentSpotlight[i].id.split("_", 3);
            let currentSpotlightConnectionId = res[1] + '_' + res[2]
            spotlightVideoContainer(currentSpotlightConnectionId, 'deactivate', 'subscriber')
            spotlightSubscriberListElementsSwitch('show-spotlight-subscriber', currentSpotlightConnectionId)
        }

    }
}

function makeStopSubscriberSpotlightToMe(subscriber, listElementId, subscriberToolListElementsArray) {
    let stopSpotlightListElement = makeSubscriberToolListElement(subscriber, listElementId, ' Stop spotlight', 'fa-stop-circle', false)
    stopSpotlightListElement.style.display = 'none'
    stopSpotlightListElement.addEventListener('click', () => {
        stopSubscriberSpotlightToMe(subscriber)
    })
    subscriberToolListElementsArray.push(stopSpotlightListElement)
    return stopSpotlightListElement
}

function stopSubscriberSpotlightToMe(subscriber) {
    let connectionId = subscriber.stream.connection.connectionId
    spotlightVideoContainer(connectionId, 'deactivate', 'subscriber')
    spotlightSubscriberListElementsSwitch('show-spotlight-subscriber', connectionId)
}

function makeKickSubscriberFromSession(subscriber, listElementId, subscriberToolListElementsArray) {
    let kickFromSessionListElement = makeSubscriberToolListElement(subscriber, listElementId, ' Remove from call', 'fa-sign-out-alt', false)
    kickFromSessionListElement.addEventListener('click', () => {
        kickSubscriberFromSession(subscriber)
    })
    subscriberToolListElementsArray.push(kickFromSessionListElement)
    return kickFromSessionListElement
}

function kickSubscriberFromSession(subscriber) {
    let connectionObject = subscriber.stream.connection
    sendMessage([connectionObject], "{\"a\":\"ko\",\"p\":\"\"}")
}

function makeStopSubscriberVideoToEveryone(subscriber, listElementId, subscriberToolListElementsArray) {
    let stopVideoToEveryoneListElement = makeSubscriberToolListElement(subscriber, listElementId, ' Turn off video to everyone', 'fa-video-slash', false)
    stopVideoToEveryoneListElement.addEventListener('click', () => {
        stopSubscriberVideoToEveryone(subscriber, listElementId)
    })
    subscriberToolListElementsArray.push(stopVideoToEveryoneListElement)
    return stopVideoToEveryoneListElement
}

function makeDisabledStopSubscriberVideoToEveryone(subscriber, listElementId, subscriberToolListElementsArray) {
    let disabledStopSubscriberVideoToEveryone = makeSubscriberToolListElement(subscriber, listElementId, ' Video turned off ', 'fa-video-slash', true)
    subscriberToolListElementsArray.push(disabledStopSubscriberVideoToEveryone)
    return disabledStopSubscriberVideoToEveryone
}

function stopSubscriberVideoToEveryone(subscriber, listElementId) {
    let connectionObject = subscriber.stream.connection
    subscriberToolListElementSwitch(listElementId, 'disabled-' + listElementId, 'show-disabled')
    sendMessage([connectionObject], "{\"a\":\"mv\",\"p\":\"\"}")
}

function makeSubscriberMuteToEveryone(subscriber, listElementId, subscriberToolListElementsArray) {
    let muteToEveryoneListElement = makeSubscriberToolListElement(subscriber, listElementId, ' Mute to everyone', 'fa-microphone-slash', false)
    muteToEveryoneListElement.addEventListener('click', () => {
        muteSubscriberToEveryone(subscriber, listElementId)
    })
    subscriberToolListElementsArray.push(muteToEveryoneListElement)
    return muteToEveryoneListElement
}

function makeDisabledSubscriberMuteToEveryone(subscriber, listElementId, subscriberToolListElementsArray) {
    let disabledMuteToEveryoneListElement = makeSubscriberToolListElement(subscriber, listElementId, ' Muted', 'fa-microphone-slash', true)
    subscriberToolListElementsArray.push(disabledMuteToEveryoneListElement)
    return disabledMuteToEveryoneListElement
}

function muteSubscriberToEveryone(subscriber, listElementId) {
    subscriberToolListElementSwitch(listElementId, 'disabled-' + listElementId, 'show-disabled')
    let connectionObject = subscriber.stream.connection
    sendMessage([connectionObject], "{\"a\":\"ma\",\"p\":\"\"}")
}

function makeSubscriberToolListElement(subscriber, listElementId, textContent, iconClass, disabledElement) {
    let listElement = document.createElement('li')
    listElement.setAttribute('id', listElementId)
    let icon = document.createElement('I')
    if (disabledElement) {
        listElement.classList.add('disabled-subscriber-label-tools-list-item')
        icon.classList.add('fas', iconClass, 'disabled-subscriber-button')
    } else {
        listElement.classList.add('subscriber-label-tools-list-item')
        icon.classList.add('fas', iconClass, 'subscriber-button')
    }
    listElement.textContent = textContent
    listElement.prepend(icon)

    return listElement
}

function subscriberToolListElementSwitch(listElementId, disabledListElementId, show) {
    let listElement = document.getElementById(listElementId)
    let disabledListElement = document.getElementById(disabledListElementId)
    if (show === 'show-disabled') {
        listElement.style.display = 'none'
        disabledListElement.style.display = 'block'
    }
    if (show === 'show-enabled') {
        listElement.style.display = 'block'
        disabledListElement.style.display = 'none'
    }
}

function makeSubscriberLabel(subscriberName, subscriber, connectionId) {
    let subscriberLabel = document.createElement('div');
    let subscriberLabelId = 'label-' + connectionId
    subscriberLabel.setAttribute('id', subscriberLabelId)
    subscriberLabel.appendChild(document.createTextNode(subscriberName));
    subscriberLabel.setAttribute('class', 'subscriber-label');
    //append microphone icon for muting/unmuting one subscriber
    appendMicrophoneOnSubscriberLabel(subscriber, subscriberLabel, subscriberLabelId)
    appendMoreLabelToolsActivator(subscriber, subscriberLabel, connectionId)
    return subscriberLabel;
}

function appendMoreLabelToolsActivator(subscriber, subscriberLabel, connectionId) {
    let labelToolsActivator = document.createElement('i')
    labelToolsActivator.classList.add('fas', 'fa-ellipsis-h', 'subscriber-button')
    labelToolsActivator.setAttribute('id', 'label-tools-activator-' + connectionId)
    labelToolsActivator.addEventListener('click', () => {
        showMore('label-tools-list-' + connectionId, labelToolsActivator.id)
    })
    subscriberLabel.appendChild(labelToolsActivator)
}

function appendMicrophoneOnSubscriberLabel(subscriber, subscriberLabel, subscriberLabelId) {
    let microphone = makeSubscriberMicrophoneElement(subscriber, subscriberLabelId)
    let microphoneSlash = makeSubscriberMicrophoneSlashElement(subscriber, subscriberLabelId, true)

    if (subscriber.stream.audioActive === true) {
        microphone.style.display = 'inline-block'
        microphoneSlash.style.display = 'none'
    }
    if (publisherMutedSubscriber) {
        microphone.style.display = 'none'
        microphoneSlash.style.display = 'inline-block'
    }
    //append
    subscriberLabel.appendChild(microphone)
    subscriberLabel.appendChild(microphoneSlash)
}


function makeSubscriberMicrophoneElement(subscriber, subscriberLabelId) {
    let microphone = document.createElement('I')
    microphone.classList.add('fas', 'fa-microphone', 'subscriber-button', 'subscriber-stop-audio-button')
    microphone.addEventListener('click', () => {
        stopAudio('subscriber-mute', subscriber, subscriberLabelId)
    })
    return microphone
}

function makeSubscriberMicrophoneSlashElement(subscriber, subscriberLabelId, canClick) {
    let microphoneSlash = document.createElement('I')
    microphoneSlash.classList.add('fas', 'fa-microphone-slash', 'subscriber-button', 'subscriber-stop-audio-button-slash')
    if (canClick) {
        microphoneSlash.addEventListener('click', () => {
            stopAudio('subscriber-unmute', subscriber, subscriberLabelId)
        })
    } else {
        microphoneSlash.classList.add('non-click-microphone-slash')
    }
    return microphoneSlash
}

//publisher's video  stop/unstop
function stopVideo(type, subscriber) {
    if (type === 'publisher-camera-off') {
        publisherStoppedOwnVideo = true
        publisher.publishVideo(false);
        cameraButtonActions('disable')
    }
    if (type === 'publisher-camera-on') {
        publisherStoppedOwnVideo = false
        publisher.publishVideo(true);
        cameraButtonActions('enable')
        clearHasMutedTopMessage('camera')
    }
}

function cameraButtonActions(action) {
    if (action === 'enable') {
        document.getElementById('publisher').style.display = 'block'
        document.getElementById("publisher-stop-video-button").style.display = "inline-block";
        document.getElementById("publisher-stop-video-button-slash").style.display = "none";
    }
    if (action === 'disable') {
        document.getElementById('publisher').style.display = 'none'
        document.getElementById("publisher-stop-video-button").style.display = "none";
        document.getElementById("publisher-stop-video-button-slash").style.display = "inline-block";
    }
}

function clearHasMutedTopMessage(type) {
    let currentGenericTopMessageElement = document.getElementById('generic-message')
    if (currentGenericTopMessageElement) {
        let currentGenericTopMessage = document.getElementById('generic-message').innerText;
        if (currentGenericTopMessage.includes('your ' + type)) {
            currentGenericTopMessageElement.style.display = 'none'
        }
    }
}

//publisher's audio mute/unmute
function stopAudio(type, subscriber, subscriberLabelId) {

    if (type === 'publisher-microphone-off') {
        publisher.publishAudio(false);
        publisherMutedSelf = true
        microphoneButtonActions('disable')
    }
    if (type === 'publisher-microphone-on') {
        publisher.publishAudio(true);
        publisherMutedSelf = false
        microphoneButtonActions('enable');
        clearHasMutedTopMessage('microphone')
    }
    if (type === 'subscriber-mute') {
        publisherMutedSubscriber = true
        subscriber.subscribeToAudio(false)
        document.querySelector('#' + subscriberLabelId + " .subscriber-stop-audio-button").style.display = "none";
        document.querySelector('#' + subscriberLabelId + " .subscriber-stop-audio-button-slash").style.display = "inline-block";
    }
    if (type === 'subscriber-unmute') {
        publisherMutedSubscriber = false
        subscriber.subscribeToAudio(true)
        document.querySelector('#' + subscriberLabelId + " .subscriber-stop-audio-button-slash").style.display = "none";
        document.querySelector('#' + subscriberLabelId + " .subscriber-stop-audio-button").style.display = "inline-block";
    }
}

function microphoneButtonActions(action) {
    if (action === 'enable') {
        document.getElementById("publisher-stop-audio-button").style.display = "inline-block";
        document.getElementById("publisher-stop-audio-button-slash").style.display = "none";
    }
    if (action === 'disable') {
        document.getElementById("publisher-stop-audio-button").style.display = "none";
        document.getElementById("publisher-stop-audio-button-slash").style.display = "inline-block";
    }
}

function deleteVideoStream(connectionId) {
    deletePreviousConnectionMessage(connectionId)
    if (subscriberVideosInSession > 0) {
        if (document.getElementById('remoteVideoContainer_' + connectionId)) {
            document.getElementById('remoteVideoContainer_' + connectionId).remove();
            subscriberVideosInSession -= 1
            updateLayout(subscriberVideosInSession);
        }
    }
}

function updateLayout(subscriberVideosInSession) {
    // update CSS grid based on number of displayed videos
    let rowHeight = '98vh';
    let colWidth = '98vw';
    if (subscriberVideosInSession > 0 && subscriberVideosInSession <= 4) { // 2x2 grid
        rowHeight = '48vh';
        colWidth = '48vw';
    } else if (subscriberVideosInSession > 4 && subscriberVideosInSession <= 9) { // 3x3 grid
        rowHeight = '32vh';
        colWidth = '32vw';
    } else if (subscriberVideosInSession > 9 && subscriberVideosInSession <= 16) { // 4x4 grid
        rowHeight = '21vh';
        colWidth = '21vw';
    } else if (subscriberVideosInSession > 16) {// 5x5 grid
        rowHeight = '16vh';
        colWidth = '16vw';
    }
    let root = document.querySelector(':root');
    root.style.setProperty('--rowHeight', rowHeight);
    root.style.setProperty('--colWidth', colWidth);
}

function leaveSession() {
    console.log('session on leaveSession')
    if (session) {
        session.disconnect();
        hideSession();
    }
    const remote = require('electron').remote;
    let w = remote.getCurrentWindow();
    w.close();
}

function showSession() {
    document.getElementById("session-header").innerText = mySessionId;
    document.getElementById("join").style.display = "none";
    document.getElementById("session").style.display = "block";
}

function hideSession() {
    document.getElementById("join").style.display = "block";
    document.getElementById("session").style.display = "none";
}

function openScreenShareModal() {
    let win = new BrowserWindow({
        parent: require('electron').remote.getCurrentWindow(),
        modal: true,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        resizable: false
    });
    win.setMenu(null);
    // win.webContents.openDevTools();

    var theUrl = 'file://' + __dirname + '/modal.html'
    win.loadURL(theUrl);
}

function sendMessage(connectionObject, dataJson) {
    session.signal({
        data: dataJson,  // Any string (optional)
        to: connectionObject,                     // Array of Connection objects (optional. Broadcast to everyone if empty)
        // type: 'my-chat'             // The type of message (optional)
    })
        .then(() => {
            console.log('Message ' + 'successfully sent');
            console.log(dataJson)
        })
        .catch(error => {
            console.error(error);
        });
}


function receivedMessageEvent() {
    // Receiver of the message (usually before calling 'session.connect')
    session.on('signal', (event) => {
        console.log('message event from ')
        console.log(event)
        let messageData = JSON.parse(event.data)
        let senderName = JSON.parse(event.from.data).clientData
        let connectionId = event.from.connectionId
        let senderIsSubscriber = publisher.stream.connection.connectionId !== connectionId
        let subscriber, vidContainer
        if (senderIsSubscriber) {
            vidContainer = document.getElementById('remoteVideoContainer_' + connectionId)
            subscriber = subscribers.find(subscriber => subscriber.stream.connection.connectionId === connectionId)
        }
        let toolsListElementId;
        if (messageData.a === 'ma') {
            stopAudio('publisher-microphone-off')
            let mutedNotification = senderName + ' has muted your microphone'
            clearPreviousTopMessages('organizer-action-top-message')
            makeOrganizerActionTopMessage(mutedNotification, 'generic')
        }
        if (messageData.a === 'mv') {
            stopVideo('publisher-camera-off')
            let stoppedVideoNotification = senderName + ' has turned off your camera'
            clearPreviousTopMessages('organizer-action-top-message')
            makeOrganizerActionTopMessage(stoppedVideoNotification, 'generic')
        }
        if (messageData.a === 'ko') {
            leaveSession()
        }
        if (messageData.a === 'sp') {
            let connectionId = messageData.p.t
            if (publisher.stream.connection.connectionId === connectionId) {
                //publisher spotlight
                spotlightVideoContainer(connectionId, 'activate', 'publisher')
                let spotlightedNotification = 'You are spotlighted'
                clearPreviousTopMessages('organizer-action-top-message')
                makeOrganizerActionTopMessage(spotlightedNotification, 'generic')
                spotlightMeListElementsSwitch('show-stop-spotlight')
            } else {
                //subscriber spotlight
                clearPreviousTopMessages('organizer-action-top-message')
                //stop publisher spotlight
                spotlightMe('deactivate')
                //stop other subscriber spotlight
                stopCurrentSubscriberSpotlight()
                //make spotlight
                spotlightVideoContainer(connectionId, 'activate', 'subscriber')
                spotlightSubscriberListElementsSwitch('show-stop-spotlight-subscriber', connectionId)
            }
        }
        if (messageData.a === 'spc') {
            if (senderIsSubscriber) {
                console.log('message event spc')
                console.log(event)
                let currentSubscriber
                currentSubscriber = subscribers.find(subscriber => subscriber.stream.connection.connectionId === connectionId)
                let subscriberName = senderName;
                switch (messageData.p.s) {
                    case 'vd':
                        let backgroundVideoOffAlreadyAppended
                        toolsListElementId = 'stop-subscriber-video-to-everyone-' + connectionId
                        if (messageData.p.v === 0) {
                            //check if background-video-off already appended
                            backgroundVideoOffAlreadyAppended = checkForAlreadyAppendedElement('background-video-off', vidContainer)
                            if (!backgroundVideoOffAlreadyAppended) {
                                console.log('append bgvoff')
                                subscriberBackgroundVideoOff(vidContainer, connectionId, subscriberName, false)
                                subscriberToolListElementSwitch(toolsListElementId, 'disabled-' + toolsListElementId, 'show-disabled')
                                switchClassesOnSpeaking(vidContainer, 'switch-to-video-off')
                            } else {
                                console.log('block bgvoff from appending')
                            }
                        } else {
                            //mobile case hasVideo === false
                            if (!currentSubscriber.stream.hasVideo) {
                                let constraintsToOffer = {
                                    video: true
                                }
                                currentSubscriber.stream.initWebRtcPeerReceive(true, constraintsToOffer)
                            }
                            switchClassesOnSpeaking(vidContainer, 'switch-to-video-on')
                            subscriberBackgroundVideoOff(vidContainer, connectionId, subscriberName, true)
                            subscriberToolListElementSwitch(toolsListElementId, 'disabled-' + toolsListElementId, 'show-enabled')
                        }
                        break;
                    case 'au':
                        toolsListElementId = 'mute-subscriber-to-everyone-' + connectionId
                        if (messageData.p.v === 0) {
                            subscriberAudioOff(subscriber, connectionId, false)
                            subscriberToolListElementSwitch(toolsListElementId, 'disabled-' + toolsListElementId, 'show-disabled')
                        } else {
                            subscriberAudioOff(subscriber, connectionId, true)
                            subscriberToolListElementSwitch(toolsListElementId, 'disabled-' + toolsListElementId, 'show-enabled')
                        }
                        break;
                }
            }
        }
        if (messageData.a === 'ds') {
            if (senderIsSubscriber && vidContainer) {
                console.log('message event ds from ' + senderName)
                console.log(event)
                let backgroundVideoOffAlreadyAppended
                //show subscriber's initials if he enters with closed or without camera
                if (messageData.p.v === 0) {
                    //check if background-video-off already appended
                    backgroundVideoOffAlreadyAppended = checkForAlreadyAppendedElement('background-video-off', vidContainer)
                    if (!backgroundVideoOffAlreadyAppended) {
                        console.log('append bgvoff')
                        subscriberBackgroundVideoOff(vidContainer, connectionId, senderName, false)
                        toolsListElementId = 'stop-subscriber-video-to-everyone-' + connectionId
                        subscriberToolListElementSwitch(toolsListElementId, 'disabled-' + toolsListElementId, 'show-disabled')
                    } else {
                        console.log('block bgvoff from appending')
                    }
                } else {
                    let currentSubscriber = subscribers.find(subscriber => subscriber.stream.connection.connectionId === connectionId)
                    //mobile case hasVideo === false
                    if (!currentSubscriber.stream.hasVideo) {
                        let constraintsToOffer = {
                            video: true,
                        }
                        console.log('init webrtc rec. run')
                        currentSubscriber.stream.initWebRtcPeerReceive(true, constraintsToOffer)
                    }
                }
                if (messageData.p.a === 0) {
                    subscriberAudioOff(subscriber, connectionId, false)
                    toolsListElementId = 'mute-subscriber-to-everyone-' + connectionId
                    subscriberToolListElementSwitch(toolsListElementId, 'disabled-' + toolsListElementId, 'show-disabled')
                }
                if (messageData.p.p === 1) {
                    //subscriber spotlight
                    clearPreviousTopMessages('organizer-action-top-message')
                    //stop publisher spotlight
                    spotlightMe('deactivate')
                    //stop other subscriber spotlight
                    stopCurrentSubscriberSpotlight()
                    //make spotlight
                    spotlightVideoContainer(connectionId, 'activate', 'subscriber')
                    spotlightSubscriberListElementsSwitch('show-stop-spotlight-subscriber', connectionId)
                }
            } else {
                console.log('No ds action made')
            }
        }
    });
}

function checkForAlreadyAppendedElement(typeOfIdToCheck, vidContainer) {
    let subscriberVideoContainerAppendedDivElements = vidContainer.querySelectorAll('div')
    let elementExists, divElement
    for (let i = 0; i < subscriberVideoContainerAppendedDivElements.length; i++) {
        divElement = subscriberVideoContainerAppendedDivElements[i]
        if (divElement.id.includes(typeOfIdToCheck)) {
            elementExists = true
            break;
        }
    }
    return elementExists
}

function spotlightVideoContainer(connectionId, spotlightAction, role) {
    let videoContainer
    if (role === 'subscriber') {
        videoContainer = document.getElementById('remoteVideoContainer_' + connectionId)
    }
    if (role === 'publisher') {
        videoContainer = document.getElementById('publisher')
        videoContainer.classList.add('override-publisher-position')
    }

    if (spotlightAction === 'activate') {
        //add spotlight container if not exists
        if (!videoContainer.classList.contains('spotlight-video-container')) {
            videoContainer.classList.remove(role + '-video-container')
            videoContainer.classList.add('spotlight-video-container')
        }
    }
    if (spotlightAction === 'deactivate') {
        //remove spotlight container if exists
        if (videoContainer.classList.contains('spotlight-video-container')) {
            videoContainer.classList.remove('spotlight-video-container')
            videoContainer.classList.add(role + '-video-container')
        }
        //for publisher only
        if (videoContainer.classList.contains('override-publisher-position')) {
            videoContainer.classList.remove('override-publisher-position')
        }
    }
}

function makeOrganizerActionTopMessage(message, type) {
    let organizerAction;
    organizerAction = document.getElementById(type + '-message')
    organizerAction.classList.add('organizer-action-top-message')
    organizerAction.style.display = 'block'
    organizerAction.innerText = message
    makeAndAppendDismissButton(organizerAction, 'organizer-action-top-message')
}

function showMoreDevices(listId, activator) {
    //prevent user to change device if another is changing
    if (deviceChanging === false) {
        showMore(listId, activator)
    }
}

function showMore(listId, activator) {
    var toolsDropdown = document.getElementById(listId);
    toolsDropdown.classList.toggle('show');
    // Close the dropdown if the user clicks outside of more tools
    window.onclick = function (event) {
        if (!event.target.matches('#' + activator)) {
            var dropdowns = document.getElementsByClassName("dropdown-content");
            for (var i = 0; i < dropdowns.length; i++) {
                var openDropdown = dropdowns[i];
                if (openDropdown.classList.contains('show')) {
                    openDropdown.classList.remove('show');
                }
            }
        }
    }
}

function closeSettings(type) {
    let settings;
    if (type === 'device-settings') {
        movePublisherContainerOnDeviceSettings('move-right')
        settings = document.getElementById('device-settings')
        settings.style.display = 'none'
    }
}

function showSettings(type) {
    let settings;
    if (type === 'device-settings') {
        movePublisherContainerOnDeviceSettings('move-left')
        settings = document.getElementById('device-settings')
        settings.style.display = 'block'
    }
}

function spotlightMe(action) {
    let connectionId = publisher.stream.connection.connectionId
    if (action === 'activate') {
        //spotlight me to others
        clearPreviousTopMessages('organizer-action-top-message')
        sendMessage([], `{"a":"sp","p":{"t":"${connectionId}"}}`)
        //stop previous spotlight
        stopCurrentSubscriberSpotlight()
        //spotlight me to me
        spotlightVideoContainer(connectionId, 'activate', 'publisher')
        spotlightMeListElementsSwitch('show-stop-spotlight')
        publisherSpotlighted = 1
    }
    if (action === 'deactivate') {
        //unspotlight me to me
        clearPreviousTopMessages('organizer-action-top-message')
        spotlightVideoContainer(connectionId, 'deactivate', 'publisher')
        spotlightMeListElementsSwitch('show-spotlight-me')
        publisherSpotlighted = 0
    }
}

function spotlightMeListElementsSwitch(show) {
    let spotlightMe = document.getElementById('spotlight-me-list-item')
    let stopSpotlightMe = document.getElementById('stop-spotlight-me-list-item')
    if (show === 'show-stop-spotlight') {
        spotlightMe.style.display = 'none'
        stopSpotlightMe.style.display = 'block'
    }
    if (show === 'show-spotlight-me') {
        spotlightMe.style.display = 'block'
        stopSpotlightMe.style.display = 'none'
    }
}

function spotlightSubscriberListElementsSwitch(show, connectionId) {
    let spotlightSubscriber = document.getElementById('subscriber-spotlight-to-me-list-element-' + connectionId)
    let stopSpotlightSubscriber = document.getElementById('stop-subscriber-spotlight-to-me-list-element-' + connectionId)
    if (show === 'show-stop-spotlight-subscriber') {
        spotlightSubscriber.style.display = 'none'
        stopSpotlightSubscriber.style.display = 'block'
    }
    if (show === 'show-spotlight-subscriber') {
        spotlightSubscriber.style.display = 'block'
        stopSpotlightSubscriber.style.display = 'none'
    }
}

function movePublisherContainerOnDeviceSettings(move) {
    let publisherContainer = document.querySelector('.publisher-video-container')
    if (publisherContainer) {
        if (move === 'move-right') {
            publisherContainer.style.right = '0px'
        }
        if (move === 'move-left') {
            publisherContainer.style.right = '250px'
        }
    }

}

//clock
function clock() {
    var minutesLabel = document.getElementById("minutes");
    var secondsLabel = document.getElementById("seconds");
    var totalSeconds = 0;
    setInterval(setTime, 1000);

    function setTime() {
        ++totalSeconds;
        secondsLabel.innerHTML = pad(totalSeconds % 60);
        minutesLabel.innerHTML = pad(parseInt(totalSeconds / 60));
    }

    function pad(val) {
        var valString = val + "";
        if (valString.length < 2) {
            return "0" + valString;
        } else {
            return valString;
        }
    }
}

//window buttons
const win = remote.getCurrentWindow();

// When document has loaded, initialize
document.onreadystatechange = (event) => {
    if (document.readyState === "complete") {
        handleWindowControls();
    }
};

function handleWindowControls() {

    document.getElementById('min-button').addEventListener("click", event => {
        win.minimize();
    });

    document.getElementById('max-button').addEventListener("click", event => {
        win.maximize();
    });

    document.getElementById('restore-button').addEventListener("click", event => {
        win.unmaximize();
    });

    document.getElementById('close-button-before-load').addEventListener("click", event => {
        win.close();
    });
    // Toggle maximise/restore buttons when maximisation/unmaximisation occurs
    toggleMaxRestoreButtons();
    win.on('maximize', toggleMaxRestoreButtons);
    win.on('unmaximize', toggleMaxRestoreButtons);

    function toggleMaxRestoreButtons() {
        if (win.isMaximized()) {
            document.body.classList.add('maximized');
            document.getElementById('max-button').style.display = 'none';
            document.getElementById('restore-button').style.display = 'block';
        } else {
            document.body.classList.remove('maximized');
            document.getElementById('max-button').style.display = 'block';
            document.getElementById('restore-button').style.display = 'none';
        }
    }
}

/**
 * --------------------------
 * SERVER-SIDE RESPONSIBILITY
 * --------------------------
 * These methods retrieve the mandatory user token from OpenVidu Server.
 * This behavior MUST BE IN YOUR SERVER-SIDE IN PRODUCTION (by using
 * the API REST, openvidu-java-client or openvidu-node-client):
 *   1) Initialize a Session in OpenVidu Server    (POST /openvidu/api/sessions)
 *   2) Create a Connection in OpenVidu Server (POST /openvidu/api/sessions/<SESSION_ID>/connection)
 *   3) The Connection.token must be consumed in Session.connect() method
 */


var OPENVIDU_SERVER_URL = "https://ovideo.waavia7.com";
var OPENVIDU_SERVER_SECRET = "Gouaavia-7";

function getToken(mySessionId) {
    console.log('needForSessionCreate in getToken', needForSessionCreate)
    if (needForSessionCreate) {
        return createSession(mySessionId).then(sessionId => createToken(sessionId));
    } else {
        //retrieve session
        //just join to session
        return createToken(mySessionId)
    }

}

function createSession(sessionId) { // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-openviduapisessions
    return new Promise((resolve, reject) => {
        axios.post(
            OPENVIDU_SERVER_URL + "/openvidu/api/sessions",
            JSON.stringify({
                customSessionId: sessionId
            }), {
                headers: {
                    'Authorization': "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
                    'Content-Type': 'application/json',
                },
                crossdomain: true
            }
        )
            .then(res => {
                if (res.status === 200) {
                    // SUCCESS response from openvidu-server. Resolve token
                    resolve(res.data.id);
                    console.log('response from createSession', res)
                } else {
                    // ERROR response from openvidu-server. Resolve HTTP status
                    reject(new Error(res.status.toString()));
                }
            }).catch(error => {
            if (error.response) {
                if (error.response.status === 409) {
                    resolve(sessionId);
                    return false;
                } else {
                    console.error('Error on create session', error)
                    networkEventHandling('connection-failed', 'Couldn\'t connect to server', 'error')
                    console.warn('No connection to Server. This may be a certificate error at ' + OPENVIDU_SERVER_URL);
                    return false;
                }
            } else {
                networkEventHandling('connection-failed', 'Couldn\'t connect to server', 'error')
            }
        });
        return false;
    });
}

function createToken(sessionId) { // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-openviduapisessionsltsession_idgtconnection

//	params = {
//		"type": "WEBRTC",
//		"data": "user_data",
//		"role": "PUBLISHER",
//		"kurentoOptions": {
// 			"videoMaxRecvBandwidth": 1000,
// 			"videoMinRecvBandwidth": 300,
// 			"videoMaxSendBandwidth": 1000,
// 			"videoMinSendBandwidth": 300,
//			"allowedFilters": [ "GStreamerFilter", "ZBarFilter" ]
//		}
//	};

    return new Promise((resolve, reject) => {
        axios.post(
            OPENVIDU_SERVER_URL + "/openvidu/api/sessions/" + sessionId + "/connection", {
                headers: {
                    'Authorization': "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
//                    data: JSON.stringify(params)
            }
        )
            .then(res => {
                if (res.status === 200) {
                    // SUCCESS response from openvidu-server. Resolve token
                    resolve(res.data.token);
                } else {
                    // ERROR response from openvidu-server. Resolve HTTP status
                    reject(new Error(res.status.toString()));
                }
            }).catch(error => {
            reject(error);
        });
        return false;
    });
}